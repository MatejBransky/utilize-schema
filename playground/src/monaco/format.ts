import type { Options, Plugin } from 'prettier';

/**
 * The generators emit one long line per schema, so the formatting lives here
 * instead of in the generators. Prettier is loaded on demand to keep it out of
 * the initial bundle.
 */
const PRINT_OPTIONS: Options = {
	parser: 'typescript',
	printWidth: 80,
	useTabs: true,
	tabWidth: 2,
	singleQuote: true,
	semi: true,
	trailingComma: 'es5',
	bracketSpacing: true,
};

interface Formatter {
	format(source: string, options: Options): Promise<string>;
	plugins: Plugin[];
}

let formatterPromise: Promise<Formatter> | undefined;

function loadFormatter(): Promise<Formatter> {
	formatterPromise ??= Promise.all([
		import('prettier/standalone'),
		import('prettier/plugins/typescript'),
		import('prettier/plugins/estree'),
	]).then(([prettier, typescript, estree]) => ({
		format: prettier.format,
		plugins: [typescript, estree],
	}));

	return formatterPromise as Promise<Formatter>;
}

export async function formatTypeScript(source: string): Promise<string> {
	if (!source.trim()) {
		return source;
	}

	const { format, plugins } = await loadFormatter();

	return format(source, { ...PRINT_OPTIONS, plugins });
}
