import type { ResizableLayoutChangeDetails } from '@ui-sdk/react/resizable';
import { useEffect, useRef, useState } from 'react';

export const MIN_SPLIT = 20;
export const MAX_SPLIT = 80;
export const TEST_DATA_PANEL = 'test-data-row';

const DEFAULT_LAYOUT: [number, number] = [60, 40];
const NARROW_LAYOUT = '(max-width: 900px)';

export function useWorkspaceLayout() {
	const workspaceRef = useRef<HTMLDivElement>(null);
	const expectedLayoutRef = useRef<[number, number]>(DEFAULT_LAYOUT);
	const expandedLayoutRef = useRef<[number, number]>(DEFAULT_LAYOUT);
	const [panelLayout, setPanelLayout] = useState<[number, number]>(DEFAULT_LAYOUT);
	const [collapsedBottomSize, setCollapsedBottomSize] = useState(10);
	const [dataCollapsed, setDataCollapsed] = useState(false);
	const [problemsCollapsed, setProblemsCollapsed] = useState(false);
	const [collapsedSize, setCollapsedSize] = useState<'3rem' | '6rem'>(() =>
		window.matchMedia(NARROW_LAYOUT).matches ? '6rem' : '3rem'
	);

	useEffect(() => {
		const query = window.matchMedia(NARROW_LAYOUT);
		const syncCollapsedSize = () => setCollapsedSize(query.matches ? '6rem' : '3rem');

		syncCollapsedSize();
		query.addEventListener('change', syncCollapsedSize);

		return () => query.removeEventListener('change', syncCollapsedSize);
	}, []);

	useEffect(() => {
		if (!dataCollapsed) {
			return;
		}

		const workspace = workspaceRef.current;

		if (!workspace) {
			return;
		}

		const syncCollapsedLayout = () => {
			const height = workspace.getBoundingClientRect().height;
			const rootFontSize =
				Number.parseFloat(getComputedStyle(document.documentElement).fontSize) || 16;
			const bottom = Math.min(
				MAX_SPLIT,
				Math.max(1, (Number.parseFloat(collapsedSize) * rootFontSize * 100) / height)
			);
			const next: [number, number] = [100 - bottom, bottom];

			setCollapsedBottomSize(bottom);
			applyLayout(next);
		};

		syncCollapsedLayout();
		const observer = new ResizeObserver(syncCollapsedLayout);
		observer.observe(workspace);

		return () => observer.disconnect();
	}, [dataCollapsed, collapsedSize]);

	function applyLayout(next: [number, number]) {
		expectedLayoutRef.current = next;
		setPanelLayout(next);
	}

	function changeLayout(next: number[], details: ResizableLayoutChangeDetails) {
		if (sameLayout(next, expectedLayoutRef.current)) {
			return;
		}

		if (dataCollapsed) {
			details.cancel();
			setDataCollapsed(false);
			applyLayout(expandedLayoutRef.current);
			return;
		}

		const [top, bottom] = next;

		if (top === undefined || bottom === undefined) {
			return;
		}

		const layout: [number, number] = [top, bottom];
		expandedLayoutRef.current = layout;
		applyLayout(layout);
	}

	function setDataOpen(open: boolean) {
		if (open) {
			setDataCollapsed(false);
			applyLayout(expandedLayoutRef.current);
		} else {
			setDataCollapsed(true);
		}
	}

	// The disclosure owns collapse state; a controlled layout keeps the row height in sync.
	return {
		workspaceRef,
		panelLayout,
		collapsedBottomSize,
		onLayoutChange: changeLayout,
		dataCollapsed,
		setDataOpen,
		problemsCollapsed,
		setProblemsCollapsed,
	};
}

function sameLayout(left: readonly number[], right: readonly number[]): boolean {
	return (
		left.length === right.length &&
		left.every((value, index) => Math.abs(value - right[index]) < 0.1)
	);
}
