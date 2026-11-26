import { Button } from '@ui-sdk/react/button';
import { Collapsible, CollapsiblePanel, CollapsibleTrigger } from '@ui-sdk/react/collapsible';
import {
	SegmentedControl,
	SegmentedControlIndicator,
	SegmentedControlItem,
} from '@ui-sdk/react/segmented-control';

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
		<Collapsible
			render={<section />}
			aria-label="Test data section"
			className={`${styles.pane} ${styles.dataPane}`}
			open={!collapsed}
			onOpenChange={layout.setDataOpen}
			{...dataDrop.handlers}
		>
			<div id="test-data-header" className={`${styles.outputHeader} ${styles.sectionHeader}`}>
				<CollapsibleTrigger className={styles.sectionToggle}>
					<span className={styles.heading}>Test data</span>
					<ChevronDownIcon />
				</CollapsibleTrigger>
				<div className={styles.outputActions}>
					{example ? (
						<SegmentedControl
							aria-label="Example test data"
							className={styles.cases}
							value={activeCase?.value ?? null}
							onValueChange={(value) => {
								const item = example.cases.find((candidate) => candidate.value === value);

								if (item) {
									onDataChange(JSON.stringify(item.data, null, 2));
								}
							}}
						>
							<SegmentedControlIndicator className={styles.caseIndicator} />
							{example.cases.map((item) => (
								<SegmentedControlItem
									key={item.value}
									value={item.value}
									className={styles.case}
									data-expect={item.expect}
								>
									{item.label}
								</SegmentedControlItem>
							))}
						</SegmentedControl>
					) : null}
					<Button className={styles.statusButton} onClick={() => dataEditorRef.current?.format()}>
						Format data
					</Button>
				</div>
			</div>
			<CollapsiblePanel id="test-data-editor" className={styles.editorFill} keepMounted>
				<MonacoEditor
					ref={dataEditorRef}
					testId="data-editor"
					ariaLabel="Test data JSON"
					language="json"
					theme={monacoTheme}
					value={data}
					onChange={onDataChange}
				/>
			</CollapsiblePanel>
			<DataDropOverlay visible={dataDrop.dragging && !collapsed} />
		</Collapsible>
	);
}

function DataDropOverlay({ visible }: { visible: boolean }) {
	if (!visible) {
		return null;
	}

	return (
		<div className={styles.dataDropOverlay} role="group" aria-label="Drop JSON test data">
			<div className={styles.dropTarget} data-active="true">
				<span className={styles.dropKicker}>Test data</span>
				<h2 className={styles.dropTitle}>Drop a JSON document</h2>
				<p className={styles.dropText}>Its content replaces the current test data.</p>
			</div>
		</div>
	);
}
