import { expect, test } from '@playwright/test';
import type { Page } from '@playwright/test';

const STORAGE_KEY = 'utilize-schema-playground';
const THEME_KEY = 'utilize-schema-theme';

interface DropFile {
	name: string;
	content: string;
}

const droppedSchemas: DropFile[] = [
	{
		name: 'person.json',
		content: JSON.stringify({
			$schema: 'http://json-schema.org/draft-07/schema#',
			type: 'object',
			properties: { name: { type: 'string' }, address: { $ref: './address.json' } },
			required: ['name', 'address'],
		}),
	},
	{
		name: 'address.json',
		content: JSON.stringify({
			$schema: 'http://json-schema.org/draft-07/schema#',
			type: 'object',
			properties: { city: { type: 'string' } },
			required: ['city'],
		}),
	},
];

async function open(page: Page, path = '/') {
	await page.goto(path);
	await page.evaluate(() => localStorage.clear());
	await page.goto(path);
	await expectResult(page);
}

async function openWithStorage(page: Page, state: Record<string, unknown>, path = '/') {
	await page.goto('/');
	await page.evaluate(([key, value]) => localStorage.setItem(key, JSON.stringify(value)), [
		STORAGE_KEY,
		state,
	] as const);
	await page.goto(path);
}

async function expectResult(page: Page) {
	await expect(page.getByTestId('validator-results')).toBeVisible({ timeout: 20_000 });
	await expect(page.locator('[data-testid^="result-"]')).toHaveAttribute(
		'data-status',
		/valid|invalid/,
		{ timeout: 20_000 }
	);
}

interface SavedFile {
	id: string;
	name: string;
	content: string;
}

async function savedFiles(page: Page): Promise<SavedFile[]> {
	return page.evaluate((key) => {
		const raw = localStorage.getItem(key);

		if (raw === null) {
			return [];
		}

		const parsed: unknown = JSON.parse(raw);

		if (typeof parsed !== 'object' || parsed === null || !('files' in parsed)) {
			return [];
		}

		const files = parsed.files;

		if (!Array.isArray(files)) {
			return [];
		}

		return files.filter((file): file is { id: string; name: string; content: string } => {
			if (typeof file !== 'object' || file === null) {
				return false;
			}

			return (
				'id' in file &&
				'name' in file &&
				'content' in file &&
				typeof file.id === 'string' &&
				typeof file.name === 'string' &&
				typeof file.content === 'string'
			);
		});
	}, STORAGE_KEY);
}

async function savedData(page: Page): Promise<string> {
	return page.evaluate((key) => {
		const raw = localStorage.getItem(key);

		if (raw === null) {
			return '';
		}

		const parsed: unknown = JSON.parse(raw);

		if (typeof parsed !== 'object' || parsed === null || !('data' in parsed)) {
			return '';
		}

		return typeof parsed.data === 'string' ? parsed.data : '';
	}, STORAGE_KEY);
}

async function tabNames(page: Page) {
	return page.getByRole('tab').allInnerTexts();
}

async function resultStatus(page: Page) {
	return page.locator('[data-testid^="result-"]').first().getAttribute('data-status');
}

async function dragIn(page: Page, files: DropFile[]) {
	await page.evaluate((entries) => {
		const dataTransfer = new DataTransfer();

		for (const entry of entries) {
			dataTransfer.items.add(new File([entry.content], entry.name, { type: 'application/json' }));
		}
		window.dispatchEvent(
			new DragEvent('dragenter', { bubbles: true, cancelable: true, dataTransfer })
		);
	}, files);
	await expect(page.getByTestId('file-drop-overlay')).toBeVisible();
}

async function dragOver(page: Page, mode: 'add' | 'replace') {
	await page.evaluate((dropMode) => {
		const dataTransfer = new DataTransfer();

		dataTransfer.items.add(new File(['{"type":"string"}'], 'x.json', { type: 'application/json' }));
		document
			.querySelector(`[data-drop-mode="${dropMode}"]`)
			?.dispatchEvent(new DragEvent('dragover', { bubbles: true, cancelable: true, dataTransfer }));
	}, mode);
}

