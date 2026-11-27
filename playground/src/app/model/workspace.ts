import type { SchemaFile } from '../../bundle';
import { workspaceOf } from './derived';
import type { AppModel } from './schemas';

export function withWorkspace(
	model: AppModel,
	files: readonly SchemaFile[],
	keywordPolicy = model.keywordPolicy
) {
	const nextFiles = [...files];
	const derived = workspaceOf(nextFiles, keywordPolicy);
	const activeId = nextFiles.some((file) => file.id === model.activeId)
		? model.activeId
		: (nextFiles[0]?.id ?? '');

	return { ...model, files: nextFiles, activeId, ...derived };
}
