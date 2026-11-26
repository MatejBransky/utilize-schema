import { useState } from 'react';
import type { DragEvent as ReactDragEvent } from 'react';

import { isElement } from './dom';
import { collectDroppedFiles, hasFileDrag, readDroppedSchemas } from './drop';

export interface DataDropOptions {
	collapsed: boolean;
	onData: (content: string) => void;
}

interface DataDropHandlers {
	onDragEnter: (event: ReactDragEvent<HTMLElement>) => void;
	onDragOver: (event: ReactDragEvent<HTMLElement>) => void;
	onDragLeave: (event: ReactDragEvent<HTMLElement>) => void;
	onDrop: (event: ReactDragEvent<HTMLElement>) => void;
}

export function useDataDrop({ collapsed, onData }: DataDropOptions) {
	const [dragging, setDragging] = useState(false);

	function allowDrop(event: ReactDragEvent<HTMLElement>) {
		if (collapsed || !hasFileDrag(event.dataTransfer)) {
			return;
		}

		event.preventDefault();
		event.dataTransfer.dropEffect = 'copy';
		setDragging(true);
	}

	function leaveDrop(event: ReactDragEvent<HTMLElement>) {
		const next = event.relatedTarget;

		if (isElement(next) && event.currentTarget.contains(next)) {
			return;
		}

		setDragging(false);
	}

	function drop(event: ReactDragEvent<HTMLElement>) {
		if (collapsed || !hasFileDrag(event.dataTransfer)) {
			return;
		}

		event.preventDefault();
		setDragging(false);
		void readData(event.dataTransfer);
	}

	async function readData(dataTransfer: DataTransfer) {
		const documents = await readDroppedSchemas(await collectDroppedFiles(dataTransfer)).catch(
			() => null
		);
		const document = documents?.[0];

		if (document) {
			onData(document.content);
		}
	}

	return {
		dragging,
		handlers: {
			onDragEnter: allowDrop,
			onDragOver: allowDrop,
			onDragLeave: leaveDrop,
			onDrop: drop,
		} satisfies DataDropHandlers,
	};
}
