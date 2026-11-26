import { createResizableController } from '@ui-sdk/react/resizable';
import type { ResizableSize } from '@ui-sdk/react/resizable';
import { useLayoutEffect, useRef, useState } from 'react';

export const MIN_SPLIT = 20;
export const MAX_SPLIT = 80;
export const TEST_DATA_PANEL = 'test-data-row';

const DEFAULT_LAYOUT: [number, number] = [60, 40];

export function useWorkspaceLayout() {
	const workspaceRef = useRef<HTMLDivElement>(null);
	const expandedLayoutRef = useRef<[number, number]>(DEFAULT_LAYOUT);
	const [controller] = useState(() => createResizableController());
	const [dataCollapsed, setDataCollapsed] = useState(false);
	const [problemsCollapsed, setProblemsCollapsed] = useState(false);
	const [collapsedSize, setCollapsedSize] = useState<ResizableSize>('2.5rem');

	useLayoutEffect(() => {
		const header = document.getElementById('test-data-header');

		if (!header) {
			return;
		}

		const syncCollapsedSize = () => {
			setCollapsedSize(`${Math.ceil(header.getBoundingClientRect().height)}px`);
		};

		syncCollapsedSize();
		const observer = new ResizeObserver(syncCollapsedSize);
		observer.observe(header);

		return () => observer.disconnect();
	}, []);

	function collapsedPercent() {
		const workspaceHeight = workspaceRef.current?.getBoundingClientRect().height ?? 0;
		const headerHeight =
			document.getElementById('test-data-header')?.getBoundingClientRect().height ?? 40;

		if (workspaceHeight === 0) {
			return 4;
		}

		return (headerHeight * 100) / workspaceHeight;
	}

	function changeLayout(next: number[]) {
		const bottom = next[1] ?? DEFAULT_LAYOUT[1];
		const collapsed = bottom <= collapsedPercent() + 0.25;

		setDataCollapsed(collapsed);

		if (!collapsed) {
			expandedLayoutRef.current = [next[0] ?? DEFAULT_LAYOUT[0], bottom];
		}
	}

	function setDataOpen(open: boolean) {
		const layout = controller.getLayout();

		if (open) {
			setDataCollapsed(false);
			controller.setLayout(expandedLayoutRef.current);
			return;
		}

		if (layout.length === 2) {
			expandedLayoutRef.current = [layout[0] ?? DEFAULT_LAYOUT[0], layout[1] ?? DEFAULT_LAYOUT[1]];
		}

		const bottom = Math.min(MAX_SPLIT, Math.max(1, collapsedPercent()));
		setDataCollapsed(true);
		controller.setLayout([100 - bottom, bottom]);
	}

	return {
		workspaceRef,
		controller,
		collapsedSize,
		onLayoutChange: changeLayout,
		dataCollapsed,
		setDataOpen,
		problemsCollapsed,
		setProblemsCollapsed,
	};
}
