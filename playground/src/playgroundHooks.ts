import { parse } from '@utilize/json-schema';
import type { KeywordPolicy } from '@utilize/json-schema';
import { useEffect, useMemo, useRef, useState, useSyncExternalStore } from 'react';
import type { RefObject } from 'react';

import { buildBundle, detectRootId, normalizeName, parseJsonFile } from './bundle';
import type { Problem, SchemaFile } from './bundle';
import { collectDroppedFiles, readDroppedSchemas } from './drop';
import type { DropMode } from './drop';
import { generatorOptionsFor } from './exampleOptions';
import { exampleById, exampleCaseForData, exampleData, examples } from './examples';
import type { FormatMode } from './formatMode';
import { generateCodeFor } from './generateCode';
import type { RuntimeSource } from './generateCode';
import { formatTypeScript } from './monaco/format';
import type { MonacoEditorHandle } from './monaco/MonacoEditor';
import { collectProblems } from './problems';
import { clearExampleUrl, playgroundParams, setExampleUrl, updateUrl } from './playgroundUrl';
import {
	encodeState,
	loadState,
	newFileId,
	PLAYGROUND_STORAGE_KEY,
	resolveExampleId,
	uniqueName,
} from './playgroundState';
import { targets } from './targets';
import type { TargetId } from './targets';
import { loadColorMode, THEME_STORAGE_KEY } from './theme';
import type { ColorMode } from './theme';
import { isElement } from './dom';
import { useFileDrop } from './useFileDrop';
import { useDataDrop } from './useDataDrop';
import { useWorkspaceLayout } from './useWorkspaceLayout';
import type { UrlState } from './urlState';
import { validateSchemas } from './validation';
import { useValidatorResults } from './validator/useValidatorResults';

const targetOptions = targets.map((option) => ({
	value: option.value,
	label: option.label,
	keywords: [option.disabled ? 'coming soon' : 'available'],
	disabled: option.disabled,
}));

const exampleOptions = examples.map((example) => ({
	value: example.id,
	label: example.name,
	keywords: [example.group],
}));

interface SettingsSetters {
	setTarget(target: TargetId): void;
	setKeywordPolicy(policy: KeywordPolicy): void;
	setFormatMode(mode: FormatMode): void;
	setInferFormatAsString(value: boolean): void;
	setData(data: string): void;
}

export function usePlayground() {
	const [initial] = useState(loadState);
	const settings = useGeneratorSettings(initial);
	const testData = useTestData(initial.data);
	const workspace = useSchemaFiles(initial.files, { ...settings, setData: testData.setData });
	const generation = useGeneration(
		workspace.files,
		settings.target,
		settings.keywordPolicy,
		settings.formatMode,
		settings.inferFormatAsString
	);
	const theme = useTheme();
	const editors = useEditorNavigation(workspace.setActiveId);
	const layout = useWorkspaceLayout();
	const dataDrop = useDataDrop({
		collapsed: layout.dataCollapsed,
		onData: testData.updateData,
	});
	const validation = useValidatorResults(
		settings.target,
		generation.runtime,
		testData.data,
		generation.busy
	);
	const feedback = useFeedback(
		workspace.files,
		settings.target,
		settings.keywordPolicy,
		settings.formatMode,
		settings.inferFormatAsString,
		generation.code,
		testData.data,
		editors.codeEditorRef
	);
	const { activeExample, activeCase, applyExample } = useExampleSelection(
		generation.exampleId,
		testData.data,
		(files) => workspace.applyExample(files),
		testData.setData
	);

	useWorkspacePersistence({
		files: workspace.files,
		target: settings.target,
		keywordPolicy: settings.keywordPolicy,
		formatMode: settings.formatMode,
		inferFormatAsString: settings.inferFormatAsString,
		data: testData.data,
	});

	return {
		...settings,
		...workspace,
		...generation,
		...theme,
		...editors,
		...feedback,
		...testData,
		validation,
		layout,
		dataDrop,
		activeExample,
		activeCase,
		applyExample,
		targetOptions,
		exampleOptions,
	};
}

export type Playground = ReturnType<typeof usePlayground>;

interface PersistedWorkspace {
	files: SchemaFile[];
	target: TargetId;
	keywordPolicy: KeywordPolicy;
	formatMode: FormatMode;
	inferFormatAsString: boolean;
	data: string;
}

function useWorkspacePersistence({
	files,
	target,
	keywordPolicy,
	formatMode,
	inferFormatAsString,
	data,
}: PersistedWorkspace) {
	useEffect(() => {
		try {
			localStorage.setItem(
				PLAYGROUND_STORAGE_KEY,
				JSON.stringify({ files, target, keywordPolicy, formatMode, inferFormatAsString, data })
			);
		} catch {
			// Storage can be full or denied. Keep the workspace in memory.
		}
	}, [files, target, keywordPolicy, formatMode, inferFormatAsString, data]);
}

