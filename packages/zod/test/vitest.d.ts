/* eslint-disable @typescript-eslint/no-explicit-any */
/* eslint-disable @typescript-eslint/no-empty-object-type */
import 'vitest';
import type { z } from 'zod/v4';

interface CustomMatchers<R = unknown> {
	toMatchCode: (expectedCode: Promise<string>) => R;
}

declare module 'vitest' {
	interface Matchers<T = any> extends CustomMatchers<T> {}
}
