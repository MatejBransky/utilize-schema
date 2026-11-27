import { assert } from '@utilize/json-schema';
import type { createAgent } from '@ui-sdk/react/agent';
import { expect, vi } from 'vitest';
import type { render } from 'vitest-browser-react';

export type TestAgent = ReturnType<typeof createAgent>;
export type RenderedApp = Awaited<ReturnType<typeof render>>;

const expectedLabels = [
	'Generator',
	'Example',
	'Keyword policy',
	'Format',
	'Color mode',
	'Schema files',
	'Add file',
	'Format schema',
	'Format data',
	'Example test data',
	'Test data section',
	'Validation section',
	'Workspace layout',
	'Copy code',
	'Share',
	'Reports',
	'GitHub',
];

export function expectAgentSnapshotLabels(
	agent: TestAgent,
	extraLabels: string[] = [],
	omitLabels: string[] = []
) {
	const components = agent
		.snapshot()
		.filter((entry) => !entry.offPage && entry.component !== 'more');

	for (const entry of components) {
		expect(entry.label, `${entry.component} ${entry.ref} has no name`).toBeTruthy();
	}

	const labels = components.map((entry) => entry.label);
	expect(new Set(labels).size).toBe(labels.length);
	const labelsToCheck = [...expectedLabels, ...extraLabels].filter(
		(label) => !omitLabels.includes(label)
	);

	for (const label of labelsToCheck) {
		expect(labels, `${label} is missing from the snapshot`).toContain(label);
	}
}

export async function expectAgentControls(agent: TestAgent, screen: RenderedApp) {
	const cases = await agent.query({ within: 'Example test data' });
	expect('error' in cases).toBe(false);
	if ('error' in cases) {
		throw new Error(cases.error);
	}
	const invalidCase = cases[0]?.items?.find((item) => item.label === 'Invalid');
	expect(invalidCase?.value).toBe('invalid');
	assert(invalidCase, 'Expected an Invalid example case.');
	await expect
		.element(screen.getByRole('separator', { name: 'Resize schema and test data sections' }))
		.toBeVisible();

	const controls = await agent.act({
		steps: [
			{ ref: 'Format data', action: 'press' },
			{ ref: 'Example test data', action: 'setValue', args: [invalidCase.value] },
			{ ref: 'Test data section', action: 'setOpen', args: [false] },
			{ ref: 'Test data section', action: 'setOpen', args: [true] },
			{ ref: 'Validation section', action: 'setOpen', args: [false] },
			{ ref: 'Validation section', action: 'setOpen', args: [true] },
			{ ref: 'Workspace layout', action: 'setLayout', args: ['62,38'] },
		],
	});
	expect(controls.ok, controls.error?.message).toBe(true);
	await expect.element(screen.getByRole('radio', { name: 'Invalid' })).toBeChecked();
	expect(
		screen.getByRole('button', { name: 'Test data' }).element().getAttribute('aria-expanded')
	).toBe('true');
	expect(
		screen
			.getByRole('button', { name: /Validation/ })
			.element()
			.getAttribute('aria-expanded')
	).toBe('true');

	const separator = screen
		.getByRole('separator', { name: 'Resize schema and test data sections' })
		.element();
	separator.dispatchEvent(new KeyboardEvent('keydown', { key: 'ArrowUp', bubbles: true }));
	await vi.waitFor(() => expect(separator.getAttribute('aria-valuenow')).toBe('60'));
}
