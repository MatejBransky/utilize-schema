import { useEffect, useRef, useState } from 'react';
import type { DragEvent as ReactDragEvent } from 'react';

import { hasFileDrag } from './drop';
import type { DropMode } from './drop';

export interface FileDropOptions {
	onDrop: (dataTransfer: DataTransfer, mode: DropMode) => void;
}

export function useFileDrop({ onDrop }: FileDropOptions) {
	const [dragging, setDragging] = useState(false);
	const [activeMode, setActiveMode] = useState<DropMode | null>(null);
	const dropHandler = useRef(onDrop);

	useEffect(() => {
		dropHandler.current = onDrop;
	}, [onDrop]);

	useEffect(() => {
		const reset = () => {
			setDragging(false);
			setActiveMode(null);
		};

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
			setActiveMode(dropModeAt(event.target));
		};

		const hide = (event: DragEvent) => {
			if (event.relatedTarget === null) {
				reset();
			}
		};

		const finish = (event: DragEvent) => {
			if (!hasFileDrag(event.dataTransfer)) {
				return;
			}

			event.preventDefault();
			reset();
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
		setActiveMode(null);

		if (event.dataTransfer) {
			dropHandler.current(event.dataTransfer, mode);
		}
	}

	return { dragging, activeMode, drop };
}

function dropModeAt(target: EventTarget | null): DropMode | null {
	if (!(target instanceof Element)) {
		return null;
	}

	const mode = target.closest('[data-drop-mode]')?.getAttribute('data-drop-mode');

	return mode === 'add' || mode === 'replace' ? mode : null;
}