async function dropOn(page: Page, mode: 'add' | 'replace', files: DropFile[]) {
	await page.evaluate(
		([entries, dropMode]) => {
			const dataTransfer = new DataTransfer();

			for (const entry of entries) {
				dataTransfer.items.add(new File([entry.content], entry.name, { type: 'application/json' }));
			}

			const target = document.querySelector(`[data-drop-mode="${dropMode}"]`);

			target?.dispatchEvent(
				new DragEvent('dragover', { bubbles: true, cancelable: true, dataTransfer })
			);
			target?.dispatchEvent(
				new DragEvent('drop', { bubbles: true, cancelable: true, dataTransfer })
			);
		},
		[files, mode] as const
	);
}

test.beforeEach(async ({ page }) => {
	await page.emulateMedia({ colorScheme: 'light' });
});

test('renders the default workspace and validates the example data', async ({ page }) => {
	await open(page);

	expect(await tabNames(page)).toHaveLength(5);
	expect((await tabNames(page))[0]).toContain('person.json');
	expect(await resultStatus(page)).toBe('valid');
	expect(await savedData(page)).toContain('"firstName": "Ada"');
});

test('dragging JSON files over the editor shows the add and replace targets', async ({ page }) => {
	await open(page);
	await dragIn(page, droppedSchemas);

	await expect(page.getByText('Add to this workspace')).toBeVisible();
	await expect(page.getByText('Start from the dropped files')).toBeVisible();
});

test('the highlighted drop target follows the pointer', async ({ page }) => {
	await open(page);
	await dragIn(page, droppedSchemas);

	const add = page.locator('[data-drop-mode="add"]');
	const replace = page.locator('[data-drop-mode="replace"]');

	await dragOver(page, 'add');
	await expect(add).toHaveAttribute('data-active', 'true');
	await expect(replace).not.toHaveAttribute('data-active');

	await dragOver(page, 'replace');
	await expect(replace).toHaveAttribute('data-active', 'true');
	await expect(add).not.toHaveAttribute('data-active');
});

test('dropping files on the replace target opens them as tabs', async ({ page }) => {
	await open(page);
	await dragIn(page, droppedSchemas);
	await dropOn(page, 'replace', droppedSchemas);

	await expect(page.getByTestId('file-drop-overlay')).toBeHidden({ timeout: 10_000 });
	await expect
		.poll(async () => (await savedFiles(page)).map((file) => file.name))
		.toEqual(['person.json', 'address.json']);
	expect((await savedFiles(page))[0].content).toContain('./address.json');
	expect(await tabNames(page)).toHaveLength(2);
});

test('dropping files on the add target keeps the open files', async ({ page }) => {
	await open(page);
	const before = (await tabNames(page)).length;
	const extra = [{ name: 'extra.json', content: '{"type":"string"}' }];

	await dragIn(page, extra);
	await dropOn(page, 'add', extra);

	await expect.poll(async () => (await tabNames(page)).length).toBe(before + 1);
	expect((await tabNames(page)).at(-1)).toContain('extra.json');
});

test('dropping a JSON file on the test data editor replaces the test data', async ({ page }) => {
	await open(page);
	const content = JSON.stringify({ dropped: true }, null, 2);
	const dropped = [{ name: 'payload.json', content }];

	await page.evaluate((entries) => {
		const dataTransfer = new DataTransfer();

		for (const entry of entries) {
			dataTransfer.items.add(new File([entry.content], entry.name, { type: 'application/json' }));
		}

		const pane = document.querySelector('#test-data-editor')?.closest('section');

		pane?.dispatchEvent(
			new DragEvent('dragenter', { bubbles: true, cancelable: true, dataTransfer })
		);
		pane?.dispatchEvent(new DragEvent('drop', { bubbles: true, cancelable: true, dataTransfer }));
	}, dropped);

	await expect.poll(() => savedData(page)).toBe(content);
	await expect(page.getByText('Drop a JSON document')).toBeHidden();
});

test('the copy button resets when the schema changes', async ({ page }) => {
	await open(page);

	await page.getByRole('button', { name: 'Copy code' }).click();
	await expect(page.getByRole('button', { name: 'Copied' })).toBeVisible();

	await page.getByLabel('Rename person.json').click();
	await page.getByLabel('File name').fill('contact.json');
	await page.getByLabel('Confirm rename').click();

	await expect(page.getByRole('button', { name: 'Copy code' })).toBeVisible();
});

