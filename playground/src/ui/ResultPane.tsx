import type { Playground } from '../playgroundHooks';
import { ValidatorResults } from './ValidatorResults';

import styles from '../App.module.css';

export type ResultPaneModel = Pick<Playground, 'target' | 'validation' | 'activeCase'>;

export interface ResultPaneProps {
	playground: ResultPaneModel;
}

export function ResultPane({ playground }: ResultPaneProps) {
	const { target, validation, activeCase } = playground;
	return (
		<section className={`${styles.pane} ${styles.resultPane}`}>
			<div className={styles.outputHeader}>
				<h2 className={styles.heading}>Generated validator results</h2>
				<span className={styles.muted}>
					{activeCase ? `Expected: ${activeCase.expect}` : 'Custom test data'}
				</span>
			</div>
			<ValidatorResults target={target} state={validation} />
		</section>
	);
}
