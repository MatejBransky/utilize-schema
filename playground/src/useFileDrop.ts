import { useEffect, useRef, useState } from 'react';
import type { DragEvent as ReactDragEvent } from 'react';

import { hasFileDrag, type DropMode } from './drop';

interface FileDropOptions {
	onDrop(dataTransfer: DataTransfer, mode: DropMode): void;
}

export function useFileDrop({ onDrop }: FileDropOptions) {
	const [dragging, setDragging] = useState(false);
	const dropHandler = useRef(onDrop);

	dropHandler.current = onDrop;

	useEffect(() => {
		const show = (event: DragEvent) => {
			if (!hasFileDrag(event.dataTransfer)) {
				return;
			}

			event.preventDefault();
			setDragging(true);
		};

		const allowDrop = (event: DragEvent) => {
			if (!hasFileDrag(event.dataTransfer)) {
				return;
			}

			event.preventDefault();
			if (event.dataTransfer) {
				event.dataTransfer.dropEffect = 'copy';
			}
		};

		const hide = (event: DragEvent) => {
			if (event.relatedTarget === null) {
				setDragging(false);
			}
		};

		const finish = (event: DragEvent) => {
			if (!hasFileDrag(event.dataTransfer)) {
				return;
			}

			event.preventDefault();
			setDragging(false);
		};

		window.addEventListener('dragenter', show);
		window.addEventListener('dragover', allowDrop);
		window.addEventListener('dragleave', hide);
		window.addEventListener('drop', finish);
		window.addEventListener('dragend', finish);

		return () => {
			window.removeEventListener('dragenter', show);
			window.removeEventListener('dragover', allowDrop);
			window.removeEventListener('dragleave', hide);
			window.removeEventListener('drop', finish);
			window.removeEventListener('dragend', finish);
		};
	}, []);

	function drop(event: ReactDragEvent<HTMLElement>, mode: DropMode) {
		event.preventDefault();
		event.stopPropagation();
		setDragging(false);

		if (event.dataTransfer) {
			dropHandler.current(event.dataTransfer, mode);
		}
	}

	return { dragging, drop };
}
