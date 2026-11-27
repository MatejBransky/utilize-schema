import type { SchemaFile } from '../bundle';
import type { Example } from '../examples';
import type { UrlState } from '../urlState';

function file(id: string): SchemaFile {
	return { id, name: `${id}.json`, content: '{}' };
}

export function state(): UrlState {
	return {
		files: [file('saved')],
		target: 'effect',
		keywordPolicy: 'ignore',
		formatMode: 'annotate',
		inference: 'spec',
		data: '{"saved":true}',
	};
}

export function example(): Example {
	return {
		id: 'const',
		name: 'Const',
		group: 'Basics',
		files: [file('const')],
		cases: [{ value: 'valid', label: 'Valid', expect: 'valid', data: 'green' }],
	};
}
