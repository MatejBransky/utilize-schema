import type { Playground } from '../playgroundHooks';
import { MAX_SPLIT, MIN_SPLIT } from '../useWorkspaceLayout';

import styles from '../App.module.css';

export interface WorkspaceSplitterProps {
	layout: Playground['layout'];
}

export function WorkspaceSplitter({ layout }: WorkspaceSplitterProps) {
	return (
		<div
			className={styles.splitter}
			role="separator"
			aria-label="Resize schema and test data sections"
			aria-orientation="horizontal"
			aria-valuemin={MIN_SPLIT * 100}
			aria-valuemax={MAX_SPLIT * 100}
			aria-valuenow={Math.round(layout.split * 100)}
			tabIndex={0}
			{...layout.splitter}
		/>
	);
}
