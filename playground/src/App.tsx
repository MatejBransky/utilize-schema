import { generate as generateEffect } from '@utilize/effect';
import { type KeywordPolicy, parse, type ParsedJSONSchema } from '@utilize/json-schema';
import { generate as generateTypeScript } from '@utilize/typescript';
import { generate as generateZod } from '@utilize/zod';
import { Button } from '@ui-sdk/react/button';
import { Input } from '@ui-sdk/react/input';
import {
	ScrollArea,
	ScrollAreaContent,
	ScrollAreaScrollbar,
	ScrollAreaThumb,
	ScrollAreaViewport,
} from '@ui-sdk/react/scroll-area';
import {
	Select,
	SelectContent,
	SelectItem,
	SelectLabel,
	SelectTrigger,
	SelectValue,
} from '@ui-sdk/react/select';
import { Tabs, TabsList, TabsPanel, TabsTab } from '@ui-sdk/react/tabs';
import { useEffect, useMemo, useRef, useState } from 'react';

import {
	buildBundle,
	detectRootId,
	normalizeName,
	parseJsonFile,
	type Problem,
	type SchemaFile,
} from './bundle';
import { collectDroppedFiles, readDroppedSchemas, type DropMode } from './drop';
import { exampleGeneratorOptions, type ExampleGeneratorOptions } from './exampleOptions';
import { defaultExampleId, exampleById, examples } from './examples';
import { formatTypeScript } from './monaco/format';
import { MonacoEditor, type MonacoEditorHandle } from './monaco/MonacoEditor';
import { defaultTarget, isTargetId, targets, type TargetId } from './targets';
import { loadColorMode, THEME_STORAGE_KEY, type ColorMode } from './theme';
import { Header } from './ui/Header';
import { CheckIcon, CloseIcon, PencilIcon, PlusIcon } from './ui/icons';
import { SelectPicker } from './ui/SelectPicker';
import { useFileDrop } from './useFileDrop';
import { validateSchemas } from './validation';

import styles from './App.module.css';

const STORAGE_KEY = 'utilize-schema-playground';
const EXAMPLE_PARAM = 'example';
const GENERATOR_PARAM = 'generator';
const KEYWORD_POLICY_PARAM = 'keyword-policy';

interface AppState {
	files: SchemaFile[];
	target: TargetId;
	keywordPolicy: KeywordPolicy;
}

const keywordPolicyOptions: Array<{ value: KeywordPolicy; label: string; hint: string }> = [
	{ value: 'error', label: 'Error', hint: 'Reject keywords outside the dialect' },
	{ value: 'warn', label: 'Warning', hint: 'Report them as warnings' },
	{ value: 'ignore', label: 'Ignore', hint: 'Do not report them' },
];

