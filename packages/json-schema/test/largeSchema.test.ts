import { mkdtemp, readFile, rm } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import { join } from 'node:path';

import { describe, expect, test } from 'vitest';

import {
	AZURE_RESOURCE_COUNT,
	createFhirSchema,
	FHIR_RESOURCE_COUNT,
	writeAzureTemplate,
} from '../bench/fixtures';

import { Meta, parse } from '../src';
import type { ParsedJSONSchemaObject } from '../src';

describe('large schemas', () => {
	test('parses an Azure-like template with linked files', async () => {
		const directory = await mkdtemp(join(tmpdir(), 'utilize-schema-large-'));

		try {
			await writeAzureTemplate(directory);
			const schema = JSON.parse(await readFile(join(directory, 'azure.json'), 'utf8')) as unknown;
			const parsed = await parse(schema as never, {
				cwd: directory + '/',
				fileName: 'azure.json',
			});

			expect(parsed.referencedSchemas).toHaveLength(AZURE_RESOURCE_COUNT + 1);

			const resourceRefs = asObject(asObject(parsed.root).properties?.resources).properties ?? {};
			const resources = Array.from({ length: AZURE_RESOURCE_COUNT }, (_, index) =>
				referenceOf(resourceRefs[`resource${index}`])
			);
			const [firstResource, ...dependentResources] = resources;

			resources.forEach((resource, index) => {
				expect(resource.title).toBe(`Resource${index}`);
			});

			for (const resource of dependentResources) {
				expect(referenceOf(resource.properties?.dependsOn?.items)).toBe(firstResource);
			}
		} finally {
			await rm(directory, { recursive: true, force: true });
		}
	});

	test('parses a large cyclic FHIR-like bundle', async () => {
		const parsed = await parse(createFhirSchema() as never, {
			cwd: '/',
			fileName: 'fhir.json',
		});
		const definitions = asObject(parsed.root).definitions ?? {};

		expect(Object.keys(definitions)).toHaveLength(FHIR_RESOURCE_COUNT);

		for (let index = 0; index < FHIR_RESOURCE_COUNT; index += 1) {
			const next = (index + 1) % FHIR_RESOURCE_COUNT;
			const contained = definitions[`Resource${index}`]?.properties?.contained?.items;

			expect(referenceOf(contained)).toBe(definitions[`Resource${next}`]);
		}
	});
});

function asObject(schema: unknown): ParsedJSONSchemaObject {
	expect(schema).toBeTypeOf('object');
	expect(schema).not.toBeNull();

	return schema as ParsedJSONSchemaObject;
}

/** The schema a linked `$ref` node points to. */
function referenceOf(schema: unknown): ParsedJSONSchemaObject {
	return asObject(asObject(schema)[Meta].reference);
}
