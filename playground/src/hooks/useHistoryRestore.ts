import { useEffect } from 'react';

import { loadState } from '../playgroundState';
import type { SchemaFile } from '../bundle';
import type { SettingsSetters } from './types';

export interface HistoryRestoreOptions extends SettingsSetters {
	setFiles: (files: SchemaFile[]) => void;
	setActiveId: (id: string) => void;
	cancelRename: () => void;
}

/** Restores the whole workspace when the browser navigates through history. */
export function useHistoryRestore({
	setFiles,
	setTarget,
	setKeywordPolicy,
	setFormatMode,
	setInference,
	setData,
	setActiveId,
	cancelRename,
}: HistoryRestoreOptions) {
	useEffect(() => {
		const onPopState = () => {
			const next = loadState();
			setFiles(next.files);
			setTarget(next.target);
			setKeywordPolicy(next.keywordPolicy);
			setFormatMode(next.formatMode);
			setInference(next.inference);
			setData(next.data);
			setActiveId(next.files[0]?.id ?? '');
			cancelRename();
		};

		window.addEventListener('popstate', onPopState);

		return () => window.removeEventListener('popstate', onPopState);
	}, [
		setFiles,
		setTarget,
		setKeywordPolicy,
		setFormatMode,
		setInference,
		setData,
		setActiveId,
		cancelRename,
	]);
}