export default function App() {
	const [initial] = useState(loadState);
	const [files, setFiles] = useState<SchemaFile[]>(initial.files);
	const [target, setTarget] = useState<TargetId>(initial.target);
	const [keywordPolicy, setKeywordPolicy] = useState<KeywordPolicy>(initial.keywordPolicy);
	const [activeId, setActiveId] = useState(initial.files[0]?.id ?? '');
	const [editingId, setEditingId] = useState<string | null>(null);
	const [draftName, setDraftName] = useState('');
	const [renameError, setRenameError] = useState<string | null>(null);
	const [code, setCode] = useState('');
	const [busy, setBusy] = useState(false);
	const [generationProblems, setGenerationProblems] = useState<Problem[]>([]);
	const [cursor, setCursor] = useState({ line: 1, column: 1 });
	const [pendingPosition, setPendingPosition] = useState<{ line: number; column: number }>();
	const [colorMode, setColorMode] = useState<ColorMode>(loadColorMode);
	const [systemDark, setSystemDark] = useState(
		() => window.matchMedia('(prefers-color-scheme: dark)').matches
	);
	const [copied, setCopied] = useState(false);
	const [shared, setShared] = useState(false);
	const schemaEditorRef = useRef<MonacoEditorHandle>(null);
	const codeEditorRef = useRef<MonacoEditorHandle>(null);
	const { dragging, activeMode, drop } = useFileDrop({ onDrop: handleDrop });

	const resolvedTheme = colorMode === 'auto' ? (systemDark ? 'dark' : 'light') : colorMode;
	const monacoTheme = resolvedTheme === 'dark' ? 'utilize-dark' : 'utilize-light';
	const rootId = files[0]?.id ?? '';

	const exampleId = useMemo(() => resolveExampleId(files), [files]);
	const parsedFiles = useMemo(() => files.map(parseJsonFile), [files]);
	const schemaProblems = useMemo(() => validateSchemas(parsedFiles), [parsedFiles]);
	const bundle = useMemo(
		() => buildBundle(parsedFiles, rootId, keywordPolicy),
		[parsedFiles, rootId, keywordPolicy]
	);

	const problems = useMemo(() => {
		const generation = generationProblems.filter(
			(problem) =>
				!bundle.problems.some(
					(existing) =>
						existing.severity === problem.severity &&
						issueText(existing.message) === issueText(problem.message)
				)
		);
		const all = [...schemaProblems, ...bundle.problems, ...generation];
		const seen = new Set<string>();

		return all.filter((problem) => {
			const key = `${problem.fileId}|${problem.severity}|${problem.message}|${problem.line ?? ''}`;

			if (seen.has(key)) {
				return false;
			}
			seen.add(key);
			return true;
		});
	}, [schemaProblems, bundle.problems, generationProblems]);

	const targetOptions = useMemo(
		() =>
			targets.map((option) => ({
				value: option.value,
				label: option.label,
				hint: option.hint,
				keywords: [option.disabled ? 'coming soon' : 'available'],
				disabled: option.disabled,
			})),
		[]
	);

	const exampleOptions = useMemo(
		() =>
			examples.map((example) => ({
				value: example.id,
				label: example.name,
				hint: example.group,
				keywords: [example.group],
			})),
		[]
	);

	const errorCount = problems.filter((problem) => problem.severity === 'error').length;
	const warningCount = problems.length - errorCount;
	const active = files.find((file) => file.id === activeId) ?? files[0];

	useEffect(() => {
		if (!files.some((file) => file.id === activeId) && files[0]) {
			setActiveId(files[0].id);
		}
	}, [files, activeId]);

	useEffect(() => {
		try {
			localStorage.setItem(STORAGE_KEY, JSON.stringify({ files, target, keywordPolicy }));
		} catch {
			// Storage can be full or denied. Keep the workspace in memory.
		}
	}, [files, target, keywordPolicy]);

	useEffect(() => {
		setShared(false);
		setCopied(false);
	}, [files, target, keywordPolicy]);

	useEffect(() => {
		if (!copied) {
			return;
		}

		const timer = setTimeout(() => setCopied(false), 2000);

		return () => clearTimeout(timer);
	}, [copied]);

	useEffect(() => {
		let cancelled = false;
		setBusy(true);

		const timer = setTimeout(async () => {
			let nextCode = '';
			const nextProblems: Problem[] = [];

			if (bundle.root !== null) {
				try {
					const { root } = await parse(bundle.root as never, {
						cwd: '/',
						fileName: bundle.rootFileName,
						keywordPolicy,
						onDialectIssue: () => {},
					});

					const rawCode = generateCodeFor(
						target,
						root,
						exampleId ? exampleGeneratorOptions[exampleId] : undefined
					);

					nextCode = cancelled ? nextCode : await formatTypeScript(rawCode).catch(() => rawCode);
				} catch (error) {
					nextProblems.push({
						severity: 'error',
						message: error instanceof Error ? error.message : String(error),
					});
				}
			}

			if (!cancelled) {
				setCode(nextCode);
				setGenerationProblems(nextProblems);
				setBusy(false);
			}
		}, 300);

		return () => {
			cancelled = true;
			clearTimeout(timer);
		};
	}, [bundle, exampleId, target, keywordPolicy]);

	useEffect(() => {
		const query = window.matchMedia('(prefers-color-scheme: dark)');
		const onChange = (event: MediaQueryListEvent) => setSystemDark(event.matches);

		query.addEventListener('change', onChange);
		setSystemDark(query.matches);

		return () => query.removeEventListener('change', onChange);
	}, []);

	useEffect(() => {
		document.documentElement.dataset.theme = resolvedTheme;

		try {
			localStorage.setItem(THEME_STORAGE_KEY, colorMode);
		} catch {
			// Theme persistence is optional.
		}
	}, [colorMode, resolvedTheme]);

	useEffect(() => {
		if (!pendingPosition) {
			return;
		}

		schemaEditorRef.current?.focusAt(pendingPosition.line, pendingPosition.column);
		setPendingPosition(undefined);
	}, [pendingPosition]);

	useEffect(() => {
		const url = new URL(location.href);

		if (!url.hash && url.searchParams.get(GENERATOR_PARAM) !== target) {
			updateUrl({ [GENERATOR_PARAM]: target }, 'replace');
		}
	}, []);

	useEffect(() => {
		const url = new URL(location.href);

		if (!url.hash && url.searchParams.get(KEYWORD_POLICY_PARAM) !== keywordPolicy) {
			updateUrl({ [KEYWORD_POLICY_PARAM]: keywordPolicy }, 'replace');
		}
	}, [keywordPolicy]);

	useEffect(() => {
		const onPopState = () => {
			applyState(loadState());
		};

		window.addEventListener('popstate', onPopState);

		return () => window.removeEventListener('popstate', onPopState);
	}, []);

	function applyState(next: AppState) {
		setFiles(next.files);
		setTarget(next.target);
		setKeywordPolicy(next.keywordPolicy);
		setActiveId(next.files[0]?.id ?? '');
		setEditingId(null);
	}

	useEffect(() => {
		if (!editingId) {
			return;
		}

		const onPointerDown = (event: PointerEvent) => {
			const clickTarget = event.target;

			if (
				clickTarget instanceof Element &&
				(clickTarget.closest('[data-rename-input]') || clickTarget.closest('[data-confirm-rename]'))
			) {
				return;
			}

			setEditingId(null);
		};

		document.addEventListener('pointerdown', onPointerDown, true);

		return () => document.removeEventListener('pointerdown', onPointerDown, true);
	}, [editingId]);

	function updateFile(id: string, patch: Partial<SchemaFile>) {
		clearExampleUrl();
		setFiles((current) => current.map((file) => (file.id === id ? { ...file, ...patch } : file)));
	}

	function addFile() {
		const id = newFileId();
		const name = uniqueName('untitled.json', files);

		clearExampleUrl();

		setFiles((current) => [...current, { id, name, content: '{\n  "type": "object"\n}' }]);
		setActiveId(id);
	}

	async function handleDrop(dataTransfer: DataTransfer, mode: DropMode) {
		const schemas = await readDroppedSchemas(await collectDroppedFiles(dataTransfer)).catch(
			() => null
		);

		if (!schemas || schemas.length === 0) {
			return;
		}

		const base = mode === 'replace' ? [] : files;
		const added: SchemaFile[] = [];

		for (const schema of schemas) {
			added.push({
				id: newFileId(),
				name: uniqueName(schema.name, [...base, ...added]),
				content: schema.content,
			});
		}

		clearExampleUrl();
		setEditingId(null);

		if (mode === 'add') {
			setFiles([...files, ...added]);
			setActiveId(added[0]!.id);
			return;
		}

		const detectedRootId = detectRootId(added) ?? added[0]!.id;
		const root = added.find((file) => file.id === detectedRootId) ?? added[0]!;

		setFiles([root, ...added.filter((file) => file.id !== root.id)]);
		setActiveId(root.id);
	}

	function closeFile(id: string) {
		if (files.length <= 1) {
			return;
		}

		const next = files.filter((file) => file.id !== id);

		clearExampleUrl();
		if (editingId === id) {
			setEditingId(null);
		}
		setFiles(next);
		if (activeId === id) {
			setActiveId(next[0]!.id);
		}
	}

	function startRename(file: SchemaFile) {
		setEditingId(file.id);
		setDraftName(file.name);
		setRenameError(null);
	}

	function commitRename() {
		if (!editingId) {
			return;
		}

		const name = draftName.trim();

		if (
			name &&
			files.some(
				(file) => file.id !== editingId && normalizeName(file.name) === normalizeName(name)
			)
		) {
			setRenameError('A file with this name already exists.');
			return;
		}

		setRenameError(null);
		if (name) {
			updateFile(editingId, { name });
		}
		setEditingId(null);
	}

	function applyExample(id: string) {
		const example = exampleById(id);

		if (!example) {
			return;
		}

		setFiles(example.files);
		setActiveId(example.files[0]?.id ?? '');
		setEditingId(null);
		setExampleUrl(example.id, 'push');
	}

	function applyGenerator(id: TargetId) {
		setTarget(id);
		updateUrl({ [GENERATOR_PARAM]: id }, 'push');
	}

	function applyKeywordPolicy(policy: KeywordPolicy) {
		setKeywordPolicy(policy);
		updateUrl({ [KEYWORD_POLICY_PARAM]: policy }, 'push');
	}

	function setExampleUrl(id: string | null, mode: 'push' | 'replace') {
		updateUrl({ [EXAMPLE_PARAM]: id }, mode);
	}

	function updateUrl(values: Record<string, string | null>, mode: 'push' | 'replace') {
		const url = new URL(location.href);

		for (const [key, value] of Object.entries(values)) {
			if (value === null) {
				url.searchParams.delete(key);
			} else {
				url.searchParams.set(key, value);
			}
		}
		url.hash = '';

		const href = `${url.pathname}${url.search}`;

		if (mode === 'push') {
			history.pushState(null, '', href);
		} else {
			history.replaceState(null, '', href);
		}
	}

	function clearExampleUrl() {
		const url = new URL(location.href);

		if (url.searchParams.has(EXAMPLE_PARAM) || url.hash) {
			setExampleUrl(null, 'replace');
		}
	}

	async function copyCode() {
		const text = codeEditorRef.current?.getValue() ?? code;

		try {
			await navigator.clipboard.writeText(text);
			setCopied(true);
		} catch {
			setCopied(false);
		}
	}

	async function share() {
		const encoded = encodeState({ files, target, keywordPolicy });
		const url = new URL(location.href);

		url.searchParams.delete(EXAMPLE_PARAM);
		url.searchParams.delete(GENERATOR_PARAM);
		url.searchParams.set(KEYWORD_POLICY_PARAM, keywordPolicy);
		url.hash = `data=${encoded}`;
		history.replaceState(null, '', url);
		setShared(true);

		try {
			await navigator.clipboard.writeText(url.href);
		} catch {
			// The URL hash is still updated even when clipboard access is denied.
		}
	}

	function selectProblem(problem: Problem) {
		if (problem.fileId) {
			setActiveId(problem.fileId);
		}

		setPendingPosition({
			line: problem.line ?? 1,
			column: problem.column ?? 1,
		});
	}

	if (!active) {
		return <main className={styles.empty}>Add a JSON Schema file to start.</main>;
	}

	return (
		<div className={styles.app}>
			<Header
				colorMode={colorMode}
				onColorModeChange={setColorMode}
				onShare={share}
				shared={shared}
			>
				<div className={styles.generatorPicker}>
					<SelectPicker
						label="Generator"
						placeholder="Choose a generator"
						value={target}
						options={targetOptions}
						onChange={(value) => {
							if (isAvailableTarget(value)) {
								applyGenerator(value);
							}
						}}
					/>
				</div>
				<div className={styles.examplePicker}>
					<SelectPicker
						label="Example"
						placeholder="Custom schema"
						value={exampleId}
						options={exampleOptions}
						onChange={applyExample}
					/>
				</div>
				<div className={styles.policyPicker}>
					<Select
						items={keywordPolicyOptions.map(({ value, label }) => ({ value, label }))}
						value={keywordPolicy}
						onValueChange={(value) => {
							if (isKeywordPolicy(value)) {
								applyKeywordPolicy(value);
							}
						}}
					>
						<SelectLabel>Keyword policy</SelectLabel>
						<SelectTrigger>
							<SelectValue />
						</SelectTrigger>
						<SelectContent className={styles.policyContent}>
							{keywordPolicyOptions.map((option) => (
								<SelectItem key={option.value} value={option.value} title={option.hint}>
									{option.label}
								</SelectItem>
							))}
						</SelectContent>
					</Select>
				</div>
			</Header>

			<main className={styles.workspace}>
				<section className={`${styles.pane} ${styles.schemaPane}`}>
					<Tabs
						className={styles.tabs}
						value={active.id}
						onValueChange={(value) => {
							if (value) {
								setActiveId(value);
							}
						}}
					>
						<div className={styles.tabBar}>
							<TabsList
								aria-label="Schema files"
								className={styles.tabList}
								data-testid="file-tabs"
							>
								{files.map((file, index) => {
									const hasError = problems.some(
										(problem) => problem.fileId === file.id && problem.severity === 'error'
									);
									const editing = editingId === file.id;

									return (
										<div key={file.id} className={styles.tabItem} role="presentation">
											<TabsTab value={file.id} className={styles.tab} render={<div />}>
												{index === 0 ? (
													<>
														<span className={styles.rootBadge}>root</span>{' '}
													</>
												) : null}
												<span
													className={`${styles.tabName} ${editing ? styles.tabNameHidden : ''}`}
												>
													{file.name}
												</span>
												{editing ? (
													<Input
														className={styles.tabInput}
														aria-label="File name"

														aria-invalid={renameError ? true : undefined}

														title={renameError ?? undefined}
														data-rename-input=""
														value={draftName}
														autoFocus
														onValueChange={setDraftName}
														onFocus={(event) => event.currentTarget.select()}
														onKeyDown={(event) => {
															if (event.key === 'Enter') {
																event.preventDefault();
																commitRename();
															} else if (event.key === 'Escape') {
																setEditingId(null);
															}
														}}
													/>
												) : null}
												{hasError ? <span className={styles.tabError} aria-hidden="true" /> : null}
											</TabsTab>
											<span className={styles.tabActions}>
												<Button
													className={styles.tabIcon}
													aria-label={editing ? 'Confirm rename' : `Rename ${file.name}`}
													data-confirm-rename=""
													onClick={() => {
														if (editing) {
															commitRename();
														} else {
															startRename(file);
														}
													}}
												>
													{editing ? <CheckIcon /> : <PencilIcon />}
												</Button>
												{editing ? null : (
													<Button
														className={styles.tabIcon}
														aria-label={`Close ${file.name}`}
														disabled={files.length <= 1}
														data-agent-confirm="Deletes this file and its schema from the playground"
														onClick={() => closeFile(file.id)}
													>
														<CloseIcon />
													</Button>
												)}
											</span>
										</div>
									);
								})}
							</TabsList>
							<Button className={styles.addTab} aria-label="Add file" onClick={addFile}>
								<PlusIcon />
							</Button>
							{renameError ? (
								<span className={styles.renameError} role="alert">
									{renameError}
								</span>
							) : null}
						</div>

						{files.map((file) => (
							<TabsPanel key={file.id} value={file.id} className={styles.editorPanel}>
								<div className={styles.editorFill}>
									<MonacoEditor
										ref={file.id === active.id ? schemaEditorRef : undefined}
										testId="schema-editor"
										ariaLabel={`${file.name} schema`}
										language="json"
										theme={monacoTheme}
										value={file.content}
										onChange={(content) => updateFile(file.id, { content })}
										onCursorChange={(line, column) => setCursor({ line, column })}
									/>
								</div>
							</TabsPanel>
						))}

						<div className={styles.statusBar}>
							<span>{active.name}</span>
							<span>
								Ln {cursor.line}, Col {cursor.column}
							</span>
							<span className={styles.statusActions}>
								<span>{active.content.length} chars</span>
								<Button
									className={styles.statusButton}
									onClick={() => schemaEditorRef.current?.format()}
								>
									Format schema
								</Button>
							</span>
						</div>
					</Tabs>
					{dragging ? (
						<div
							className={styles.dropOverlay}
							role="group"
							aria-label="Import JSON Schema files"
							data-testid="file-drop-overlay"
						>
							<div
								className={styles.dropTarget}
								data-drop-mode="add"
								data-active={activeMode === 'add' ? 'true' : undefined}
								onDrop={(event) => drop(event, 'add')}
							>
								<span className={styles.dropKicker}>Add</span>
								<h2 className={styles.dropTitle}>Add to this workspace</h2>
								<p className={styles.dropText}>
									Keep the files already open and add every dropped JSON schema as a new tab.
								</p>
								<span className={styles.dropHint}>Folders are loaded recursively.</span>
							</div>
							<div
								className={styles.dropTarget}
								data-drop-mode="replace"
								data-active={activeMode === 'replace' ? 'true' : undefined}
								onDrop={(event) => drop(event, 'replace')}
							>
								<span className={styles.dropKicker}>Replace</span>
								<h2 className={styles.dropTitle}>Start from the dropped files</h2>
								<p className={styles.dropText}>
									Close the current files and open only the dropped JSON schemas as tabs.
								</p>
								<span className={styles.dropHint}>Folders are loaded recursively.</span>
							</div>
						</div>
					) : null}
				</section>

				<section className={`${styles.pane} ${styles.outputPane}`}>
					<div className={styles.outputHeader}>
						<h2 className={styles.heading}>Generated TypeScript</h2>
						<div className={styles.outputActions}>
							{busy ? <span className={styles.muted}>Generating…</span> : null}
							<Button onClick={copyCode} disabled={!code || busy}>
								{copied ? 'Copied' : 'Copy code'}
							</Button>
						</div>
					</div>

					<MonacoEditor
						ref={codeEditorRef}
						testId="generated-code"
						ariaLabel="Generated TypeScript"
						language="typescript"
						path="file:///playground/generated.ts"
						resolveEffectTypes={target === 'effect'}
						theme={monacoTheme}
						value={code || '// Generated code will appear here'}
						readOnly
					/>

					<div className={styles.problems} data-testid="problems">
						<div className={styles.problemsHeader}>
							<h2 className={styles.heading}>Validation</h2>
							<span className={styles.counts} data-severity={errorCount > 0 ? 'error' : 'ok'}>
								{errorCount} errors, {warningCount} warnings
							</span>
						</div>
						{problems.length === 0 ? (
							<p className={styles.ok}>No problems found.</p>
						) : (
							<ScrollArea className={styles.problemScroll} type="auto">
								<ScrollAreaViewport className={styles.problemViewport}>
									<ScrollAreaContent>
										{problems.map((problem) => (
											<Button
												key={`${problem.fileId ?? ''}|${problem.severity}|${problem.line ?? ''}|${problem.column ?? ''}|${problem.message}`}
												className={styles.problem}
												onClick={() => selectProblem(problem)}
											>
												<span className={styles.severity}>
													{problem.severity === 'error' ? 'Error' : 'Warning'}
												</span>
												<span className={styles.problemFile}>
													{files.find((file) => file.id === problem.fileId)?.name ?? 'project'}
												</span>
												<span className={styles.problemMessage}>
													{problem.message}
													{problem.line
														? ` (line ${problem.line}${problem.column ? `, col ${problem.column}` : ''})`
														: ''}
												</span>
											</Button>
										))}
									</ScrollAreaContent>
								</ScrollAreaViewport>
								<ScrollAreaScrollbar orientation="vertical">
									<ScrollAreaThumb />
								</ScrollAreaScrollbar>
							</ScrollArea>
						)}
					</div>
				</section>
			</main>
		</div>
	);
}

