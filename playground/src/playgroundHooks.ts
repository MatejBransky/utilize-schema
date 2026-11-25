import { generate as generateEffect } from '@utilize/effect';
import { type KeywordPolicy, parse, type ParsedJSONSchema } from '@utilize/json-schema';
import { generate as generateTypeScript } from '@utilize/typescript';
import { generate as generateZod } from '@utilize/zod';
import { useEffect, useMemo, useRef, useState, type RefObject } from 'react';

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
import { examples } from './examples';
import type { FormatMode } from './formatMode';
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
import { targets, type TargetId } from './targets';
import { loadColorMode, THEME_STORAGE_KEY, type ColorMode } from './theme';
import { useFileDrop } from './useFileDrop';
import type { UrlState } from './urlState';
import { validateSchemas } from './validation';

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
}

export function usePlayground() {
	const [initial] = useState(loadState);
	const settings = useGeneratorSettings(initial);
	const workspace = useSchemaFiles(initial.files, settings);
	const generation = useGeneration(
		workspace.files,
		settings.target,
		settings.keywordPolicy,
		settings.formatMode
	);
	const theme = useTheme();
	const editors = useEditorNavigation(workspace.setActiveId);
	const feedback = useFeedback(
		workspace.files,
		settings.target,
		settings.keywordPolicy,
		settings.formatMode,
		generation.code,
		editors.codeEditorRef
	);

	function applyExample(id: string) {
		const example = examples.find((candidate) => candidate.id === id);

		if (!example) {
			return;
		}

		workspace.applyExample(example.files);
		setExampleUrl(example.id, 'push');
	}

	useEffect(() => {
		try {
			localStorage.setItem(
				PLAYGROUND_STORAGE_KEY,
				JSON.stringify({
					files: workspace.files,
					target: settings.target,
					keywordPolicy: settings.keywordPolicy,
					formatMode: settings.formatMode,
				})
			);
		} catch {
			// Storage can be full or denied. Keep the workspace in memory.
		}
	}, [workspace.files, settings.target, settings.keywordPolicy, settings.formatMode]);

	return {
		...settings,
		...workspace,
		...generation,
		...theme,
		...editors,
		...feedback,
		applyExample,
		targetOptions,
		exampleOptions,
	};
}

function useGeneratorSettings(initial: UrlState) {
	const [target, setTarget] = useState<TargetId>(initial.target);
	const [keywordPolicy, setKeywordPolicy] = useState<KeywordPolicy>(initial.keywordPolicy);
	const [formatMode, setFormatMode] = useState<FormatMode>(initial.formatMode);

	useEffect(() => {
		const url = new URL(location.href);

		if (!url.hash && url.searchParams.get(playgroundParams.generator) !== target) {
			updateUrl({ [playgroundParams.generator]: target }, 'replace');
		}
	}, []);

	useEffect(() => {
		const url = new URL(location.href);

		if (!url.hash && url.searchParams.get(playgroundParams.keywordPolicy) !== keywordPolicy) {
			updateUrl({ [playgroundParams.keywordPolicy]: keywordPolicy }, 'replace');
		}
	}, [keywordPolicy]);

	useEffect(() => {
		const url = new URL(location.href);

		if (!url.hash && url.searchParams.get(playgroundParams.formatMode) !== formatMode) {
			updateUrl({ [playgroundParams.formatMode]: formatMode }, 'replace');
		}
	}, [formatMode]);

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

	return {
		target,
		keywordPolicy,
		formatMode,
		setTarget,
		setKeywordPolicy,
		setFormatMode,
		applyGenerator,
		applyKeywordPolicy,
		applyFormatMode,
	};
}

