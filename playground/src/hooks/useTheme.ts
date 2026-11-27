import { useEffect, useState, useSyncExternalStore } from 'react';

import type { ColorMode } from '../theme';
import { loadColorMode, THEME_STORAGE_KEY } from '../theme';

function subscribeSystemDark(onChange: () => void): () => void {
	const query = window.matchMedia('(prefers-color-scheme: dark)');

	query.addEventListener('change', onChange);

	return () => query.removeEventListener('change', onChange);
}

function systemDarkSnapshot(): boolean {
	return window.matchMedia('(prefers-color-scheme: dark)').matches;
}

/** Color mode, its resolved theme and the matching Monaco theme id. */
export function useTheme() {
	const [colorMode, setColorMode] = useState<ColorMode>(loadColorMode);
	const systemDark = useSyncExternalStore(subscribeSystemDark, systemDarkSnapshot, () => false);
	const resolvedTheme = colorMode === 'auto' ? (systemDark ? 'dark' : 'light') : colorMode;
	const monacoTheme = resolvedTheme === 'dark' ? 'utilize-dark' : 'utilize-light';

	useEffect(() => {
		document.documentElement.dataset.theme = resolvedTheme;

		try {
			localStorage.setItem(THEME_STORAGE_KEY, colorMode);
		} catch {
			// Theme persistence is optional.
		}
	}, [colorMode, resolvedTheme]);

	return { colorMode, setColorMode, resolvedTheme, monacoTheme };
}
