import './global.css';
import './ui.css';
import './polyfills';
import './monaco/setup';

import { BrowserHost } from '@effect/ui/html';
import { Effect, Layer } from 'effect';

import { App } from './app/App';

const root = document.getElementById('root');

if (!root) {
	throw new Error('Expected the playground root element.');
}

Layer.launch(BrowserHost.mount(App, {}, root)).pipe(Effect.runFork);