test('the header pickers are selects rather than text inputs', async ({ page }) => {
	await open(page);

	await expect(page.locator('[data-slot="combobox-input"]')).toHaveCount(0);
	await expect(page.locator('[data-slot="select-trigger"]')).toHaveCount(4);

	for (const name of ['Generator', 'Example', 'Keyword policy', 'Format']) {
		await expect(page.getByRole('combobox', { name })).toBeVisible();
	}
});

test('the color mode button cycles through auto, light and dark', async ({ page }) => {
	await open(page);
	const button = page.getByRole('button', { name: 'Color mode' });

	await button.click();
	await expect
		.poll(() => page.evaluate((key) => localStorage.getItem(key), THEME_KEY))
		.toBe('light');
	await button.click();
	await expect
		.poll(() => page.evaluate((key) => localStorage.getItem(key), THEME_KEY))
		.toBe('dark');
	await button.click();
	await expect
		.poll(() => page.evaluate((key) => localStorage.getItem(key), THEME_KEY))
		.toBe('auto');
});

test('the generator select offers only implemented generators', async ({ page }) => {
	await open(page);

	await page.getByRole('combobox', { name: 'Generator' }).click();

	await expect(page.getByRole('option', { name: /Zod/ })).toBeVisible();
	await expect(page.getByRole('option', { name: /Effect Schema/ })).toBeVisible();
	await expect(page.getByRole('option', { name: /TypeScript/ })).toBeVisible();
	await expect(page.getByRole('option', { name: /Valibot/ })).toHaveCount(0);
});

test('choosing a generator updates the URL, the code and the result pane', async ({ page }) => {
	await open(page);

	await page.getByRole('combobox', { name: 'Generator' }).click();
	await page.getByRole('option', { name: /Effect Schema/ }).click();

	await expect
		.poll(() => page.evaluate(() => new URL(location.href).searchParams.get('generator')))
		.toBe('effect');
	await expect(page.getByRole('combobox', { name: 'Generator' })).toHaveText('Effect Schema');
	await expect(page.getByTestId('result-effect')).toHaveAttribute('data-status', 'valid', {
		timeout: 20_000,
	});

	await page.getByRole('combobox', { name: 'Generator' }).click();
	await page.getByRole('option', { name: /TypeScript/ }).click();

	await expect(page.getByText(/emits types only/)).toBeVisible();
	await expect(page.locator('[data-testid="result-effect"]')).toHaveCount(0);
	await expect(page.getByRole('combobox', { name: 'Format' })).toBeDisabled();
});

test('the format select switches between annotation and assertion', async ({ page }) => {
	await open(page);

	await expect
		.poll(() => page.evaluate(() => new URL(location.href).searchParams.get('format-mode')))
		.toBe('assert');

	await page.getByRole('combobox', { name: 'Format' }).click();
	await page.getByRole('option', { name: /Annotate/ }).click();

	await expect
		.poll(() => page.evaluate(() => new URL(location.href).searchParams.get('format-mode')))
		.toBe('annotate');
	await expect(page.getByRole('combobox', { name: 'Format' })).toHaveText('Annotate');
});

test('switching examples loads their test data and clears the example on edits', async ({
	page,
}) => {
	await open(page);

	await page.getByRole('combobox', { name: 'Example' }).click();
	await page.getByRole('option', { name: /Enum/ }).click();

	await expect.poll(() => savedData(page)).toBe('"green"');
	await expect
		.poll(() => page.evaluate(() => new URL(location.href).searchParams.get('example')))
		.toBe('enum');
	await expect.poll(() => resultStatus(page), { timeout: 20_000 }).toBe('valid');

	await page.getByRole('radio', { name: 'Invalid' }).click();

	await expect.poll(() => savedData(page)).toBe('"purple"');
	await expect.poll(() => resultStatus(page), { timeout: 20_000 }).toBe('invalid');
	await expect
		.poll(() => page.evaluate(() => new URL(location.href).searchParams.has('example')))
		.toBe(false);
});

test('an example URL loads that example', async ({ page }) => {
	await open(page, '/?example=const');

	await expect(page.getByRole('tab', { name: /const\.json/ })).toBeVisible();
	expect(await page.evaluate(() => new URL(location.href).searchParams.get('example'))).toBe(
		'const'
	);
	await expect
		.poll(() => page.evaluate(() => new URL(location.href).searchParams.get('generator')))
		.toBe('zod');
});