interface ExampleSelection {
	activeExample: ReturnType<typeof exampleById>;
	activeCase: ReturnType<typeof exampleCaseForData>;
	applyExample: (id: string) => void;
}

function useExampleSelection(
	exampleId: string | null,
	data: string,
	applyFiles: (files: SchemaFile[]) => void,
	setData: (data: string) => void
): ExampleSelection {
	const activeExample = exampleById(exampleId);
	const activeCase = activeExample ? exampleCaseForData(activeExample, data) : undefined;

	function applyExample(id: string) {
		const example = examples.find((candidate) => candidate.id === id);

		if (!example) {
			return;
		}

		applyFiles(example.files);
		setData(exampleData(example));
		setExampleUrl(example.id, 'push');
	}

	return { activeExample, activeCase, applyExample };
}

function useGeneratorSettings(initial: UrlState) {
	const [target, setTarget] = useState<TargetId>(initial.target);
	const [keywordPolicy, setKeywordPolicy] = useState<KeywordPolicy>(initial.keywordPolicy);
	const [formatMode, setFormatMode] = useState<FormatMode>(initial.formatMode);
	const [inferFormatAsString, setInferFormatAsString] = useState(initial.inferFormatAsString);

	useEffect(() => {
		const url = new URL(location.href);

		if (
			url.hash ||
			(url.searchParams.get(playgroundParams.generator) === target &&
				url.searchParams.get(playgroundParams.keywordPolicy) === keywordPolicy &&
				url.searchParams.get(playgroundParams.formatMode) === formatMode &&
				url.searchParams.get(playgroundParams.inferFormatAsString) === String(inferFormatAsString))
		) {
			return;
		}

		updateUrl(
			{
				[playgroundParams.generator]: target,
				[playgroundParams.keywordPolicy]: keywordPolicy,
				[playgroundParams.formatMode]: formatMode,
				[playgroundParams.inferFormatAsString]: String(inferFormatAsString),
			},
			'replace'
		);
	}, [target, keywordPolicy, formatMode, inferFormatAsString]);

	function applyGenerator(id: TargetId) {
		setTarget(id);
		updateUrl({ [playgroundParams.generator]: id }, 'push');
	}

	function applyKeywordPolicy(policy: KeywordPolicy) {
		setKeywordPolicy(policy);
		updateUrl({ [playgroundParams.keywordPolicy]: policy }, 'push');
	}

	function applyFormatMode(mode: FormatMode) {
		setFormatMode(mode);
		updateUrl({ [playgroundParams.formatMode]: mode }, 'push');
	}

	function applyInferFormatAsString(value: boolean) {
		setInferFormatAsString(value);
		updateUrl({ [playgroundParams.inferFormatAsString]: String(value) }, 'push');
	}

	return {
		target,
		keywordPolicy,
		formatMode,
		inferFormatAsString,
		setTarget,
		setKeywordPolicy,
		setFormatMode,
		setInferFormatAsString,
		applyGenerator,
		applyKeywordPolicy,
		applyFormatMode,
		applyInferFormatAsString,
	};
}

function useTestData(initial: string) {
	const [data, setData] = useState(initial);

	function updateData(content: string) {
		// The editor also reports programmatic value changes (for example when an
		// example loads); those must keep the example URL intact.
		if (content === data) {
			return;
		}

		clearExampleUrl();
		setData(content);
	}

	return { data, setData, updateData };
}

