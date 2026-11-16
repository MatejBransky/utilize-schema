import '@ui-sdk/core/web.css';
import { configure } from 'vitest-browser-react/pure';

import '../global.css';

declare global {
	var __UI_SDK_STRICT__: boolean | undefined;
}

globalThis.__UI_SDK_STRICT__ = true;
configure({ reactStrictMode: true });
