import './global.css';
import './ui.css';
import './polyfills';
import './monaco/setup';

import { expectDefined } from '@utilize/json-schema';
import { BrowserHost } from '@effect/ui/html';
import { Effect, Layer } from 'effect';

import { App } from './app/App';

const root = expectDefined(document.getElementById('root'));

// The inspector is opt-in for a preview or a production build (`?devtools`) and
// automatic in local development. Playwright sets `navigator.webdriver`, so the
// end-to-end suite runs without the overlay.
const search = new URLSearchParams(location.search);
const devTools = search.has('devtools') || (import.meta.env.DEV && !navigator.webdriver);

const layer = devTools
	? (await import('@effect/ui-devtools')).DevTools.layer({ position: 'BottomRight' })
	: Layer.empty;

Layer.launch(BrowserHost.mount(App, {}, root).pipe(Layer.provide(layer))).pipe(Effect.runFork);
