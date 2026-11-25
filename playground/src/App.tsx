import type { KeywordPolicy } from '@utilize/json-schema';
import { Button } from '@ui-sdk/react/button';
import { Input } from '@ui-sdk/react/input';
import {
	ScrollArea,
	ScrollAreaContent,
	ScrollAreaScrollbar,
	ScrollAreaThumb,
	ScrollAreaViewport,
} from '@ui-sdk/react/scroll-area';
import {
	Select,
	SelectContent,
	SelectItem,
	SelectLabel,
	SelectTrigger,
	SelectValue,
} from '@ui-sdk/react/select';
import { Tabs, TabsList, TabsPanel, TabsTab } from '@ui-sdk/react/tabs';

import { formatModes, isFormatMode } from './formatMode';
import { MonacoEditor } from './monaco/MonacoEditor';
import { usePlayground } from './playgroundHooks';
import { Header } from './ui/Header';
import { CheckIcon, CloseIcon, PencilIcon, PlusIcon } from './ui/icons';
import { SelectPicker } from './ui/SelectPicker';
import { isAvailableTarget, isKeywordPolicy } from './urlState';

import styles from './App.module.css';

const keywordPolicyOptions: Array<{ value: KeywordPolicy; label: string; hint: string }> = [
	{ value: 'error', label: 'Error', hint: 'Reject keywords outside the dialect' },
	{ value: 'warn', label: 'Warning', hint: 'Report them as warnings' },
	{ value: 'ignore', label: 'Ignore', hint: 'Do not report them' },
];

