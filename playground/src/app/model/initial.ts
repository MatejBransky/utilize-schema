import { loadState } from '../../playgroundState';
import { loadColorMode } from '../../theme';
import { workspaceOf } from './derived';
import type { AppModel } from './schemas';

export function initialModel(): AppModel {
	const initial = loadState();
	const files = initial.files;
	const derived = workspaceOf(files, initial.keywordPolicy);

	return {
		files,
		activeId: files[0]?.id ?? '',
		editingId: null,
		draftName: '',
		renameError: null,
		target: initial.target,
		keywordPolicy: initial.keywordPolicy,
		formatMode: initial.formatMode,
		data: initial.data,
		code: '',
		runtime: null,
		generationProblems: [],
		schemaProblems: derived.schemaProblems,
		bundleProblems: derived.bundleProblems,
		exampleId: derived.exampleId,
		busy: true,
		colorMode: loadColorMode(),
		systemDark: window.matchMedia('(prefers-color-scheme: dark)').matches,
		cursorLine: 1,
		cursorColumn: 1,
		focusRequest: 0,
		focusLine: 1,
		focusColumn: 1,
		sharedFor: null,
		copiedFor: null,
		copyToken: 0,
		dataCollapsed: false,
		problemsCollapsed: false,
		topSplit: 60,
		expandedTopSplit: 60,
		headerHeight: 0,
		workspaceHeight: 0,
		workspaceTop: 0,
		splitDragging: false,
		splitHovering: false,
		fileDragging: false,
		fileDragMode: null,
		dataDragging: false,
		openSelect: null,
		validation: { status: 'running' },
	};
}
