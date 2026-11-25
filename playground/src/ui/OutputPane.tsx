import { Button } from '@ui-sdk/react/button';
import {
	ScrollArea,
	ScrollAreaContent,
	ScrollAreaScrollbar,
	ScrollAreaThumb,
	ScrollAreaViewport,
} from '@ui-sdk/react/scroll-area';

import type { Problem, SchemaFile } from '../bundle';
import { MonacoEditor } from '../monaco/MonacoEditor';
import type { Playground } from '../playgroundHooks';
import { ChevronDownIcon } from './icons';

import styles from '../App.module.css';

export type OutputPaneModel = Pick<
	Playground,
	| 'files'
	| 'problems'
	| 'code'
	| 'busy'
	| 'copied'
	| 'target'
	| 'monacoTheme'
	| 'codeEditorRef'
	| 'copyCode'
	| 'selectProblem'
	| 'layout'
>;

export interface OutputPaneProps {
	playground: OutputPaneModel;
}

export function OutputPane({ playground }: OutputPaneProps) {
	const {
		files,
		problems,
		code,
		busy,
		copied,
		target,
		monacoTheme,
		codeEditorRef,
		copyCode: onCopyCode,
		selectProblem: onSelectProblem,
		layout,
	} = playground;
	const errorCount = problems.filter((problem) => problem.severity === 'error').length;
	const warningCount = problems.length - errorCount;
	return (
		<section className={`${styles.pane} ${styles.outputPane}`}>
			<div className={styles.outputHeader}>
				<h2 className={styles.heading}>Generated TypeScript</h2>
				<div className={styles.outputActions}>
					{busy ? <span className={styles.muted}>Generating…</span> : null}
					<Button onClick={onCopyCode} disabled={!code || busy}>
						{copied ? 'Copied' : 'Copy code'}
					</Button>
				</div>
			</div>

			<MonacoEditor
				ref={codeEditorRef}
				testId="generated-code"
				ariaLabel="Generated TypeScript"
				language="typescript"
				path="file:///playground/generated.ts"
				resolveEffectTypes={target === 'effect'}
				theme={monacoTheme}
				value={code || '// Generated code will appear here'}
				readOnly
			/>

			<div
				className={styles.problems}
				data-testid="problems"
				data-collapsed={layout.problemsCollapsed ? 'true' : undefined}
			>
				<button
					type="button"
					className={styles.problemsHeader}
					aria-expanded={!layout.problemsCollapsed}
					aria-controls="validation-problems"
					onClick={layout.toggleProblemsCollapsed}
				>
					<span className={styles.heading}>Validation</span>
					<span className={styles.problemsSummary}>
						<span className={styles.counts} data-severity={errorCount > 0 ? 'error' : 'ok'}>
							{errorCount} errors, {warningCount} warnings
						</span>
						<ChevronDownIcon />
					</span>
				</button>
				<div
					id="validation-problems"
					className={styles.problemsBody}
					hidden={layout.problemsCollapsed}
				>
					<ProblemList problems={problems} files={files} onSelect={onSelectProblem} />
				</div>
			</div>
		</section>
	);
}

interface ProblemListProps {
	problems: Problem[];
	files: SchemaFile[];
	onSelect(problem: Problem): void;
}

function ProblemList({ problems, files, onSelect }: ProblemListProps) {
	if (problems.length === 0) {
		return <p className={styles.ok}>No problems found.</p>;
	}

	return (
		<ScrollArea className={styles.problemScroll} type="auto">
			<ScrollAreaViewport className={styles.problemViewport}>
				<ScrollAreaContent>
					{problems.map((problem) => (
						<Button
							key={`${problem.fileId ?? ''}|${problem.severity}|${problem.line ?? ''}|${problem.column ?? ''}|${problem.message}`}
							className={styles.problem}
							onClick={() => onSelect(problem)}
						>
							<span className={styles.severity}>
								{problem.severity === 'error' ? 'Error' : 'Warning'}
							</span>
							<span className={styles.problemFile}>
								{files.find((file) => file.id === problem.fileId)?.name ?? 'project'}
							</span>
							<span className={styles.problemMessage}>
								{problem.message}
								{problem.line
									? ` (line ${problem.line}${problem.column ? `, col ${problem.column}` : ''})`
									: ''}
							</span>
						</Button>
					))}
				</ScrollAreaContent>
			</ScrollAreaViewport>
			<ScrollAreaScrollbar orientation="vertical">
				<ScrollAreaThumb />
			</ScrollAreaScrollbar>
		</ScrollArea>
	);
}