function defaultState(): AppState {
	const example = exampleById(defaultExampleId)!;

	return {
		files: example.files,
		target: defaultTarget,
		keywordPolicy: 'warn',
	};
}

function loadState(): AppState {
	const fromHash = readHash() ?? readUrlState() ?? loadSavedState() ?? defaultState();
	const keywordPolicy = readKeywordPolicyParam();

	// The `keyword-policy` query parameter wins over the policy stored in the
	// shared `#data=` hash so the setting can be changed without editing the hash.
	return keywordPolicy ? { ...fromHash, keywordPolicy } : fromHash;
}

function readUrlState(): AppState | null {
	const url = new URL(location.href);
	const target = readGeneratorParam();
	const keywordPolicy = readKeywordPolicyParam();
	const example = exampleById(url.searchParams.get(EXAMPLE_PARAM));
	const base = loadSavedState() ?? defaultState();
	const policy = keywordPolicy ?? base.keywordPolicy;

	if (example) {
		return {
			files: example.files,
			target: target ?? defaultTarget,
			keywordPolicy: policy,
		};
	}

	if (target || keywordPolicy) {
		return {
			files: base.files,
			target: target ?? base.target,
			keywordPolicy: policy,
		};
	}

	return null;
}

function readGeneratorParam(): TargetId | null {
	const id = new URL(location.href).searchParams.get(GENERATOR_PARAM);

	return isAvailableTarget(id) ? id : null;
}