test('the keyword policy shows foreign keywords as errors or warnings', async ({ page }) => {
	await openWithStorage(page, {
		files: [
			{
				id: 'root',
				name: 'root.json',
				content: JSON.stringify({
					$schema: 'http://json-schema.org/draft-07/schema#',
					type: 'array',
					prefixItems: [{ type: 'string' }],
				}),
			},
		],
		target: 'zod',
		keywordPolicy: 'error',
	});

	const problems = page.getByTestId('problems');

	await expect(problems).toContainText('"prefixItems" is not part of draft-07', {
		timeout: 20_000,
	});
	await expect(problems).toContainText('1 errors, 0 warnings');
	await expect(problems).toContainText('Error');

	await page.getByRole('combobox', { name: 'Keyword policy' }).click();
	await page.getByRole('option', { name: 'Warning' }).click();

	await expect(problems).toContainText('0 errors, 1 warnings', { timeout: 20_000 });
	await expect
		.poll(() => page.evaluate(() => new URL(location.href).searchParams.get('keyword-policy')))
		.toBe('warn');
});

test('the keyword-policy URL parameter overrides the hash state', async ({ page }) => {
	const state = {
		files: [
			{
				id: 'root',
				name: 'root.json',
				content: JSON.stringify({
					$schema: 'http://json-schema.org/draft-07/schema#',
					type: 'array',
					prefixItems: [{ type: 'string' }],
				}),
			},
		],
		target: 'zod',
		keywordPolicy: 'warn',
	};
	const encoded = Buffer.from(JSON.stringify(state)).toString('base64url');

	await page.goto(`/?keyword-policy=error#data=${encoded}`);
	await expect(page.getByTestId('problems')).toContainText('1 errors, 0 warnings', {
		timeout: 20_000,
	});
});

test('share includes the keyword policy in the URL', async ({ page }) => {
	await open(page);

	await page.getByRole('button', { name: 'Share' }).click();

	await expect
		.poll(() => page.evaluate(() => new URL(location.href).searchParams.get('keyword-policy')))
		.toBe('warn');
	await expect(page.getByRole('button', { name: 'Link copied' })).toBeVisible();
});

test('share feedback resets when the workspace changes', async ({ page }) => {
	await open(page);

	await page.getByRole('button', { name: 'Share' }).click();
	await expect(page.getByRole('button', { name: 'Link copied' })).toBeVisible();

	await page.getByLabel('Add file').click();

	await expect(page.getByRole('button', { name: 'Share' })).toBeVisible();
});

test('renaming validates duplicates and cancels on an outside click', async ({ page }) => {
	await open(page);

	await page.getByLabel('Rename person.json').click();
	await page.getByLabel('File name').fill('address.json');
	await page.getByLabel('Confirm rename').click();

	await expect(page.getByText('A file with this name already exists.')).toBeVisible();
	await expect(page.getByLabel('File name')).toBeVisible();

	await page.getByLabel('File name').fill('renamed.json');
	await page.getByText('Generated TypeScript').click();

	await expect(page.getByLabel('File name')).toHaveCount(0);
	expect((await tabNames(page)).some((name) => name.includes('person.json'))).toBe(true);
});

test('file tabs can be added, renamed and closed', async ({ page }) => {
	await open(page);
	const before = (await tabNames(page)).length;

	await page.getByLabel('Add file').click();
	await expect.poll(async () => (await tabNames(page)).length).toBe(before + 1);

	await page.getByLabel('Rename person.json').click();
	await page.getByLabel('File name').fill('contact.json');
	await page.getByLabel('File name').press('Enter');

	await expect(page.getByRole('tab', { name: /contact\.json/ })).toBeVisible();
	await expect
		.poll(async () => (await tabNames(page)).some((name) => name.includes('person.json')))
		.toBe(false);

	await page.getByLabel('Close untitled.json').click();
	await expect
		.poll(async () => (await tabNames(page)).some((name) => name.includes('untitled.json')))
		.toBe(false);
});

