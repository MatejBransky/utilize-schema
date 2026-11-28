export function foreignKeywordWorkspace(overrides: Record<string, unknown> = {}) {
	return {
		files: [
			{
				id: 'root',
				name: 'root.json',
				content: JSON.stringify({
					$schema: 'http://json-schema.org/draft-07/schema#',
					type: 'array',
					prefixItems: [{ type: 'string' }],
				}),
			},
		],
		target: 'zod',
		...overrides,
	};
}

export function typescriptEmailWorkspace() {
	return {
		files: [
			{
				id: 'root',
				name: 'root.json',
				content: JSON.stringify({ format: 'email' }),
			},
		],
		target: 'typescript',
		data: '"ada@example.com"',
	};
}
