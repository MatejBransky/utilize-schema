import type { RuntimeSource } from '../../generateCode';
import type { RuntimeModel } from './schemas';

export function toRuntimeModel(runtime: RuntimeSource | null): RuntimeModel | null {
	if (!runtime) {
		return null;
	}

	if (runtime.status === 'failed') {
		return { status: 'failed', message: runtime.error.message };
	}

	return {
		status: 'generated',
		code: runtime.code,
		runtimeCode: runtime.runtimeCode,
		rootName: runtime.rootName,
	};
}

export function toRuntimeSource(runtime: RuntimeModel | null): RuntimeSource | null {
	if (!runtime) {
		return null;
	}

	if (runtime.status === 'failed') {
		return { status: 'failed', error: new Error(runtime.message) };
	}

	return {
		status: 'generated',
		code: runtime.code,
		runtimeCode: runtime.runtimeCode,
		rootName: runtime.rootName,
	};
}
