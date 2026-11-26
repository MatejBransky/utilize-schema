import { Resizable, ResizableHandle, ResizablePanel } from '@ui-sdk/react/resizable';
import type { ReactNode } from 'react';

import type { Playground } from '../playgroundHooks';
import { MAX_SPLIT, MIN_SPLIT, TEST_DATA_PANEL } from '../useWorkspaceLayout';

import styles from '../App.module.css';

export interface WorkspaceSplitterProps {
	layout: Playground['layout'];
	top: ReactNode;
	bottom: ReactNode;
}

export function WorkspaceSplitter({ layout, top, bottom }: WorkspaceSplitterProps) {
	const { workspaceRef } = layout;

	return (
		<Resizable
			ref={workspaceRef}
			aria-label="Workspace layout"
			className={styles.workspace}
			orientation="vertical"
			layout={layout.panelLayout}
			step={2}
			largeStep={10}
			onLayoutChange={layout.onLayoutChange}
		>
			<ResizablePanel
				id="schema-output-row"
				className={styles.workspacePanel}
				minSize={MIN_SPLIT}
				maxSize={layout.dataCollapsed ? 100 - layout.collapsedBottomSize : MAX_SPLIT}
			>
				{top}
			</ResizablePanel>
			<ResizableHandle
				aria-label="Resize schema and test data sections"
				className={styles.resizeHandle}
			/>
			<ResizablePanel
				id={TEST_DATA_PANEL}
				className={styles.workspacePanel}
				data-collapsed={layout.dataCollapsed ? 'true' : undefined}
				minSize={layout.dataCollapsed ? layout.collapsedBottomSize : MIN_SPLIT}
				maxSize={layout.dataCollapsed ? Math.max(MIN_SPLIT, layout.collapsedBottomSize) : MAX_SPLIT}
			>
				{bottom}
			</ResizablePanel>
		</Resizable>
	);
}
