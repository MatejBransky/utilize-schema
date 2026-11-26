import type { Playground } from '../playgroundHooks';
import { ValidatorResults } from './ValidatorResults';

import styles from '../App.module.css';

export type ResultPaneModel = Pick<Playground, 'target' | 'validation' | 'activeCase' | 'layout'>;

export interface ResultPaneProps {
	playground: ResultPaneModel;
}

export function ResultPane({ playground }: ResultPaneProps) {
	const { target, validation, activeCase, layout } = playground;
	return (
		<section className={styles.pane}>
			<div className={`${styles.outputHeader} ${styles.sectionHeader}`}>
				<h2 className={styles.heading}>Generated validator results</h2>
				<span className={styles.muted}>
					{activeCase ? `Expected: ${activeCase.expect}` : 'Custom test data'}
				</span>
			</div>
			<div id="validator-results-panel" className={styles.resultBody} hidden={layout.dataCollapsed}>
				<ValidatorResults target={target} state={validation} />
			</div>
		</section>
	);
}