test('the validation panel can be collapsed', async ({ page }) => {
	await open(page);
	const toggle = page.getByRole('button', { name: /Validation/ });
	const body = page.locator('#validation-problems');

	await expect(toggle).toHaveAttribute('aria-expanded', 'true');
	await expect(body).not.toHaveAttribute('hidden');

	await toggle.click();
	await expect(toggle).toHaveAttribute('aria-expanded', 'false');
	await expect(body).toHaveAttribute('hidden');
	await expect
		.poll(() => body.evaluate((element) => element.getBoundingClientRect().height))
		.toBe(0);
	await expect
		.poll(() =>
			page.getByTestId('problems').evaluate((element) => element.getBoundingClientRect().height)
		)
		.toBeLessThan(40);

	await toggle.click();
	await expect(toggle).toHaveAttribute('aria-expanded', 'true');
	await expect(body).not.toHaveAttribute('hidden');
});

test('the test data section collapses to its header and keeps the editor', async ({ page }) => {
	await page.setViewportSize({ width: 1200, height: 800 });
	await open(page);
	const toggle = page.getByRole('button', { name: 'Test data' });
	const editor = page.getByTestId('data-editor');

	await expect(toggle).toHaveAttribute('aria-expanded', 'true');

	await toggle.click();
	await expect(toggle).toHaveAttribute('aria-expanded', 'false');
	await expect(page.locator('#test-data-row')).toHaveAttribute('data-collapsed', 'true');
	await expect(page.locator('#test-data-editor')).toHaveAttribute('hidden');
	await expect(page.locator('#validator-results-panel')).toHaveAttribute('hidden');
	await expect(editor).toHaveCount(1);
	await expect
		.poll(() => page.locator('#test-data-row').evaluate((el) => el.getBoundingClientRect().height))
		.toBeLessThan(60);

	await toggle.click();
	await expect(page.locator('#test-data-editor')).not.toHaveAttribute('hidden');
	await expect(editor).toHaveCount(1);
});

test('resize and collapse controls remain available on narrow screens', async ({ page }) => {
	await page.setViewportSize({ width: 414, height: 896 });
	await open(page);
	const separator = page.getByRole('separator', {
		name: 'Resize schema and test data sections',
	});
	const toggle = page.getByRole('button', { name: 'Test data' });

	await expect(separator).toBeVisible();
	await expect(toggle).toBeVisible();
	await expect.poll(async () => separator.getAttribute('aria-valuenow')).toBe('60');

	await separator.focus();
	await page.keyboard.press('ArrowDown');
	await expect.poll(async () => separator.getAttribute('aria-valuenow')).toBe('62');

	await toggle.click();
	await expect(toggle).toHaveAttribute('aria-expanded', 'false');
	await expect(page.locator('#test-data-editor')).toHaveAttribute('hidden');
	await expect(separator).toBeVisible();
});

test('the sections can be resized by keyboard', async ({ page }) => {
	await page.setViewportSize({ width: 1200, height: 800 });
	await open(page);
	const separator = page.getByRole('separator', {
		name: 'Resize schema and test data sections',
	});

	await expect.poll(async () => separator.getAttribute('aria-valuenow')).toBe('60');

	await separator.focus();
	await page.keyboard.press('ArrowUp');
	await expect.poll(async () => separator.getAttribute('aria-valuenow')).toBe('58');

	await page.keyboard.press('Shift+ArrowDown');
	await expect.poll(async () => separator.getAttribute('aria-valuenow')).toBe('68');

	await page.keyboard.press('Home');
	await expect.poll(async () => separator.getAttribute('aria-valuenow')).toBe('20');

	await page.keyboard.press('End');
	await expect.poll(async () => separator.getAttribute('aria-valuenow')).toBe('94');
});

test('dropping a JSON file on a collapsed test data header is ignored', async ({ page }) => {
	await page.setViewportSize({ width: 1200, height: 800 });
	await open(page);
	const before = await savedData(page);

	await page.getByRole('button', { name: 'Test data' }).click();
	await expect(page.locator('#test-data-editor')).toHaveAttribute('hidden');

	await page.evaluate(() => {
		const dataTransfer = new DataTransfer();

		dataTransfer.items.add(
			new File(['{"changed":true}'], 'payload.json', { type: 'application/json' })
		);

		const pane = document.querySelector('[data-data-drop]');

		pane?.dispatchEvent(
			new DragEvent('dragenter', { bubbles: true, cancelable: true, dataTransfer })
		);
		pane?.dispatchEvent(new DragEvent('drop', { bubbles: true, cancelable: true, dataTransfer }));
	});

	await page.waitForTimeout(500);
	expect(await savedData(page)).toBe(before);
});