export default function App() {
	const {
		files,
		target,
		keywordPolicy,
		formatMode,
		activeId,
		setActiveId,
		editingId,
		setEditingId,
		draftName,
		setDraftName,
		renameError,
		updateFile,
		addFile,
		closeFile,
		startRename,
		commitRename,
		applyExample,
		applyGenerator,
		applyKeywordPolicy,
		applyFormatMode,
		exampleId,
		problems,
		code,
		busy,
		colorMode,
		setColorMode,
		copied,
		shared,
		copyCode,
		share,
		schemaEditorRef,
		codeEditorRef,
		cursor,
		setCursor,
		selectProblem,
		monacoTheme,
		dragging,
		activeMode,
		drop,
		targetOptions,
		exampleOptions,
	} = usePlayground();
	const errorCount = problems.filter((problem) => problem.severity === 'error').length;
	const warningCount = problems.length - errorCount;
	const active = files.find((file) => file.id === activeId) ?? files[0];

	if (!active) {
		return <main className={styles.empty}>Add a JSON Schema file to start.</main>;
	}

	return (
		<div className={styles.app}>
			<Header
				colorMode={colorMode}
				onColorModeChange={setColorMode}
				onShare={share}
				shared={shared}
			>
				<div className={styles.generatorPicker}>
					<SelectPicker
						label="Generator"
						placeholder="Choose a generator"
						value={target}
						options={targetOptions}
						onChange={(value) => {
							if (isAvailableTarget(value)) {
								applyGenerator(value);
							}
						}}
					/>
				</div>
				<div className={styles.examplePicker}>
					<SelectPicker
						label="Example"
						placeholder="Custom schema"
						value={exampleId}
						options={exampleOptions}
						onChange={applyExample}
					/>
				</div>
				<div className={`${styles.policyPicker} ${styles.keywordPolicyPicker}`}>
					<Select
						items={keywordPolicyOptions.map(({ value, label }) => ({ value, label }))}
						value={keywordPolicy}
						onValueChange={(value) => {
							if (isKeywordPolicy(value)) {
								applyKeywordPolicy(value);
							}
						}}
					>
						<SelectLabel>Keyword policy</SelectLabel>
						<SelectTrigger>
							<SelectValue />
						</SelectTrigger>
						<SelectContent className={styles.policyContent}>
							{keywordPolicyOptions.map((option) => (
								<SelectItem key={option.value} value={option.value} title={option.hint}>
									{option.label}
								</SelectItem>
							))}
						</SelectContent>
					</Select>
				</div>
				<div className={`${styles.policyPicker} ${styles.formatPicker}`}>
					<Select
						items={formatModes.map(({ value, label }) => ({ value, label }))}
						value={formatMode}
						onValueChange={(value) => {
							if (isFormatMode(value)) {
								applyFormatMode(value);
							}
						}}
					>
						<SelectLabel>Format</SelectLabel>
						<SelectTrigger disabled={target === 'typescript'}>
							<SelectValue />
						</SelectTrigger>
						<SelectContent className={styles.policyContent}>
							{formatModes.map((option) => (
								<SelectItem key={option.value} value={option.value} title={option.hint}>
									{option.label}
								</SelectItem>
							))}
						</SelectContent>
					</Select>
				</div>
			</Header>

			<main className={styles.workspace}>
				<section className={`${styles.pane} ${styles.schemaPane}`}>
					<Tabs
						className={styles.tabs}
						value={active.id}
						onValueChange={(value) => {
							if (value) {
								setActiveId(value);
							}
						}}
					>
						<div className={styles.tabBar}>
							<TabsList
								aria-label="Schema files"
								className={styles.tabList}
								data-testid="file-tabs"
							>
								{files.map((file, index) => {
									const hasError = problems.some(
										(problem) => problem.fileId === file.id && problem.severity === 'error'
									);
									const editing = editingId === file.id;

									return (
										<div key={file.id} className={styles.tabItem} role="presentation">
											<TabsTab value={file.id} className={styles.tab} render={<div />}>
												{index === 0 ? (
													<>
														<span className={styles.rootBadge}>root</span>{' '}
													</>
												) : null}
												<span
													className={`${styles.tabName} ${editing ? styles.tabNameHidden : ''}`}
												>
													{file.name}
												</span>
												{editing ? (
													<Input
														className={styles.tabInput}
														aria-label="File name"

														aria-invalid={renameError ? true : undefined}

														title={renameError ?? undefined}
														data-rename-input=""
														value={draftName}
														autoFocus
														onValueChange={setDraftName}
														onFocus={(event) => event.currentTarget.select()}
														onKeyDown={(event) => {
															if (event.key === 'Enter') {
																event.preventDefault();
																commitRename();
															} else if (event.key === 'Escape') {
																setEditingId(null);
															}
														}}
													/>
												) : null}
												{hasError ? <span className={styles.tabError} aria-hidden="true" /> : null}
											</TabsTab>
											<span className={styles.tabActions}>
												<Button
													className={styles.tabIcon}
													aria-label={editing ? 'Confirm rename' : `Rename ${file.name}`}
													data-confirm-rename=""
													onClick={() => {
														if (editing) {
															commitRename();
														} else {
															startRename(file);
														}
													}}
												>
													{editing ? <CheckIcon /> : <PencilIcon />}
												</Button>
												{editing ? null : (
													<Button
														className={styles.tabIcon}
														aria-label={`Close ${file.name}`}
														disabled={files.length <= 1}
														data-agent-confirm="Deletes this file and its schema from the playground"
														onClick={() => closeFile(file.id)}
													>
														<CloseIcon />
													</Button>
												)}
											</span>
										</div>
									);
								})}
							</TabsList>
							<Button className={styles.addTab} aria-label="Add file" onClick={addFile}>
								<PlusIcon />
							</Button>
							{renameError ? (
								<span className={styles.renameError} role="alert">
									{renameError}
								</span>
							) : null}
						</div>

						{files.map((file) => (
							<TabsPanel key={file.id} value={file.id} className={styles.editorPanel}>
								<div className={styles.editorFill}>
									<MonacoEditor
										ref={file.id === active.id ? schemaEditorRef : undefined}
										testId="schema-editor"
										ariaLabel={`${file.name} schema`}
										language="json"
										theme={monacoTheme}
										value={file.content}
										onChange={(content) => updateFile(file.id, { content })}
										onCursorChange={(line, column) => setCursor({ line, column })}
									/>
								</div>
							</TabsPanel>
						))}

						<div className={styles.statusBar}>
							<span>{active.name}</span>
							<span>
								Ln {cursor.line}, Col {cursor.column}
							</span>
							<span className={styles.statusActions}>
								<span>{active.content.length} chars</span>
								<Button
									className={styles.statusButton}
									onClick={() => schemaEditorRef.current?.format()}
								>
									Format schema
								</Button>
							</span>
						</div>
					</Tabs>
					{dragging ? (
						<div
							className={styles.dropOverlay}
							role="group"
							aria-label="Import JSON Schema files"
							data-testid="file-drop-overlay"
						>
							<div
								className={styles.dropTarget}
								data-drop-mode="add"
								data-active={activeMode === 'add' ? 'true' : undefined}
								onDrop={(event) => drop(event, 'add')}
							>
								<span className={styles.dropKicker}>Add</span>
								<h2 className={styles.dropTitle}>Add to this workspace</h2>
								<p className={styles.dropText}>
									Keep the files already open and add every dropped JSON schema as a new tab.
								</p>
								<span className={styles.dropHint}>Folders are loaded recursively.</span>
							</div>
							<div
								className={styles.dropTarget}
								data-drop-mode="replace"
								data-active={activeMode === 'replace' ? 'true' : undefined}
								onDrop={(event) => drop(event, 'replace')}
							>
								<span className={styles.dropKicker}>Replace</span>
								<h2 className={styles.dropTitle}>Start from the dropped files</h2>
								<p className={styles.dropText}>
									Close the current files and open only the dropped JSON schemas as tabs.
								</p>
								<span className={styles.dropHint}>Folders are loaded recursively.</span>
							</div>
						</div>
					) : null}
				</section>

				<section className={`${styles.pane} ${styles.outputPane}`}>
					<div className={styles.outputHeader}>
						<h2 className={styles.heading}>Generated TypeScript</h2>
						<div className={styles.outputActions}>
							{busy ? <span className={styles.muted}>Generating…</span> : null}
							<Button onClick={copyCode} disabled={!code || busy}>
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

					<div className={styles.problems} data-testid="problems">
						<div className={styles.problemsHeader}>
							<h2 className={styles.heading}>Validation</h2>
							<span className={styles.counts} data-severity={errorCount > 0 ? 'error' : 'ok'}>
								{errorCount} errors, {warningCount} warnings
							</span>
						</div>
						{problems.length === 0 ? (
							<p className={styles.ok}>No problems found.</p>
						) : (
							<ScrollArea className={styles.problemScroll} type="auto">
								<ScrollAreaViewport className={styles.problemViewport}>
									<ScrollAreaContent>
										{problems.map((problem) => (
											<Button
												key={`${problem.fileId ?? ''}|${problem.severity}|${problem.line ?? ''}|${problem.column ?? ''}|${problem.message}`}
												className={styles.problem}
												onClick={() => selectProblem(problem)}
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
						)}
					</div>
				</section>
			</main>
		</div>
	);
}
