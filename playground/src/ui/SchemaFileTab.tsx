import { Button } from '@ui-sdk/react/button';
import { Input } from '@ui-sdk/react/input';
import { TabsTab } from '@ui-sdk/react/tabs';

import type { SchemaFile } from '../bundle';
import { CheckIcon, CloseIcon, PencilIcon } from './icons';

import styles from '../App.module.css';

export interface SchemaFileTabProps {
	file: SchemaFile;
	index: number;
	editing: boolean;
	hasError: boolean;
	canClose: boolean;
	draftName: string;
	renameError: string | null;
	onDraftNameChange(value: string): void;
	onCancelRename(): void;
	onCommitRename(): void;
	onStartRename(file: SchemaFile): void;
	onCloseFile(id: string): void;
}

export function SchemaFileTab({
	file,
	index,
	editing,
	hasError,
	canClose,
	draftName,
	renameError,
	onDraftNameChange,
	onCancelRename,
	onCommitRename,
	onStartRename,
	onCloseFile,
}: SchemaFileTabProps) {
	return (
		<div className={styles.tabItem} role="presentation">
			<TabsTab value={file.id} className={styles.tab} render={<div />}>
				{index === 0 ? (
					<>
						<span className={styles.rootBadge}>root</span>{' '}
					</>
				) : null}
				<span className={`${styles.tabName} ${editing ? styles.tabNameHidden : ''}`}>
					{file.name}
				</span>
				{editing ? (
					<RenameInput
						value={draftName}
						error={renameError}
						onValueChange={onDraftNameChange}
						onCancel={onCancelRename}
						onCommit={onCommitRename}
					/>
				) : null}
				{hasError ? <span className={styles.tabError} aria-hidden="true" /> : null}
			</TabsTab>
			<TabActions
				file={file}
				editing={editing}
				canClose={canClose}
				onCommit={onCommitRename}
				onStart={onStartRename}
				onClose={onCloseFile}
			/>
		</div>
	);
}

interface RenameInputProps {
	value: string;
	error: string | null;
	onValueChange(value: string): void;
	onCancel(): void;
	onCommit(): void;
}

function RenameInput({ value, error, onValueChange, onCancel, onCommit }: RenameInputProps) {
	return (
		<Input
			className={styles.tabInput}
			aria-label="File name"
			aria-invalid={error ? true : undefined}
			title={error ?? undefined}
			data-rename-input=""
			value={value}
			autoFocus
			onValueChange={onValueChange}
			onFocus={(event) => event.currentTarget.select()}
			onKeyDown={(event) => {
				if (event.key === 'Enter') {
					event.preventDefault();
					onCommit();
				} else if (event.key === 'Escape') {
					onCancel();
				}
			}}
		/>
	);
}

interface TabActionsProps {
	file: SchemaFile;
	editing: boolean;
	canClose: boolean;
	onCommit(): void;
	onStart(file: SchemaFile): void;
	onClose(id: string): void;
}

function TabActions({ file, editing, canClose, onCommit, onStart, onClose }: TabActionsProps) {
	return (
		<span className={styles.tabActions}>
			<Button
				className={styles.tabIcon}
				aria-label={editing ? 'Confirm rename' : `Rename ${file.name}`}
				data-confirm-rename=""
				onClick={() => {
					if (editing) {
						onCommit();
					} else {
						onStart(file);
					}
				}}
			>
				{editing ? <CheckIcon /> : <PencilIcon />}
			</Button>
			{editing ? null : (
				<Button
					className={styles.tabIcon}
					aria-label={`Close ${file.name}`}
					disabled={!canClose}
					data-agent-confirm="Deletes this file and its schema from the playground"
					onClick={() => onClose(file.id)}
				>
					<CloseIcon />
				</Button>
			)}
		</span>
	);
}
