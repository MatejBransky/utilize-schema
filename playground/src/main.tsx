import '@ui-sdk/core/web.css';
import './global.css';
import './polyfills';
import './monaco/setup';

import { StrictMode } from 'react';
import { createRoot, type Root } from 'react-dom/client';

import App from './App';

/**
 * Mounts the playground into `element`. The browser tests call it with a fresh
 * node; the entry below calls it with `#root` from `index.html`.
 */
export function mount(element: HTMLElement): Root {
	const root = createRoot(element);

	root.render(
		<StrictMode>
			<App />
		</StrictMode>
	);

	return root;
}

const root = document.getElementById('root');

if (root) {
	mount(root);
}
