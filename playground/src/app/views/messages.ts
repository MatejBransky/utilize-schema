import { Component } from '@effect/ui';

import type { BrowserEvent } from '../browser';
import { AppMessage } from '../messages';
import type { EditorEvent } from '../monaco';

export function browserMessage(event: BrowserEvent): AppMessage {
	switch (event._tag) {
		case 'EnteredFiles':
			return AppMessage.EnteredFiles();
		case 'MovedOverFiles':
			return AppMessage.MovedOverFiles({ mode: event.mode, overData: event.overData });
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

export function editorMessage(
	event: EditorEvent,
	fileId: string
): AppMessage | typeof Component.noop {
	if (event.type === 'changed') {
		return AppMessage.UpdatedFileContent({ id: fileId, content: event.value });
	}

	if (event.type === 'cursor') {
		return AppMessage.MovedCursor({ line: event.line, column: event.column });
	}

	return AppMessage.FocusedEditor({ id: fileId });
}

export function dataEditorMessage(event: EditorEvent): AppMessage | typeof Component.noop {
	return event.type === 'changed' ? AppMessage.UpdatedData({ value: event.value }) : Component.noop;
}
