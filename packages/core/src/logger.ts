export enum LogLevel {
	DEBUG = 'debug',
	INFO = 'info',
	WARN = 'warn',
	ERROR = 'error',
}

const NODE_COLORS = {
	[LogLevel.DEBUG]: '\x1b[36m', // cyan
	[LogLevel.INFO]: '\x1b[32m', // green
	[LogLevel.WARN]: '\x1b[33m', // yellow
	[LogLevel.ERROR]: '\x1b[31m', // red
	namespace: '\x1b[35m', // magenta for namespace
	reset: '\x1b[0m',
};

const BROWSER_COLORS = {
	[LogLevel.DEBUG]: 'color: cyan',
	[LogLevel.INFO]: 'color: green',
	[LogLevel.WARN]: 'color: orange',
	[LogLevel.ERROR]: 'color: red',
	namespace: 'color: magenta; font-weight: bold',
};

function isNode() {
	return typeof process !== 'undefined' && process.versions?.node;
}

type NamespaceConfig = {
	enabled: boolean;
	levels?: Set<LogLevel>;
};

export class Logger {
	private enabledLevels: Set<LogLevel>;
	private namespaces: Map<string, NamespaceConfig>;

	constructor(
		levels: LogLevel[] = [LogLevel.INFO, LogLevel.WARN, LogLevel.ERROR]
	) {
		this.enabledLevels = new Set(levels);
		this.namespaces = new Map();
	}

	setGlobalLevels(levels: LogLevel[]) {
		this.enabledLevels = new Set(levels);
	}

	enable(level: LogLevel) {
		this.enabledLevels.add(level);
	}

	disable(level: LogLevel) {
		this.enabledLevels.delete(level);
	}

	enableNamespace(namespace: string) {
		const config = this.namespaces.get(namespace) || {};
		this.namespaces.set(namespace, { ...config, enabled: true });
	}

	disableNamespace(namespace: string) {
		const config = this.namespaces.get(namespace) || {};
		this.namespaces.set(namespace, { ...config, enabled: false });
	}

	setNamespaceLevels(namespace: string, levels: LogLevel[]) {
		const config = this.namespaces.get(namespace) || { enabled: true };
		this.namespaces.set(namespace, { ...config, levels: new Set(levels) });
	}

	withNamespace(namespace: string) {
		const accumulatedLogs = new Map<unknown, unknown[]>();
		const logMethods = {
			debug: (...args: unknown[]) =>
				this.log(namespace, LogLevel.DEBUG, ...args),
			info: (...args: unknown[]) => this.log(namespace, LogLevel.INFO, ...args),
			warn: (...args: unknown[]) => this.log(namespace, LogLevel.WARN, ...args),
			error: (...args: unknown[]) =>
				this.log(namespace, LogLevel.ERROR, ...args),
		};
		return {
			...logMethods,
			/**
			 * Accumulates a log message under the given context key.
			 * Messages are stored until flush() is called.
			 */
			accumulate: (key: unknown, ...logs: unknown[]) => {
				if (!accumulatedLogs.has(key)) {
					accumulatedLogs.set(key, []);
				}
				logs.push('\n');
				accumulatedLogs.get(key)?.push(...logs);
			},
			flush: (key: unknown) => {
				const output = accumulatedLogs.get(key);
				accumulatedLogs.delete(key);
				return output;
			},
		};
	}

	private isNamespaceEnabled(namespace: string, level: LogLevel): boolean {
		const config = this.namespaces.get(namespace);
		if (config && config.enabled === false) return false;
		const allowedLevels = config?.levels ?? this.enabledLevels;
		return allowedLevels.has(level);
	}

	log(namespace: string, level: LogLevel, ...args: unknown[]) {
		if (!this.isNamespaceEnabled(namespace, level)) return;
		if (isNode()) {
			const nsColor = NODE_COLORS.namespace;
			const levelColor = NODE_COLORS[level] || '';
			const reset = NODE_COLORS.reset;
			console.log(
				`${nsColor}[${namespace}]${reset} ${levelColor}[${level.toUpperCase()}]${reset}`,
				...args
			);
		} else {
			const nsStyle = BROWSER_COLORS.namespace;
			const levelStyle = BROWSER_COLORS[level] || '';
			console.log(
				`%c[${namespace}]%c [${level.toUpperCase()}]`,
				nsStyle,
				levelStyle,
				...args
			);
		}
	}
}

export const logger = new Logger();
logger.setGlobalLevels([
	LogLevel.DEBUG,
	LogLevel.INFO,
	LogLevel.WARN,
	LogLevel.ERROR,
]);