test('the result pane follows the selected generator', async ({ page }) => {
	await open(page);

	await expect.poll(() => resultStatus(page), { timeout: 20_000 }).toBe('valid');

	await page.getByRole('combobox', { name: 'Generator' }).click();
	await page.getByRole('option', { name: /Effect Schema/ }).click();
	await expect(page.getByTestId('result-effect')).toHaveAttribute('data-status', 'valid', {
		timeout: 20_000,
	});
	await expect(page.getByTestId('result-zod')).toHaveCount(0);

	await page.getByRole('radio', { name: 'Invalid' }).click();
	await expect(page.getByTestId('result-effect')).toHaveAttribute('data-status', 'invalid', {
		timeout: 20_000,
	});
});

test('boolean roots run through each validator', async ({ page }) => {
	for (const [target, schema, status] of [
		['zod', true, 'valid'],
		['zod', false, 'invalid'],
		['effect', true, 'valid'],
		['effect', false, 'invalid'],
	] as const) {
		await openWithStorage(page, {
			files: [{ id: 'root', name: 'root.json', content: JSON.stringify(schema) }],
			target,
			data: '{"value":1}',
		});

		await expect(page.getByTestId(`result-${target}`)).toHaveAttribute('data-status', status, {
			timeout: 20_000,
		});
		await expect(page.getByTestId(`result-${target}`)).not.toContainText(
			'The validator could not run'
		);
		await expect(page.getByTestId(`result-${target}`)).not.toContainText(
			'The validator rejected the data.'
		);
	}
});

test('editing the schema updates the saved workspace and the generated code', async ({ page }) => {
	await open(page);
	const before = (await savedFiles(page))[0].content;

	await page.getByTestId('schema-editor').click();
	await page.keyboard.press('ControlOrMeta+End');
	await page.keyboard.type('x');

	await expect.poll(async () => (await savedFiles(page))[0].content).toContain('x');
	expect((await savedFiles(page))[0].content).not.toBe(before);
	const value = await page.getByTestId('schema-editor').getAttribute('data-value');

	expect((await savedFiles(page))[0].content).toBe(value);
});

test('the status bar follows the schema editor cursor', async ({ page }) => {
	await open(page);
	const status = page.locator('[class*="statusBar"]');

	await expect(status).toContainText('Ln 1, Col 1');

	await page.getByTestId('schema-editor').locator('.view-line').nth(2).click();

	await expect.poll(async () => status.textContent()).toContain('Ln 3');
});

test('selecting a problem focuses its file and line', async ({ page }) => {
	await openWithStorage(page, {
		files: [
			{
				id: 'root',
				name: 'root.json',
				content: JSON.stringify({
					$schema: 'http://json-schema.org/draft-07/schema#',
					type: 'array',
					prefixItems: [{ type: 'string' }],
				}),
			},
			{
				id: 'other',
				name: 'other.json',
				content: JSON.stringify({ type: 'string' }),
			},
		],
		target: 'zod',
		keywordPolicy: 'error',
	});

	const problem = page.locator('[class*="problem_"]').first();

	await expect(problem).toContainText('prefixItems', { timeout: 20_000 });
	await problem.click();

	await expect(page.getByRole('tab', { name: /root\.json/ })).toHaveAttribute(
		'aria-selected',
		'true'
	);
	await expect
		.poll(() => page.evaluate(() => document.activeElement?.closest('.monaco-editor') !== null))
		.toBe(true);
});

test('the workspace survives a reload and the back button', async ({ page }) => {
	await open(page);

	await page.getByLabel('Rename person.json').click();
	await page.getByLabel('File name').fill('persisted.json');
	await page.getByLabel('File name').press('Enter');
	await expect(page.getByRole('tab', { name: /persisted\.json/ })).toBeVisible();

	await page.reload();
	await expect(page.getByRole('tab', { name: /persisted\.json/ })).toBeVisible();

	await page.getByRole('combobox', { name: 'Generator' }).click();
	await page.getByRole('option', { name: /Effect Schema/ }).click();
	await expect
		.poll(() => page.evaluate(() => new URL(location.href).searchParams.get('generator')))
		.toBe('effect');

	await page.goBack();
	await expect
		.poll(() => page.evaluate(() => new URL(location.href).searchParams.get('generator')))
		.toBe('zod');
	await expect(page.getByRole('combobox', { name: 'Generator' })).toHaveText('Zod');
});
