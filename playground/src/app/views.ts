import { Component, Mount } from '@effect/ui';
import type { Html } from '@effect/ui/html';
import { Button, Collapsible, Input, RadioGroup, ScrollArea, Tabs } from '@effect/ui-kit';

import { Effect } from 'effect';

import { exampleCaseForData } from '../examples';
import { fileHasError } from '../problems';
import type { Problem } from '../bundle';
import type { SchemaFile } from '../bundle';
import type { TargetId } from '../targets';
import { targets } from '../targets';
import { WatchBrowser } from './browser';
import type { BrowserEvent } from './browser';
import { ChevronDownIcon, CheckIcon, CloseIcon, PencilIcon, PlusIcon } from './icons';
import { Controls, Header } from './header';
import { AttachEditor } from './monaco';
import type { EditorEvent } from './monaco';
import { AppMessage } from './messages';
import {
	activeCaseOf,
	activeExampleOf,
	activeFileOf,
	collapsedPercentOf,
	monacoThemeOf,
	problemsOf,
	resolvedThemeOf,
	signatureOf,
	topSplitBounds,
} from './model';
import type { AppModel } from './model';
import { SyncState } from './sync';

import styles from '../App.module.css';
import resultStyles from '../ui/ValidatorResults.module.css';
import editorStyles from '../monaco/MonacoEditor.module.css';

export function AppView(h: Html.H<AppMessage>, model: AppModel) {
	const active = activeFileOf(model);

	if (!active) {
		return h.main.class(styles.empty).children('Add a JSON Schema file to start.');
	}

	const problems = problemsOf(model);
	const theme = resolvedThemeOf(model);
	const monacoTheme = monacoThemeOf(model);
	const shared =
		model.sharedFor !== null &&
		model.sharedFor ===
			signatureOf({
				files: model.files,
				target: model.target,
				keywordPolicy: model.keywordPolicy,
				formatMode: model.formatMode,
				data: model.data,
			});
	const copied = model.copiedFor !== null && model.copiedFor === model.code;
	const activeCase = activeCaseOf(model);
	const { min } = topSplitBounds(model);
	const collapsedPercent = collapsedPercentOf(model);
	const max = 100 - collapsedPercent;

	return h.div
		.class(styles.app)
		.onMount(WatchBrowser().pipe(Mount.map((event) => browserMessage(event))))
		.children(
			Header(h, {
				colorMode: model.colorMode,
				shared,
				children: Controls(h, model),
			}),
			h.div
				.class(styles.workspace)
				.attr('data-workspace', '')
				.attr('data-slot', 'resizable')
				.attr('data-orientation', 'vertical')
				.attr('aria-label', 'Workspace layout')
				.attr('data-dragging', model.splitDragging ? '' : undefined)
				.style({
					display: 'flex',
					flexDirection: 'column',
				})
				.onMount(
					SyncState({
						target: model.target,
						keywordPolicy: model.keywordPolicy,
						formatMode: model.formatMode,
						colorMode: model.colorMode,
						theme,
						files: model.files,
						data: model.data,
					})
				)
				.children(
					h.div
						.class(styles.workspacePanel)
						.attr('id', 'schema-output-row')
						.attr('data-slot', 'resizable-panel')
						.attr('data-orientation', 'vertical')
						.style({
							flex: '1 1 var(--resizable-panel-size, 0px)',
							minWidth: '0',
							minHeight: '0',
							'--resizable-panel-size': `${model.topSplit}%`,
						})
						.children(
							h.div
								.class(styles.workspaceRow)
								.children(
									SchemaPane(h, model, active, problems, monacoTheme),
									OutputPane(h, model, problems, monacoTheme, copied)
								)
						),
					h.div
						.class(styles.resizeHandle)
						.attr('role', 'separator')
						.attr('aria-label', 'Resize schema and test data sections')
						.attr('data-slot', 'resizable-handle')
						.attr('data-orientation', 'vertical')
						.attr('aria-orientation', 'horizontal')
						.attr('aria-controls', 'schema-output-row')
						.attr('tabindex', '0')
						.attr('aria-valuenow', String(Math.round(model.topSplit)))
						.attr('aria-valuemin', String(min))
						.attr('aria-valuemax', String(Math.round(max)))
						.attr('data-hovering', model.splitHovering ? '' : undefined)
						.attr('data-dragging', model.splitDragging ? '' : undefined)
						.on('pointerdown', ({ y }) => AppMessage.PressedSplitter({ y }), {
							capturePointer: true,
						})
						.on('pointermove', ({ y }) => AppMessage.MovedSplitter({ y }))
						.on('pointerup', () => AppMessage.ReleasedSplitter())
						.on('pointercancel', () => AppMessage.ReleasedSplitter())
						.on('mouseenter', () => AppMessage.HoveredSplitter())
						.on('mouseleave', () => AppMessage.LeftSplitter())
						.on('keydown', ({ key, shift }) => AppMessage.PressedSplitterKey({ key, shift }), {
							preventDefault: true,
						}),
					h.div
						.class(styles.workspacePanel)
						.attr('id', 'test-data-row')
						.attr('data-slot', 'resizable-panel')
						.attr('data-orientation', 'vertical')
						.attr('data-collapsed', model.dataCollapsed ? 'true' : undefined)
						.style({
							flex: '1 1 var(--resizable-panel-size, 0px)',
							minWidth: '0',
							minHeight: '0',
							'--resizable-panel-size': `${100 - model.topSplit}%`,
						})
						.children(
							h.div
								.class(styles.workspaceRow)
								.children(DataPane(h, model, monacoTheme), ResultPane(h, model, activeCase))
						)
				)
		);
}

