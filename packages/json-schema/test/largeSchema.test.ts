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

import { parse } from '../src';

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
		} finally {
			await rm(directory, { recursive: true, force: true });
		}
	});

	test('parses a large cyclic FHIR-like bundle', async () => {
		const parsed = await parse(createFhirSchema() as never, {
			cwd: '/',
			fileName: 'fhir.json',
		});

		expect(
			typeof parsed.root === 'object' && parsed.root !== null
				? Object.keys(parsed.root.definitions ?? {})
				: []
		).toHaveLength(FHIR_RESOURCE_COUNT);
	});
});
