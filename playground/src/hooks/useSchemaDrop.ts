import type { SchemaFile } from '../bundle';
import type { DropMode } from '../drop';
import { clearExampleUrl } from '../playgroundUrl';
import { useFileDrop } from '../useFileDrop';
import { nameDroppedFiles, readDroppedSchemaFiles, rootFirst } from './schemaFiles';

export interface SchemaDropOptions {
	files: SchemaFile[];
	setFiles: (files: SchemaFile[]) => void;
	setActiveId: (id: string) => void;
	cancelRename: () => void;
}

/** Wires file drop to add or replace the schema workspace. */
export function useSchemaDrop({ files, setFiles, setActiveId, cancelRename }: SchemaDropOptions) {
	const { dragging, activeMode, drop } = useFileDrop({
		onDrop: (dataTransfer, mode) => {
			void handleDrop(dataTransfer, mode);
		},
	});

	async function handleDrop(dataTransfer: DataTransfer, mode: DropMode) {
		const schemas = await readDroppedSchemaFiles(dataTransfer);

		if (!schemas || schemas.length === 0) {
			return;
		}

		const base = mode === 'replace' ? [] : files;
		const added = nameDroppedFiles(schemas, base);

		clearExampleUrl();
		cancelRename();

		if (mode === 'add') {
			setFiles([...files, ...added]);
			setActiveId(added[0].id);
			return;
		}

		const next = rootFirst(added);
		setFiles(next);
		setActiveId(next[0].id);
	}

	return { dragging, activeMode, drop };
}