function SchemaPane(
	h: Html.H<AppMessage>,
	model: AppModel,
	active: SchemaFile,
	problems: Problem[],
	monacoTheme: string
) {
	const tabs = model.files.map((file) => ({ value: file.id }));

	return h.section.class(`${styles.pane} ${styles.schemaPane}`).children(
		Tabs(h, {
			key: 'files',
			props: { value: model.activeId, tabs, orientation: 'horizontal' },
			onEmit: {
				Selected: ({ value }) => AppMessage.SelectedFile({ id: value }),
			},
			view: (tabsView) =>
				tabsView
					.root(
						h.div
							.class(styles.tabs)
							.attr('data-slot', 'tabs')
							.attr('data-orientation', 'horizontal')
					)
					.children(
						h.div.class(styles.tabBar).children(
							tabsView
								.list(
									h.div
										.class(styles.tabList)
										.attr('aria-label', 'Schema files')
										.attr('data-testid', 'file-tabs')
										.attr('data-slot', 'tabs-list')
								)
								.children(
									model.files.map((file, index) => {
										const editing = model.editingId === file.id;

										return h.div
											.class(styles.tabItem)
											.attr('role', 'presentation')
											.key(file.id)
											.children(
												tabsView
													.tab({
														element: h.button
															.class(styles.tab)
															.attr('data-slot', 'tabs-tab')
															.attr('data-selected', file.id === model.activeId ? '' : undefined),
														value: file.id,
													})
													.children(
														index === 0
															? h.span.class(styles.rootBadge).children('root')
															: undefined,
														h.span
															.class(`${styles.tabName} ${editing ? styles.tabNameHidden : ''}`)
															.children(file.name),
														editing ? RenameInput(h, model) : undefined,
														fileHasError(file.id, problems)
															? h.span.class(styles.tabError).attr('aria-hidden', 'true')
															: undefined
													),
												TabActions(h, file, editing, model.files.length > 1)
											);
									})
								),
							Button(h, {
								element: h.button.class(styles.addTab).attr('aria-label', 'Add file'),
								onPress: AppMessage.ClickedAddFile(),
							})
								.attr('data-slot', 'button')
								.children(PlusIcon(h)),
							model.renameError
								? h.span.class(styles.renameError).attr('role', 'alert').children(model.renameError)
								: undefined
						),
						tabsView
							.panel({
								element: h.div.class(styles.editorPanel).attr('data-slot', 'tabs-panel'),
								value: model.activeId,
							})
							?.children(SchemaEditors(h, model, active, monacoTheme)),
						h.div.class(styles.statusBar).children(
							h.span(active.name),
							h.span(`Ln ${model.cursorLine}, Col ${model.cursorColumn}`),
							h.span.class(styles.statusActions).children(
								h.span(`${active.content.length} chars`),
								Button(h, {
									element: h.button.class(styles.statusButton),
									onPress: AppMessage.ClickedFormatEditor({ editorId: 'schema' }),
								})
									.attr('data-slot', 'button')
									.children('Format schema')
							)
						)
					),
		}),
		model.fileDragging && !model.dataDragging ? DropOverlay(h, model.fileDragMode) : undefined
	);
}