function useSchemaFiles(initialFiles: SchemaFile[], settings: SettingsSetters) {
	const [files, setFiles] = useState<SchemaFile[]>(initialFiles);
	const [activeId, setActiveId] = useState(initialFiles[0]?.id ?? '');
	const [editingId, setEditingId] = useState<string | null>(null);
	const [draftName, setDraftName] = useState('');
	const [renameError, setRenameError] = useState<string | null>(null);
	const { dragging, activeMode, drop } = useFileDrop({
		onDrop: (dataTransfer, mode) => {
			void handleDrop(dataTransfer, mode);
		},
	});

	// A restored or dropped workspace can remove the selected file. Derive a
	// usable id during render instead of repairing the state in an effect.
	const activeFile = files.find((file) => file.id === activeId) ?? files[0];
	const currentId = activeFile?.id ?? '';

	useEffect(() => {
		const onPopState = () => {
			const next = loadState();
			setFiles(next.files);
			settings.setTarget(next.target);
			settings.setKeywordPolicy(next.keywordPolicy);
			settings.setFormatMode(next.formatMode);
			settings.setInferFormatAsString(next.inferFormatAsString);
			settings.setData(next.data);
			setActiveId(next.files[0]?.id ?? '');
			setEditingId(null);
		};

		window.addEventListener('popstate', onPopState);

		return () => window.removeEventListener('popstate', onPopState);
	}, [settings]);

	useEffect(() => {
		if (!editingId) {
			return;
		}

		const onPointerDown = (event: PointerEvent) => {
			const clickTarget = event.target;

			if (
				isElement(clickTarget) &&
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
			setActiveId(added[0].id);
			return;
		}

		const detectedRootId = detectRootId(added) ?? added[0].id;
		const root = added.find((file) => file.id === detectedRootId) ?? added[0];

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
			setActiveId(next[0].id);
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

	function applyExample(nextFiles: SchemaFile[]) {
		setFiles(nextFiles);
		setActiveId(nextFiles[0]?.id ?? '');
		setEditingId(null);
	}

	return {
		files,
		activeId: currentId,
		setActiveId,
		editingId,
		setEditingId,
		draftName,
		setDraftName,
		renameError,
		updateFile,
		addFile,
		closeFile,
		startRename,
		commitRename,
		applyExample,
		dragging,
		activeMode,
		drop,
	};
}

function useGeneration(
	files: SchemaFile[],
	target: TargetId,
	keywordPolicy: KeywordPolicy,
	formatMode: FormatMode,
	inferFormatAsString: boolean
) {
	const [code, setCode] = useState('');
	const [runtime, setRuntime] = useState<RuntimeSource | null>(null);
	const [busy, setBusy] = useState(false);
	const [generationProblems, setGenerationProblems] = useState<Problem[]>([]);
	const rootId = files[0]?.id ?? '';
	const exampleId = useMemo(() => resolveExampleId(files), [files]);
	const parsedFiles = useMemo(() => files.map(parseJsonFile), [files]);
	const schemaProblems = useMemo(() => validateSchemas(parsedFiles), [parsedFiles]);
	const bundle = useMemo(
		() => buildBundle(parsedFiles, rootId, keywordPolicy),
		[parsedFiles, rootId, keywordPolicy]
	);
	const problems = useMemo(
		() => collectProblems(schemaProblems, bundle.problems, generationProblems),
		[schemaProblems, bundle.problems, generationProblems]
	);

	useEffect(() => {
		let cancelled = false;
		setBusy(true);

		async function generate() {
			const next = await generateOutput(
				bundle,
				target,
				keywordPolicy,
				formatMode,
				inferFormatAsString,
				exampleId
			);

			if (!cancelled) {
				setCode(next.code);
				setRuntime(next.runtime);
				setGenerationProblems(next.problems);
				setBusy(false);
			}
		}

		const timer = setTimeout(() => {
			void generate();
		}, 300);

		return () => {
			cancelled = true;
			clearTimeout(timer);
		};
	}, [bundle, exampleId, target, keywordPolicy, formatMode, inferFormatAsString]);

	return { exampleId, problems, code, runtime, busy };
}

async function generateOutput(
	bundle: ReturnType<typeof buildBundle>,
	target: TargetId,
	keywordPolicy: KeywordPolicy,
	formatMode: FormatMode,
	inferFormatAsString: boolean,
	exampleId: string | null
): Promise<{ code: string; runtime: RuntimeSource | null; problems: Problem[] }> {
	let nextCode = '';
	const nextProblems: Problem[] = [];
	let nextRuntime: RuntimeSource | null = null;

	if (bundle.root !== null) {
		try {
			// `parse` resolves the schema in place, so every run gets a copy;
			// otherwise switching targets reuses names chosen for the previous one.
			const { root } = await parse(structuredClone(bundle.root), {
				cwd: '/',
				fileName: bundle.rootFileName,
				keywordPolicy,
				onDialectIssue: () => {},
			});

			const generatorOptions = exampleId ? generatorOptionsFor(exampleId) : undefined;
			const generated = generateCodeFor(
				target,
				root,
				formatMode,
				generatorOptions,
				inferFormatAsString
			);

			nextRuntime = generated.runtime;

			if (generated.runtime?.status === 'failed') {
				nextProblems.push({ severity: 'error', message: generated.runtime.error.message });
			} else {
				const formatCode =
					generatorOptions?.format ??
					((source: string) => formatTypeScript(source).catch(() => source));

				nextCode = await formatCode(generated.code);
			}
		} catch (error) {
			nextProblems.push({
				severity: 'error',
				message: error instanceof Error ? error.message : String(error),
			});
		}
	}

	return { code: nextCode, runtime: nextRuntime, problems: nextProblems };
}

function subscribeSystemDark(onChange: () => void): () => void {
	const query = window.matchMedia('(prefers-color-scheme: dark)');

	query.addEventListener('change', onChange);

	return () => query.removeEventListener('change', onChange);
}

function systemDarkSnapshot(): boolean {
	return window.matchMedia('(prefers-color-scheme: dark)').matches;
}

function useTheme() {
	const [colorMode, setColorMode] = useState<ColorMode>(loadColorMode);
	const systemDark = useSyncExternalStore(subscribeSystemDark, systemDarkSnapshot, () => false);
	const resolvedTheme = colorMode === 'auto' ? (systemDark ? 'dark' : 'light') : colorMode;
	const monacoTheme = resolvedTheme === 'dark' ? 'utilize-dark' : 'utilize-light';

	useEffect(() => {
		document.documentElement.dataset.theme = resolvedTheme;

		try {
			localStorage.setItem(THEME_STORAGE_KEY, colorMode);
		} catch {
			// Theme persistence is optional.
		}
	}, [colorMode, resolvedTheme]);

	return { colorMode, setColorMode, resolvedTheme, monacoTheme };
}

function useEditorNavigation(setActiveId: (id: string) => void) {
	const schemaEditorRef = useRef<MonacoEditorHandle>(null);
	const dataEditorRef = useRef<MonacoEditorHandle>(null);
	const codeEditorRef = useRef<MonacoEditorHandle>(null);
	const [cursor, setCursor] = useState({ line: 1, column: 1 });
	const [pendingPosition, setPendingPosition] = useState<{ line: number; column: number }>();

	useEffect(() => {
		if (!pendingPosition) {
			return;
		}

		schemaEditorRef.current?.focusAt(pendingPosition.line, pendingPosition.column);
		setPendingPosition(undefined);
	}, [pendingPosition]);

	function selectProblem(problem: Problem) {
		if (problem.fileId) {
			setActiveId(problem.fileId);
		}

		setPendingPosition({
			line: problem.line ?? 1,
			column: problem.column ?? 1,
		});
	}

	return {
		schemaEditorRef,
		dataEditorRef,
		codeEditorRef,
		cursor,
		setCursor,
		selectProblem,
	};
}

interface FeedbackSnapshot {
	files: SchemaFile[];
	target: TargetId;
	keywordPolicy: KeywordPolicy;
	formatMode: FormatMode;
	inferFormatAsString: boolean;
	data: string;
}

function useFeedback(
	files: SchemaFile[],
	target: TargetId,
	keywordPolicy: KeywordPolicy,
	formatMode: FormatMode,
	inferFormatAsString: boolean,
	code: string,
	data: string,
	codeEditorRef: RefObject<MonacoEditorHandle | null>
) {
	const [sharedSnapshot, setSharedSnapshot] = useState<FeedbackSnapshot | null>(null);
	const [copy, setCopy] = useState<{ value: string; id: number } | null>(null);

	// Both flags describe the input they were produced from, so they expire by
	// derivation instead of being reset by an effect on every edit.
	const shared =
		sharedSnapshot !== null &&
		sharedSnapshot.files === files &&
		sharedSnapshot.target === target &&
		sharedSnapshot.keywordPolicy === keywordPolicy &&
		sharedSnapshot.formatMode === formatMode &&
		sharedSnapshot.inferFormatAsString === inferFormatAsString &&
		sharedSnapshot.data === data;
	const copied = copy !== null && copy.value === code;

	// Timers are a real side effect; the flag itself is derived above.
	useEffect(() => {
		if (copy === null) {
			return;
		}

		const timer = setTimeout(() => setCopy(null), 2000);

		return () => clearTimeout(timer);
	}, [copy]);

	async function copyCode() {
		const text = codeEditorRef.current?.getValue() ?? code;

		try {
			await navigator.clipboard.writeText(text);
			setCopy((current) => ({ value: text, id: (current?.id ?? 0) + 1 }));
		} catch {
			setCopy(null);
		}
	}

	async function share() {
		const encoded = encodeState({
			files,
			target,
			keywordPolicy,
			formatMode,
			inferFormatAsString,
			data,
		});
		const url = new URL(location.href);

		url.searchParams.delete(playgroundParams.example);
		url.searchParams.delete(playgroundParams.generator);
		url.searchParams.set(playgroundParams.keywordPolicy, keywordPolicy);
		url.searchParams.set(playgroundParams.formatMode, formatMode);
		url.searchParams.set(playgroundParams.inferFormatAsString, String(inferFormatAsString));
		url.hash = `data=${encoded}`;
		history.replaceState(null, '', url);
		setSharedSnapshot({
			files,
			target,
			keywordPolicy,
			formatMode,
			inferFormatAsString,
			data,
		});

		try {
			await navigator.clipboard.writeText(url.href);
		} catch {
			// The URL hash is still updated even when clipboard access is denied.
		}
	}

	return { copied, shared, copyCode, share };
}