function readKeywordPolicyParam(): KeywordPolicy | null {
	const value = new URL(location.href).searchParams.get(KEYWORD_POLICY_PARAM);

	return isKeywordPolicy(value) ? value : null;
}

function loadSavedState(): AppState | null {
	try {
		return normalizeState(JSON.parse(localStorage.getItem(STORAGE_KEY) ?? 'null'));
	} catch {
		// Ignore malformed saved state and fall back to the default example.
		return null;
	}
}

function isSchemaFile(value: unknown): value is SchemaFile {
	if (!value || typeof value !== 'object') {
		return false;
	}

	const file = value as SchemaFile;

	return (
		typeof file.id === 'string' && typeof file.name === 'string' && typeof file.content === 'string'
	);
}

function isAvailableTarget(value: unknown): value is TargetId {
	return isTargetId(value) && targets.some((target) => target.value === value && !target.disabled);
}

function isKeywordPolicy(value: unknown): value is KeywordPolicy {
	return value === 'error' || value === 'warn' || value === 'ignore';
}

function issueText(message: string): string {
	return message.replace(/\s+\([^()]*\)$/, '');
}

function normalizeState(value: unknown): AppState | null {
	if (!value || typeof value !== 'object') {
		return null;
	}

	const state = value as Partial<AppState>;

	if (!Array.isArray(state.files) || state.files.length === 0 || !state.files.every(isSchemaFile)) {
		return null;
	}

	return {
		files: state.files,
		target: isAvailableTarget(state.target) ? state.target : defaultTarget,
		keywordPolicy: isKeywordPolicy(state.keywordPolicy) ? state.keywordPolicy : 'warn',
	};
}

