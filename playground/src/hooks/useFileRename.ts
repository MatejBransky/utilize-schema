import { useEffect, useState } from 'react';

import type { SchemaFile } from '../bundle';
import { isElement } from '../dom';
import { hasFileNamed } from './schemaFiles';

export interface RenameOptions {
	files: SchemaFile[];
	updateFile: (id: string, patch: Partial<SchemaFile>) => void;
}

/** Inline filename editing, including click-away dismissal and duplicate checks. */
export function useFileRename({ files, updateFile }: RenameOptions) {
	const [editingId, setEditingId] = useState<string | null>(null);
	const [draftName, setDraftName] = useState('');
	const [renameError, setRenameError] = useState<string | null>(null);

	useEffect(() => {
		if (!editingId) {
			return;
		}

		const onPointerDown = (event: PointerEvent) => {
			const clickTarget = event.target;

			if (
				isElement(clickTarget) &&
				(clickTarget.closest('[data-rename-input]') || clickTarget.closest('[data-confirm-rename]'))
			) {
				return;
			}

			setEditingId(null);
		};

		document.addEventListener('pointerdown', onPointerDown, true);

		return () => document.removeEventListener('pointerdown', onPointerDown, true);
	}, [editingId]);

	function startRename(file: SchemaFile) {
		setEditingId(file.id);
		setDraftName(file.name);
		setRenameError(null);
	}

	function commitRename() {
		if (!editingId) {
			return;
		}

		const name = draftName.trim();

		if (name && hasFileNamed(files, editingId, name)) {
			setRenameError('A file with this name already exists.');
			return;
		}

		setRenameError(null);
		if (name) {
			updateFile(editingId, { name });
		}
		setEditingId(null);
	}

	/** Stops editing without committing, for workspace-wide replacements. */
	function cancelRename() {
		setEditingId(null);
	}

	return {
		editingId,
		setEditingId,
		draftName,
		setDraftName,
		renameError,
		startRename,
		commitRename,
		cancelRename,
	};
}
