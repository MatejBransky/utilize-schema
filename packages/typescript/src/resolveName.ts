import { resolveName as resolveSharedName } from '@utilize/json-schema';
import type { CustomNameResolver, ResolveNameOptions } from '@utilize/json-schema';

/**
 * Names a standalone schema like the shared `resolveName`, but also reserves a
 * name from the custom resolver, so automatic allocation cannot hand it out
 * again. TypeScript declares every type under the name resolved here, so two
 * schemas must never share one.
 */
export function resolveName({
	schema,
	usedNames = new Set(),
	customResolver,
}: ResolveNameOptions): string {
	return resolveSharedName({
		schema,
		usedNames,
		customResolver: customResolver && reservingNames(customResolver),
	});
}

function reservingNames(customResolver: CustomNameResolver): CustomNameResolver {
	return (schema, usedNames) => {
		const customName = customResolver(schema, usedNames);

		if (customName) {
			usedNames.add(customName);
		}

		return customName;
	};
}