function resolveExampleId(files: SchemaFile[]): string | null {
	const match = examples.find(
		(example) =>
			example.files.length === files.length &&
			files.every((file) => {
				const exampleFile = example.files.find((item) => item.id === file.id);

				return (
					exampleFile !== undefined &&
					exampleFile.name === file.name &&
					exampleFile.content === file.content
				);
			})
	);

	return match?.id ?? null;
}

function readHash(): AppState | null {
	if (!location.hash.startsWith('#data=')) {
		return null;
	}

	try {
		const base64 = location.hash.slice('#data='.length).replace(/-/g, '+').replace(/_/g, '/');
		const binary = atob(base64.padEnd(Math.ceil(base64.length / 4) * 4, '='));
		const bytes = Uint8Array.from(binary, (char) => char.charCodeAt(0));
		const parsed = JSON.parse(new TextDecoder().decode(bytes));

		return normalizeState(parsed);
	} catch {
		return null;
	}
}

function encodeState(state: AppState): string {
	const bytes = new TextEncoder().encode(JSON.stringify(state));
	let binary = '';

	for (const byte of bytes) {
		binary += String.fromCharCode(byte);
	}

	return btoa(binary).replace(/\+/g, '-').replace(/\//g, '_').replace(/=+$/, '');
}

let fileCounter = 0;

function newFileId(): string {
	fileCounter += 1;

	return globalThis.crypto?.randomUUID?.() ?? `file-${Date.now()}-${fileCounter}`;
}

function uniqueName(base: string, files: SchemaFile[]): string {
	const names = new Set(files.map((file) => file.name.toLowerCase()));

	if (!names.has(base.toLowerCase())) {
		return base;
	}

	const dot = base.lastIndexOf('.');
	const stem = dot > 0 ? base.slice(0, dot) : base;
	const extension = dot > 0 ? base.slice(dot) : '';
	let counter = 2;

	while (names.has(`${stem}-${counter}${extension}`.toLowerCase())) {
		counter += 1;
	}

	return `${stem}-${counter}${extension}`;
}

function generateCodeFor(
	target: TargetId,
	root: ParsedJSONSchema,
	options?: ExampleGeneratorOptions
): string {
	switch (target) {
		case 'effect':
			return generateEffect(root, { importEffect: true, ...options?.effect });
		case 'typescript':
			return generateTypeScript(root, { ...options?.typescript });
		case 'zod':
			return generateZod(root, { importZod: true, ...options?.zod });
		default:
			throw new Error(`The ${target} generator is not available yet.`);
	}
}