function RenameInput(h: Html.H<AppMessage>, model: AppModel) {
	return Input(h, {
		props: { value: model.draftName },
		onUpdate: ({ value }) => AppMessage.UpdatedDraftName({ value }),
	})
		.class(styles.tabInput)
		.attr('aria-label', 'File name')
		.attr('aria-invalid', model.renameError ? 'true' : undefined)
		.attr('title', model.renameError ?? undefined)
		.attr('data-rename-input', '')
		.onMount(FocusRename())
		.on(
			'keydown',
			({ key }) =>
				key === 'Enter'
					? AppMessage.ClickedConfirmRename()
					: key === 'Escape'
						? AppMessage.CancelledRename()
						: undefined,
			{ preventDefault: true }
		);
}

const FocusRename = Mount.make('FocusRename', {}, (node: HTMLInputElement) =>
	Effect.sync(() => {
		node.focus();
		node.select();
	}).pipe(Effect.as(Component.noop))
);

function TabActions(h: Html.H<AppMessage>, file: SchemaFile, editing: boolean, canClose: boolean) {
	return h.span.class(styles.tabActions).children(
		Button(h, {
			element: h.button
				.class(styles.tabIcon)
				.attr('aria-label', editing ? 'Confirm rename' : `Rename ${file.name}`)
				.attr('data-confirm-rename', ''),
			onPress: editing
				? AppMessage.ClickedConfirmRename()
				: AppMessage.ClickedRenameFile({ id: file.id }),
		})
			.attr('data-slot', 'button')
			.children(editing ? CheckIcon(h) : PencilIcon(h)),
		editing
			? undefined
			: Button(h, {
					element: h.button
						.class(styles.tabIcon)
						.attr('aria-label', `Close ${file.name}`)
						.attr('data-agent-confirm', 'Deletes this file and its schema from the playground'),
					props: { disabled: !canClose },
					onPress: AppMessage.ClickedCloseFile({ id: file.id }),
				})
					.attr('data-slot', 'button')
					.children(CloseIcon(h))
	);
}

function SchemaEditors(
	h: Html.H<AppMessage>,
	model: AppModel,
	active: SchemaFile,
	monacoTheme: string
) {
	return h.div.class(styles.editorFill).children(
		h.div
			.class(editorStyles.host)
			.attr('data-testid', 'schema-editor')
			.onMount(
				AttachEditor({
					editorId: 'schema',
					value: active.content,
					language: 'json',
					theme: monacoTheme,
					readOnly: false,
					resolveEffectTypes: false,
					ariaLabel: `${active.name} schema`,
					focusRequest: model.focusRequest,
					focusLine: model.focusLine,
					focusColumn: model.focusColumn,
				}).pipe(Mount.map((event) => editorMessage(event, active.id)))
			)
	);
}

function editorMessage(event: EditorEvent, fileId: string): AppMessage | typeof Component.noop {
	if (event.type === 'changed') {
		return AppMessage.UpdatedFileContent({ id: fileId, content: event.value });
	}

	if (event.type === 'cursor') {
		return AppMessage.MovedCursor({ line: event.line, column: event.column });
	}

	return AppMessage.FocusedEditor({ id: fileId });
}

function DropOverlay(h: Html.H<AppMessage>, mode: 'add' | 'replace' | null) {
	return h.div
		.class(styles.dropOverlay)
		.attr('role', 'group')
		.attr('aria-label', 'Import JSON Schema files')
		.attr('data-testid', 'file-drop-overlay')
		.children(
			h.div
				.class(styles.dropTarget)
				.attr('data-drop-mode', 'add')
				.attr('data-active', mode === 'add' ? 'true' : undefined)
				.children(
					h.span.class(styles.dropKicker).children('Add'),
					h.h2.class(styles.dropTitle).children('Add to this workspace'),
					h.p
						.class(styles.dropText)
						.children(
							'Keep the files already open and add every dropped JSON schema as a new tab.'
						),
					h.span.class(styles.dropHint).children('Folders are loaded recursively.')
				),
			h.div
				.class(styles.dropTarget)
				.attr('data-drop-mode', 'replace')
				.attr('data-active', mode === 'replace' ? 'true' : undefined)
				.children(
					h.span.class(styles.dropKicker).children('Replace'),
					h.h2.class(styles.dropTitle).children('Start from the dropped files'),
					h.p
						.class(styles.dropText)
						.children('Close the current files and open only the dropped JSON schemas as tabs.'),
					h.span.class(styles.dropHint).children('Folders are loaded recursively.')
				)
		);
}

