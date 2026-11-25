/** The suite tests a generator fails per case, or `'compile'` when the case does not compile. */
export type KnownFailureInstances = Record<string, string[] | 'compile'>;

/**
 * The object entries of a generated `knownFailureInstances.ts`, one key per
 * line, in the order given. The `update:suite-baseline` scripts write them.
 */
export function renderKnownFailureInstances(instances: KnownFailureInstances): string {
	return Object.entries(instances)
		.map(([key, value]) => {
			if (value === 'compile') {
				return `\t${JSON.stringify(key)}: 'compile',`;
			}

			const items = value.map((description) => `\t\t${JSON.stringify(description)},`).join('\n');

			return `\t${JSON.stringify(key)}: [\n${items}\n\t],`;
		})
		.join('\n');
}
