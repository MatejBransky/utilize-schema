import '@ui-sdk/core/web.css';
import './global.css';
import './polyfills';
import './monaco/setup';

import { expectDefined } from '@utilize/json-schema';
import { StrictMode } from 'react';
import { createRoot } from 'react-dom/client';

import App from './App';

createRoot(expectDefined(document.getElementById('root'))).render(
	<StrictMode>
		<App />
	</StrictMode>
);