function OutputPane(
	h: Html.H<AppMessage>,
	model: AppModel,
	problems: Problem[],
	monacoTheme: string,
	copied: boolean
) {
	const errorCount = problems.filter((problem) => problem.severity === 'error').length;
	const warningCount = problems.length - errorCount;

	return h.section.class(`${styles.pane} ${styles.outputPane}`).children(
		h.div.class(styles.outputHeader).children(
			h.h2.class(styles.heading).children('Generated TypeScript'),
			h.div.class(styles.outputActions).children(
				model.busy ? h.span.class(styles.muted).children('Generating…') : undefined,
				Button(h, {
					props: { disabled: !model.code || model.busy },
					onPress: AppMessage.ClickedCopyCode(),
				})
					.attr('data-slot', 'button')
					.children(copied ? 'Copied' : 'Copy code')
			)
		),
		h.div
			.class(editorStyles.host)
			.attr('data-testid', 'generated-code')
			.onMount(
				AttachEditor({
					editorId: 'code',
					value: model.code || '// Generated code will appear here',
					language: 'typescript',
					theme: monacoTheme,
					readOnly: true,
					path: 'file:///playground/generated.ts',
					resolveEffectTypes: model.target === 'effect',
					ariaLabel: 'Generated TypeScript',
					focusRequest: 0,
					focusLine: 1,
					focusColumn: 1,
				}).pipe(Mount.map(() => Component.noop))
			),
		Collapsible(h, {
			key: 'problems',
			props: { open: !model.problemsCollapsed, keepMounted: true },
			onEmit: {
				Toggled: ({ open }) => AppMessage.ToggledProblems({ open }),
				Settled: () => undefined,
			},
			view: (collapsible) =>
				collapsible
					.root(
						h.div
							.class(styles.problems)
							.attr('aria-label', 'Validation section')
							.attr('data-testid', 'problems')
							.attr('data-slot', 'collapsible')
					)
					.children(
						collapsible
							.trigger(
								h.button
									.class(styles.problemsHeader)
									.attr('data-slot', 'collapsible-trigger')
									.attr('data-closed', model.problemsCollapsed ? '' : undefined)
							)
							.children(
								h.span
									.class(styles.problemsTitle)
									.children(
										h.span.class(styles.heading).children('Validation'),
										ChevronDownIcon(h)
									),
								h.span
									.class(styles.counts)
									.attr('data-severity', errorCount > 0 ? 'error' : 'ok')
									.children(`${errorCount} errors, ${warningCount} warnings`)
							),
						collapsible
							.panel(
								h.div
									.class(styles.problemsBody)
									.attr('id', 'validation-problems')
									.attr('data-slot', 'collapsible-panel')
							)
							?.children(ProblemList(h, problems, model.files))
					),
		})
	);
}

function ProblemList(h: Html.H<AppMessage>, problems: Problem[], files: readonly SchemaFile[]) {
	if (problems.length === 0) {
		return h.p.class(styles.ok).children('No problems found.');
	}

	return ScrollArea(h, {
		key: 'problems-scroll',
		view: (scrollArea) =>
			scrollArea.root(h.div.class(styles.problemScroll).attr('data-slot', 'scroll-area')).children(
				scrollArea
					.viewport(h.div.class(styles.problemViewport).attr('data-slot', 'scroll-area-viewport'))
					.children(
						scrollArea.content(h.div.attr('data-slot', 'scroll-area-content')).children(
							problems.map((problem) =>
								Button(h, {
									element: h.button
										.class(styles.problem)
										.key(
											`${problem.fileId ?? ''}|${problem.severity}|${problem.line ?? ''}|${problem.column ?? ''}|${problem.message}`
										),
									onPress: AppMessage.SelectedProblem({
										fileId: problem.fileId ?? null,
										line: problem.line ?? null,
										column: problem.column ?? null,
									}),
								})
									.attr('data-slot', 'button')
									.children(
										h.span
											.class(styles.severity)
											.children(problem.severity === 'error' ? 'Error' : 'Warning'),
										h.span
											.class(styles.problemFile)
											.children(
												files.find((file) => file.id === problem.fileId)?.name ?? 'project'
											),
										h.span
											.class(styles.problemMessage)
											.children(
												`${problem.message}${
													problem.line
														? ` (line ${problem.line}${problem.column ? `, col ${problem.column}` : ''})`
														: ''
												}`
											)
									)
							)
						)
					),
				scrollArea.scrollbar({
					element: h.div.attr('data-slot', 'scroll-area-scrollbar'),
					thumb: h.div.attr('data-slot', 'scroll-area-thumb'),
					keepMounted: true,
				})
			),
	});
}

