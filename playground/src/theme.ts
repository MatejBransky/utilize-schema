export type ColorMode = 'auto' | 'light' | 'dark';

export const THEME_STORAGE_KEY = 'utilize-schema-theme';

function isColorMode(value: unknown): value is ColorMode {
	return value === 'auto' || value === 'light' || value === 'dark';
}

export function loadColorMode(): ColorMode {
	try {
		const saved = localStorage.getItem(THEME_STORAGE_KEY);

		return isColorMode(saved) ? saved : 'auto';
	} catch {
		return 'auto';
	}
}