function useSchemaFiles(initialFiles: SchemaFile[], settings: SettingsSetters) {
	const [files, setFiles] = useState<SchemaFile[]>(initialFiles);
	const [activeId, setActiveId] = useState(initialFiles[0]?.id ?? '');
	const [editingId, setEditingId] = useState<string | null>(null);
	const [draftName, setDraftName] = useState('');
	const [renameError, setRenameError] = useState<string | null>(null);
	const { dragging, activeMode, drop } = useFileDrop({ onDrop: handleDrop });

	useEffect(() => {
		if (!files.some((file) => file.id === activeId) && files[0]) {
			setActiveId(files[0].id);
		}
	}, [files, activeId]);

	useEffect(() => {
		const onPopState = () => {
			const next = loadState();
			setFiles(next.files);
			settings.setTarget(next.target);
			settings.setKeywordPolicy(next.keywordPolicy);
			settings.setFormatMode(next.formatMode);
			setActiveId(next.files[0]?.id ?? '');
			setEditingId(null);
		};

		window.addEventListener('popstate', onPopState);

		return () => window.removeEventListener('popstate', onPopState);
	}, []);

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

	function applyExample(nextFiles: SchemaFile[]) {
		setFiles(nextFiles);
		setActiveId(nextFiles[0]?.id ?? '');
		setEditingId(null);
	}

	return {
		files,
		activeId,
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
	formatMode: FormatMode
) {
	const [code, setCode] = useState('');
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

					const generatorOptions = exampleId ? exampleGeneratorOptions[exampleId] : undefined;
					const rawCode = generateCodeFor(target, root, generatorOptions, formatMode);
					const formatCode =
						generatorOptions?.format ??
						((source: string) => formatTypeScript(source).catch(() => source));

					nextCode = cancelled ? nextCode : await formatCode(rawCode);
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
	}, [bundle, exampleId, target, keywordPolicy, formatMode]);

	return { exampleId, problems, code, busy };
}

function useTheme() {
	const [colorMode, setColorMode] = useState<ColorMode>(loadColorMode);
	const [systemDark, setSystemDark] = useState(
		() => window.matchMedia('(prefers-color-scheme: dark)').matches
	);
	const resolvedTheme = colorMode === 'auto' ? (systemDark ? 'dark' : 'light') : colorMode;
	const monacoTheme = resolvedTheme === 'dark' ? 'utilize-dark' : 'utilize-light';

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

	return { colorMode, setColorMode, resolvedTheme, monacoTheme };
}

function useEditorNavigation(setActiveId: (id: string) => void) {
	const schemaEditorRef = useRef<MonacoEditorHandle>(null);
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
		codeEditorRef,
		cursor,
		setCursor,
		selectProblem,
	};
}

function useFeedback(
	files: SchemaFile[],
	target: TargetId,
	keywordPolicy: KeywordPolicy,
	formatMode: FormatMode,
	code: string,
	codeEditorRef: RefObject<MonacoEditorHandle | null>
) {
	const [copied, setCopied] = useState(false);
	const [shared, setShared] = useState(false);

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
		const encoded = encodeState({ files, target, keywordPolicy, formatMode });
		const url = new URL(location.href);

		url.searchParams.delete(playgroundParams.example);
		url.searchParams.delete(playgroundParams.generator);
		url.searchParams.set(playgroundParams.keywordPolicy, keywordPolicy);
		url.searchParams.set(playgroundParams.formatMode, formatMode);
		url.hash = `data=${encoded}`;
		history.replaceState(null, '', url);
		setShared(true);

		try {
			await navigator.clipboard.writeText(url.href);
		} catch {
			// The URL hash is still updated even when clipboard access is denied.
		}
	}

	return { copied, shared, copyCode, share };
}

function generateCodeFor(
	target: TargetId,
	root: ParsedJSONSchema,
	options: ExampleGeneratorOptions | undefined,
	formatMode: FormatMode
): string {
	switch (target) {
		case 'effect':
			return generateEffect(root, { importEffect: true, formatMode, ...options?.effect });
		case 'typescript':
			// A type cannot check a format, so the option does not apply here.
			return generateTypeScript(root, { ...options?.typescript });
		case 'zod':
			return generateZod(root, { importZod: true, formatMode, ...options?.zod });
		default:
			throw new Error(`The ${target} generator is not available yet.`);
	}
}
