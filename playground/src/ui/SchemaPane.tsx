import { Button } from '@ui-sdk/react/button';
import { Tabs, TabsList, TabsPanel } from '@ui-sdk/react/tabs';
import type { DragEvent as ReactDragEvent, RefObject } from 'react';

import type { Problem, SchemaFile } from '../bundle';
import type { DropMode } from '../drop';
import { MonacoEditor, type MonacoEditorHandle } from '../monaco/MonacoEditor';
import type { Playground } from '../playgroundHooks';
import { fileHasError } from '../problems';
import { PlusIcon } from './icons';
import { SchemaFileTab } from './SchemaFileTab';

import styles from '../App.module.css';

interface Position {
	line: number;
	column: number;
}

export type SchemaPaneModel = Pick<
	Playground,
	| 'files'
	| 'problems'
	| 'monacoTheme'
	| 'editingId'
	| 'draftName'
	| 'renameError'
	| 'schemaEditorRef'
	| 'cursor'
	| 'dragging'
	| 'activeMode'
	| 'setActiveId'
	| 'setDraftName'
	| 'setEditingId'
	| 'commitRename'
	| 'startRename'
	| 'closeFile'
	| 'addFile'
	| 'updateFile'
	| 'setCursor'
	| 'drop'
>;

export interface SchemaPaneProps {
	playground: SchemaPaneModel;
	active: SchemaFile;
}

export function SchemaPane({ playground, active }: SchemaPaneProps) {
	const {
		files,
		problems,
		monacoTheme,
		editingId,
		draftName,
		renameError,
		schemaEditorRef,
		cursor,
		dragging,
		activeMode,
		setActiveId: onActiveChange,
		setDraftName: onDraftNameChange,
		setEditingId,
		commitRename: onCommitRename,
		startRename: onStartRename,
		closeFile: onCloseFile,
		addFile: onAddFile,
		updateFile: onUpdateFile,
		setCursor: onCursorChange,
		drop: onDrop,
	} = playground;
	return (
		<section className={`${styles.pane} ${styles.schemaPane}`}>
			<Tabs
				className={styles.tabs}
				value={active.id}
				onValueChange={(value) => {
					if (value) {
						onActiveChange(value);
					}
				}}
			>
				<div className={styles.tabBar}>
					<SchemaFileTabs
						files={files}
						problems={problems}
						editingId={editingId}
						draftName={draftName}
						renameError={renameError}
						onDraftNameChange={onDraftNameChange}
						onCancelRename={() => setEditingId(null)}
						onCommitRename={onCommitRename}
						onStartRename={onStartRename}
						onCloseFile={onCloseFile}
						onAddFile={onAddFile}
					/>
				</div>

				<SchemaEditors
					files={files}
					active={active}
					monacoTheme={monacoTheme}
					schemaEditorRef={schemaEditorRef}
					onUpdateFile={onUpdateFile}
					onCursorChange={onCursorChange}
				/>
				<SchemaStatusBar active={active} cursor={cursor} schemaEditorRef={schemaEditorRef} />
			</Tabs>
			{dragging ? <DropOverlay activeMode={activeMode} onDrop={onDrop} /> : null}
		</section>
	);
}

interface SchemaFileTabsProps {
	files: SchemaFile[];
	problems: Problem[];
	editingId: string | null;
	draftName: string;
	renameError: string | null;
	onDraftNameChange(value: string): void;
	onCancelRename(): void;
	onCommitRename(): void;
	onStartRename(file: SchemaFile): void;
	onCloseFile(id: string): void;
	onAddFile(): void;
}

function SchemaFileTabs({
	files,
	problems,
	editingId,
	draftName,
	renameError,
	onDraftNameChange,
	onCancelRename,
	onCommitRename,
	onStartRename,
	onCloseFile,
	onAddFile,
}: SchemaFileTabsProps) {
	return (
		<>
			<TabsList aria-label="Schema files" className={styles.tabList} data-testid="file-tabs">
				{files.map((file, index) => (
					<SchemaFileTab
						key={file.id}
						file={file}
						index={index}
						editing={editingId === file.id}
						hasError={fileHasError(file.id, problems)}
						canClose={files.length > 1}
						draftName={draftName}
						renameError={renameError}
						onDraftNameChange={onDraftNameChange}
						onCancelRename={onCancelRename}
						onCommitRename={onCommitRename}
						onStartRename={onStartRename}
						onCloseFile={onCloseFile}
					/>
				))}
			</TabsList>
			<Button className={styles.addTab} aria-label="Add file" onClick={onAddFile}>
				<PlusIcon />
			</Button>
			{renameError ? (
				<span className={styles.renameError} role="alert">
					{renameError}
				</span>
			) : null}
		</>
	);
}

interface SchemaEditorsProps {
	files: SchemaFile[];
	active: SchemaFile;
	monacoTheme: string;
	schemaEditorRef: RefObject<MonacoEditorHandle | null>;
	onUpdateFile(id: string, patch: Partial<SchemaFile>): void;
	onCursorChange(position: Position): void;
}

function SchemaEditors({
	files,
	active,
	monacoTheme,
	schemaEditorRef,
	onUpdateFile,
	onCursorChange,
}: SchemaEditorsProps) {
	return (
		<>
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
							onChange={(content) => onUpdateFile(file.id, { content })}
							onCursorChange={(line, column) => onCursorChange({ line, column })}
						/>
					</div>
				</TabsPanel>
			))}
		</>
	);
}

interface SchemaStatusBarProps {
	active: SchemaFile;
	cursor: Position;
	schemaEditorRef: RefObject<MonacoEditorHandle | null>;
}

function SchemaStatusBar({ active, cursor, schemaEditorRef }: SchemaStatusBarProps) {
	return (
		<div className={styles.statusBar}>
			<span>{active.name}</span>
			<span>
				Ln {cursor.line}, Col {cursor.column}
			</span>
			<span className={styles.statusActions}>
				<span>{active.content.length} chars</span>
				<Button className={styles.statusButton} onClick={() => schemaEditorRef.current?.format()}>
					Format schema
				</Button>
			</span>
		</div>
	);
}

interface DropOverlayProps {
	activeMode: DropMode | null;
	onDrop(event: ReactDragEvent<HTMLElement>, mode: DropMode): void;
}

function DropOverlay({ activeMode, onDrop }: DropOverlayProps) {
	return (
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
				onDrop={(event) => onDrop(event, 'add')}
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
				onDrop={(event) => onDrop(event, 'replace')}
			>
				<span className={styles.dropKicker}>Replace</span>
				<h2 className={styles.dropTitle}>Start from the dropped files</h2>
				<p className={styles.dropText}>
					Close the current files and open only the dropped JSON schemas as tabs.
				</p>
				<span className={styles.dropHint}>Folders are loaded recursively.</span>
			</div>
		</div>
	);
}
