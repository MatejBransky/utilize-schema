import { useState } from 'react';

import type { SchemaFile } from '../bundle';
import { clearExampleUrl } from '../playgroundUrl';
import { newFileId, uniqueName } from '../playgroundState';
import { useFileRename } from './useFileRename';
import { useHistoryRestore } from './useHistoryRestore';
import { useSchemaDrop } from './useSchemaDrop';
import type { SettingsSetters } from './types';

/** Schema file list, selection, and the operations that mutate either. */
export function useSchemaFiles(initialFiles: SchemaFile[], settings: SettingsSetters) {
	const [files, setFiles] = useState<SchemaFile[]>(initialFiles);
	const [activeId, setActiveId] = useState(initialFiles[0]?.id ?? '');

	// A restored or dropped workspace can remove the selected file. Derive a
	// usable id during render instead of repairing the state in an effect.
	const activeFile = files.find((file) => file.id === activeId) ?? files[0];
	const currentId = activeFile?.id ?? '';

	function updateFile(id: string, patch: Partial<SchemaFile>) {
		clearExampleUrl();
		setFiles((current) => current.map((file) => (file.id === id ? { ...file, ...patch } : file)));
	}

	const rename = useFileRename({ files, updateFile });
	const { cancelRename } = rename;

	useHistoryRestore({
		...settings,
		setFiles,
		setActiveId,
		cancelRename,
	});

	const { dragging, activeMode, drop } = useSchemaDrop({
		files,
		setFiles,
		setActiveId,
		cancelRename,
	});

	function addFile() {
		const id = newFileId();
		const name = uniqueName('untitled.json', files);

		clearExampleUrl();

		setFiles((current) => [...current, { id, name, content: '{\n  "type": "object"\n}' }]);
		setActiveId(id);
	}

	function closeFile(id: string) {
		if (files.length <= 1) {
			return;
		}

		const next = files.filter((file) => file.id !== id);

		clearExampleUrl();
		if (rename.editingId === id) {
			cancelRename();
		}
		setFiles(next);
		if (activeId === id) {
			setActiveId(next[0].id);
		}
	}

	function applyExample(nextFiles: SchemaFile[]) {
		setFiles(nextFiles);
		setActiveId(nextFiles[0]?.id ?? '');
		cancelRename();
	}

	return {
		files,
		activeId: currentId,
		setActiveId,
		editingId: rename.editingId,
		setEditingId: rename.setEditingId,
		draftName: rename.draftName,
		setDraftName: rename.setDraftName,
		renameError: rename.renameError,
		updateFile,
		addFile,
		closeFile,
		startRename: rename.startRename,
		commitRename: rename.commitRename,
		applyExample,
		dragging,
		activeMode,
		drop,
	};
}