function DataPane(h: Html.H<AppMessage>, model: AppModel, monacoTheme: string) {
	const example = activeExampleOf(model);
	const activeCase = example ? exampleCaseForData(example, model.data) : undefined;

	return Collapsible(h, {
		key: 'data',
		props: { open: !model.dataCollapsed, keepMounted: true },
		onEmit: {
			Toggled: ({ open }) => AppMessage.ToggledDataOpen({ open }),
			Settled: () => undefined,
		},
		view: (collapsible) =>
			collapsible
				.root(
					h.section
						.class(`${styles.pane} ${styles.dataPane}`)
						.attr('aria-label', 'Test data section')
						.attr('data-slot', 'collapsible')
						.attr('data-data-drop', '')
						.attr('data-collapsed', model.dataCollapsed ? '' : undefined)
				)
				.children(
					h.div
						.class(`${styles.outputHeader} ${styles.sectionHeader}`)
						.attr('id', 'test-data-header')
						.children(
							collapsible
								.trigger(
									h.button
										.class(styles.sectionToggle)
										.attr('data-slot', 'collapsible-trigger')
										.attr('data-closed', model.dataCollapsed ? '' : undefined)
								)
								.children(h.span.class(styles.heading).children('Test data'), ChevronDownIcon(h)),
							h.div.class(styles.outputActions).children(
								example
									? RadioGroup(h, {
											key: 'cases',
											props: {
												value: activeCase?.value ?? null,
												items: example.cases.map((item) => ({ value: item.value })),
											},
											onEmit: {
												Picked: ({ value }) =>
													typeof value === 'string'
														? AppMessage.PickedTestCase({ value })
														: undefined,
											},
											view: (group) =>
												group
													.root(
														h.div
															.class(styles.cases)
															.attr('aria-label', 'Example test data')
															.attr('data-slot', 'segmented-control')
															.attr('role', 'radiogroup')
															.attr('aria-orientation', 'horizontal')
													)
													.children(
														h.span.class(styles.caseIndicator).attr('aria-hidden', 'true'),
														example.cases.map((item) =>
															group
																.radio({
																	element: h.button
																		.class(styles.case)
																		.attr('data-expect', item.expect)
																		.attr('data-slot', 'segmented-control-item')
																		.style({
																			background:
																				activeCase?.value === item.value
																					? 'var(--ui-foreground)'
																					: undefined,
																		}),
																	value: item.value,
																})
																.children(item.label)
														)
													),
										})
									: undefined,
								Button(h, {
									element: h.button.class(styles.statusButton),
									onPress: AppMessage.ClickedFormatEditor({ editorId: 'data' }),
								})
									.attr('data-slot', 'button')
									.children('Format data')
							)
						),
					collapsible
						.panel(
							h.div
								.class(styles.editorFill)
								.attr('id', 'test-data-editor')
								.attr('data-slot', 'collapsible-panel')
						)
						?.children(
							h.div
								.class(editorStyles.host)
								.attr('data-testid', 'data-editor')
								.onMount(
									AttachEditor({
										editorId: 'data',
										value: model.data,
										language: 'json',
										theme: monacoTheme,
										readOnly: false,
										resolveEffectTypes: false,
										ariaLabel: 'Test data JSON',
										focusRequest: 0,
										focusLine: 1,
										focusColumn: 1,
									}).pipe(Mount.map((event) => dataEditorMessage(event)))
								)
						),
					model.dataDragging && !model.dataCollapsed
						? h.div
								.class(styles.dataDropOverlay)
								.attr('role', 'group')
								.attr('aria-label', 'Drop JSON test data')
								.children(
									h.div
										.class(styles.dropTarget)
										.attr('data-active', 'true')
										.children(
											h.span.class(styles.dropKicker).children('Test data'),
											h.h2.class(styles.dropTitle).children('Drop a JSON document'),
											h.p
												.class(styles.dropText)
												.children('Its content replaces the current test data.')
										)
								)
						: undefined
				),
	});
}

function dataEditorMessage(event: EditorEvent): AppMessage | typeof Component.noop {
	return event.type === 'changed' ? AppMessage.UpdatedData({ value: event.value }) : Component.noop;
}

