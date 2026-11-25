import { Button } from '@ui-sdk/react/button';

import { exampleById, exampleCaseForData } from '../examples';
import { MonacoEditor } from '../monaco/MonacoEditor';
import type { Playground } from '../playgroundHooks';
import { ChevronDownIcon } from './icons';

import styles from '../App.module.css';

export type DataPaneModel = Pick<
	Playground,
	'exampleId' | 'data' | 'updateData' | 'monacoTheme' | 'dataEditorRef' | 'layout' | 'dataDrop'
>;

export interface DataPaneProps {
	playground: DataPaneModel;
}

export function DataPane({ playground }: DataPaneProps) {
	const {
		exampleId,
		data,
		updateData: onDataChange,
		monacoTheme,
		dataEditorRef,
		layout,
		dataDrop,
	} = playground;
	const example = exampleById(exampleId);
	const activeCase = example ? exampleCaseForData(example, data) : undefined;
	const collapsed = layout.dataCollapsed;
	return (
		<section
			className={`${styles.pane} ${styles.dataPane}`}
			data-collapsed={collapsed ? 'true' : undefined}
			{...dataDrop.handlers}
		>
			<div className={`${styles.outputHeader} ${styles.sectionHeader}`}>
				{layout.narrowLayout ? (
					<span className={styles.heading}>Test data</span>
				) : (
					<button
						type="button"
						className={styles.sectionToggle}
						aria-expanded={!collapsed}
						aria-controls="test-data-editor"
						onClick={layout.toggleDataCollapsed}
					>
						<span className={styles.heading}>Test data</span>
						<ChevronDownIcon />
					</button>
				)}
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
			<div id="test-data-editor" className={styles.editorFill} hidden={collapsed}>
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
			{dataDrop.dragging && !collapsed ? (
				<div className={styles.dataDropOverlay} role="group" aria-label="Drop JSON test data">
					<div className={styles.dropTarget} data-active="true">
						<span className={styles.dropKicker}>Test data</span>
						<h2 className={styles.dropTitle}>Drop a JSON document</h2>
						<p className={styles.dropText}>Its content replaces the current test data.</p>
					</div>
				</div>
			) : null}
		</section>
	);
}
