import { useEffect, useRef, useState } from 'react';
import type {
	CSSProperties,
	Dispatch,
	KeyboardEvent as ReactKeyboardEvent,
	PointerEvent as ReactPointerEvent,
	RefObject,
	SetStateAction,
} from 'react';

/** The top row starts at 60 % of the workspace and can move between 20 % and 80 %. */
const DEFAULT_SPLIT = 0.6;
export const MIN_SPLIT = 0.2;
export const MAX_SPLIT = 0.8;

const SPLIT_STEP = 0.02;
const LARGE_SPLIT_STEP = 0.1;
const NARROW_LAYOUT = '(max-width: 900px)';

interface SplitterHandlers {
	onPointerDown: (event: ReactPointerEvent<HTMLElement>) => void;
	onPointerMove: (event: ReactPointerEvent<HTMLElement>) => void;
	onPointerUp: (event: ReactPointerEvent<HTMLElement>) => void;
	onPointerCancel: (event: ReactPointerEvent<HTMLElement>) => void;
	onLostPointerCapture: () => void;
	onKeyDown: (event: ReactKeyboardEvent<HTMLElement>) => void;
}

interface WorkspaceSplitter {
	resizing: boolean;
	handlers: SplitterHandlers;
}

interface WorkspaceStyle extends CSSProperties {
	'--workspace-top': string;
	'--workspace-bottom': string;
}

/**
 * The workspace layout: the split between the schema row and the test data
 * row, and the two independently collapsible sections. The test data row only
 * collapses on wide screens, where both rows are visible at once.
 */
export function useWorkspaceLayout() {
	const [split, setSplit] = useState(DEFAULT_SPLIT);
	const [problemsCollapsed, setProblemsCollapsed] = useState(false);
	const [dataCollapsed, setDataCollapsed] = useState(false);
	const [narrowLayout, setNarrowLayout] = useState(() => window.matchMedia(NARROW_LAYOUT).matches);
	const workspaceRef = useRef<HTMLElement>(null);
	const splitter = useWorkspaceSplitter(workspaceRef, setSplit);

	useEffect(() => {
		const query = window.matchMedia(NARROW_LAYOUT);
		const syncLayout = () => {
			setNarrowLayout(query.matches);

			if (query.matches) {
				setDataCollapsed(false);
			}
		};

		syncLayout();
		query.addEventListener('change', syncLayout);

		return () => query.removeEventListener('change', syncLayout);
	}, []);

	const style: WorkspaceStyle = {
		'--workspace-top': `${split * 100}%`,
		'--workspace-bottom': `${(1 - split) * 100}%`,
	};

	return {
		split,
		resizing: splitter.resizing,
		dataCollapsed,
		problemsCollapsed,
		narrowLayout,
		workspaceRef,
		style,
		toggleDataCollapsed: () => setDataCollapsed((collapsed) => !collapsed),
		toggleProblemsCollapsed: () => setProblemsCollapsed((collapsed) => !collapsed),
		splitter: splitter.handlers,
	};
}

/** The pointer and keyboard interaction of the draggable divider. */
function useWorkspaceSplitter(
	workspaceRef: RefObject<HTMLElement | null>,
	setSplit: Dispatch<SetStateAction<number>>
): WorkspaceSplitter {
	const [resizing, setResizing] = useState(false);

	return {
		resizing,
		handlers: {
			...usePointerResize(workspaceRef, setSplit, setResizing),
			onKeyDown: keyboardResize(setSplit),
		} satisfies SplitterHandlers,
	};
}

type PointerHandlers = Omit<SplitterHandlers, 'onKeyDown'>;

/** Drags the divider with a pointer and keeps the split within its bounds. */
function usePointerResize(
	workspaceRef: RefObject<HTMLElement | null>,
	setSplit: Dispatch<SetStateAction<number>>,
	setResizing: Dispatch<SetStateAction<boolean>>
): PointerHandlers {
	function resizeWorkspace(clientY: number) {
		const rect = workspaceRef.current?.getBoundingClientRect();

		if (!rect || rect.height === 0) {
			return;
		}

		setSplit(clampSplit((clientY - rect.top) / rect.height));
	}

	function startResizing(event: ReactPointerEvent<HTMLElement>) {
		if (event.button !== 0) {
			return;
		}

		event.preventDefault();
		event.currentTarget.setPointerCapture(event.pointerId);
		setResizing(true);
	}

	function moveSplitter(event: ReactPointerEvent<HTMLElement>) {
		if (event.currentTarget.hasPointerCapture(event.pointerId)) {
			resizeWorkspace(event.clientY);
		}
	}

	function stopResizing(event: ReactPointerEvent<HTMLElement>) {
		if (event.currentTarget.hasPointerCapture(event.pointerId)) {
			event.currentTarget.releasePointerCapture(event.pointerId);
		}

		setResizing(false);
	}

	return {
		onPointerDown: startResizing,
		onPointerMove: moveSplitter,
		onPointerUp: stopResizing,
		onPointerCancel: stopResizing,
		onLostPointerCapture: () => setResizing(false),
	};
}

/** Arrow keys move the split by a step, Shift by a large one; Home and End jump to the bounds. */
function keyboardResize(setSplit: Dispatch<SetStateAction<number>>) {
	return function handleKeyDown(event: ReactKeyboardEvent<HTMLElement>) {
		const step = event.shiftKey ? LARGE_SPLIT_STEP : SPLIT_STEP;

		switch (event.key) {
			case 'ArrowUp':
				setSplit((value) => clampSplit(value - step));
				break;
			case 'ArrowDown':
				setSplit((value) => clampSplit(value + step));
				break;
			case 'Home':
				setSplit(MIN_SPLIT);
				break;
			case 'End':
				setSplit(MAX_SPLIT);
				break;
			default:
				return;
		}

		event.preventDefault();
	};
}

function clampSplit(value: number): number {
	return Math.min(MAX_SPLIT, Math.max(MIN_SPLIT, value));
}
