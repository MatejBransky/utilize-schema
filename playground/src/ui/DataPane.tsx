import { Button } from '@ui-sdk/react/button';

import { exampleById, exampleCaseForData } from '../examples';
import { MonacoEditor } from '../monaco/MonacoEditor';
import type { Playground } from '../playgroundHooks';

import styles from '../App.module.css';

export type DataPaneModel = Pick<
	Playground,
	'exampleId' | 'data' | 'setData' | 'monacoTheme' | 'dataEditorRef'
>;

export interface DataPaneProps {
	playground: DataPaneModel;
}

export function DataPane({ playground }: DataPaneProps) {
	const { exampleId, data, setData: onDataChange, monacoTheme, dataEditorRef } = playground;
	const example = exampleById(exampleId);
	const activeCase = example ? exampleCaseForData(example, data) : undefined;
	return (
		<section className={`${styles.pane} ${styles.dataPane}`}>
			<div className={styles.outputHeader}>
				<h2 className={styles.heading}>Test data</h2>
				<div className={styles.outputActions}>
					{example ? (
						<div className={styles.cases} aria-label="Example test data">
							{example.cases.map((item) => (
								<Button
									key={item.label}
									className={styles.case}
									data-expect={item.expect}
									data-selected={item === activeCase ? 'true' : undefined}
									aria-pressed={item === activeCase}
									onClick={() => onDataChange(JSON.stringify(item.data, null, 2))}
								>
									{item.label}
								</Button>
							))}
						</div>
					) : null}
					<Button className={styles.statusButton} onClick={() => dataEditorRef.current?.format()}>
						Format data
					</Button>
				</div>
			</div>
			<div className={styles.editorFill}>
				<MonacoEditor
					ref={dataEditorRef}
					testId="data-editor"
					ariaLabel="Test data JSON"
					language="json"
					theme={monacoTheme}
					value={data}
					onChange={onDataChange}
				/>
			</div>
		</section>
	);
}