function ResultPane(
	h: Html.H<AppMessage>,
	model: AppModel,
	activeCase: ReturnType<typeof activeCaseOf>
) {
	return h.section.class(styles.pane).children(
		h.div
			.class(`${styles.outputHeader} ${styles.sectionHeader}`)
			.children(
				h.h2.class(styles.heading).children('Generated validator results'),
				h.span
					.class(styles.muted)
					.children(activeCase ? `Expected: ${activeCase.expect}` : 'Custom test data')
			),
		h.div
			.class(styles.resultBody)
			.attr('id', 'validator-results-panel')
			.attr('hidden', model.dataCollapsed ? '' : undefined)
			.children(ValidatorResults(h, model))
	);
}

function ValidatorResults(h: Html.H<AppMessage>, model: AppModel) {
	const state = model.validation;

	if (state.status === 'unavailable') {
		return h.p.class(resultStyles.message).attr('role', 'status').children(state.reason);
	}

	if (state.status === 'invalid-json') {
		return h.p
			.class(resultStyles.message)
			.attr('role', 'alert')
			.children(`The test data is not valid JSON: ${state.message}`);
	}

	if (state.status === 'error') {
		return h.p.class(resultStyles.message).attr('role', 'alert').children(state.message);
	}

	const result = state.status === 'ready' ? state.result : undefined;
	const status = result === undefined ? 'running' : result.ok ? 'valid' : 'invalid';

	return h.div
		.class(resultStyles.results)
		.attr('data-testid', 'validator-results')
		.children(
			h.section
				.class(resultStyles.card)
				.attr('aria-label', `${targetLabel(model.target)} validation result`)
				.attr('data-testid', `result-${model.target}`)
				.attr('data-status', status)
				.children(
					result === undefined
						? h.p.class(resultStyles.note).children('Compiling the generated schema…')
						: result.ok
							? [
									h.p.class(resultStyles.note).children('Decoded value'),
									h.pre.class(resultStyles.value).children(result.value ?? ''),
								]
							: [
									h.p.class(resultStyles.note).children(failureNote(result)),
									result.error
										? h.p.class(resultStyles.message).children(result.error)
										: IssueList(h, result.issues),
								]
				)
		);
}

function failureNote(result: { issues: readonly unknown[]; error?: string }): string {
	if (result.error) {
		return 'The validator could not run';
	}

	if (result.issues.length > 0) {
		return `${result.issues.length} ${result.issues.length === 1 ? 'issue' : 'issues'}`;
	}

	return 'The validator rejected the data.';
}

function IssueList(h: Html.H<AppMessage>, issues: readonly { path: string; message: string }[]) {
	return h.ul.class(resultStyles.issues).children(
		issues.map((issue) =>
			h.li
				.class(resultStyles.issue)
				.key(JSON.stringify([issue.path, issue.message]))
				.children(
					h.code.class(resultStyles.path).children(issue.path),
					h.span.class(resultStyles.issueMessage).children(issue.message)
				)
		)
	);
}

function targetLabel(target: TargetId): string {
	return targets.find((item) => item.value === target)?.label ?? target;
}

function browserMessage(event: BrowserEvent): AppMessage {
	switch (event._tag) {
		case 'EnteredFiles':
			return AppMessage.EnteredFiles();
		case 'MovedOverFiles':
			return AppMessage.MovedOverFiles({
				mode: event.mode,
				overData: event.overData,
			});
		case 'LeftFiles':
			return AppMessage.LeftFiles();
		case 'DroppedFiles':
			return AppMessage.DroppedSchemas({ schemas: event.schemas, mode: event.mode });
		case 'DroppedData':
			return AppMessage.DroppedData({ content: event.content });
		case 'EndedFileDrag':
			return AppMessage.EndedFileDrag();
		case 'ChangedSystemTheme':
			return AppMessage.ChangedSystemTheme({ dark: event.dark });
		case 'ChangedHistory':
			return AppMessage.ChangedHistory({
				files: event.files,
				target: event.target,
				keywordPolicy: event.keywordPolicy,
				formatMode: event.formatMode,
				data: event.data,
			});
		case 'PressedOutsideRename':
			return AppMessage.PressedOutsideRename();
		case 'MeasuredLayout':
			return AppMessage.MeasuredLayout({
				headerHeight: event.headerHeight,
				workspaceHeight: event.workspaceHeight,
				workspaceTop: event.workspaceTop,
			});
	}
}
