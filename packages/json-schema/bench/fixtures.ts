import { mkdir, writeFile } from 'node:fs/promises';
import { join } from 'node:path';

export const AZURE_RESOURCE_COUNT = 60;
export const FHIR_RESOURCE_COUNT = 140;

/**
 * Writes an Azure-deployment-like template: one root schema that references 60
 * resource files, and every resource references a shared types file.
 */
export async function writeAzureTemplate(directory: string) {
	await mkdir(join(directory, 'common'), { recursive: true });
	await mkdir(join(directory, 'resources'), { recursive: true });

	await writeFile(
		join(directory, 'common', 'types.json'),
		JSON.stringify(
			{
				$schema: 'http://json-schema.org/draft-07/schema#',
				$id: 'common/types.json',
				title: 'CommonTypes',
				definitions: {
					location: {
						type: 'object',
						properties: {
							name: { type: 'string' },
							region: { type: 'string' },
						},
						required: ['name', 'region'],
					},
					tag: {
						type: 'object',
						properties: {
							key: { type: 'string' },
							value: { type: 'string' },
						},
						required: ['key', 'value'],
					},
				},
			},
			null,
			2
		),
		'utf8'
	);

	const resourceRefs: Record<string, unknown> = {};

	for (let index = 0; index < AZURE_RESOURCE_COUNT; index += 1) {
		const name = `resource-${index}.json`;
		resourceRefs[`resource${index}`] = { $ref: `./resources/${name}` };

		const baseProperties = {
			id: { type: 'string' },
			name: { type: 'string' },
			kind: {
				type: 'string',
				enum: ['compute', 'storage', 'network', 'database'],
			},
			location: { $ref: '../common/types.json#/definitions/location' },
			tags: {
				type: 'array',
				items: { $ref: '../common/types.json#/definitions/tag' },
			},
			properties: {
				type: 'object',
				additionalProperties: { type: 'string' },
			},
		};

		const resourceProperties =
			index === 0
				? baseProperties
				: {
						...baseProperties,
						dependsOn: {
							type: 'array',
							items: { $ref: './resource-0.json' },
						},
					};

		await writeFile(
			join(directory, 'resources', name),
			JSON.stringify(
				{
					$schema: 'http://json-schema.org/draft-07/schema#',
					$id: name,
					title: `Resource${index}`,
					type: 'object',
					properties: resourceProperties,
					required: ['id', 'name', 'kind', 'location'],
				},
				null,
				2
			),
			'utf8'
		);
	}

	await writeFile(
		join(directory, 'azure.json'),
		JSON.stringify(
			{
				$schema: 'http://json-schema.org/draft-07/schema#',
				$id: 'azure.json',
				title: 'AzureDeployment',
				type: 'object',
				properties: {
					$schema: { type: 'string' },
					contentVersion: { type: 'string' },
					resources: {
						type: 'object',
						properties: resourceRefs,
						additionalProperties: false,
					},
				},
				required: ['$schema', 'contentVersion', 'resources'],
			},
			null,
			2
		),
		'utf8'
	);
}

/** A large, cyclic FHIR-like bundle with one definition per resource type. */
export function createFhirSchema() {
	const definitions: Record<string, unknown> = {};

	for (let index = 0; index < FHIR_RESOURCE_COUNT; index += 1) {
		const next = (index + 1) % FHIR_RESOURCE_COUNT;

		definitions[`Resource${index}`] = {
			type: 'object',
			properties: {
				resourceType: { const: `Resource${index}` },
				id: { type: 'string' },
				meta: {
					type: 'object',
					properties: {
						versionId: { type: 'string' },
						lastUpdated: { type: 'string', format: 'date-time' },
					},
				},
				text: {
					type: 'object',
					properties: {
						status: { type: 'string' },
						div: { type: 'string' },
					},
				},
				extension: {
					type: 'array',
					items: {
						type: 'object',
						properties: {
							url: { type: 'string' },
							valueString: { type: 'string' },
						},
					},
				},
				identifier: {
					type: 'array',
					items: {
						type: 'object',
						properties: {
							system: { type: 'string' },
							value: { type: 'string' },
						},
					},
				},
				contained: {
					type: 'array',
					items: { $ref: `#/definitions/Resource${next}` },
				},
			},
			required: ['resourceType'],
		};
	}

	return {
		$schema: 'http://json-schema.org/draft-07/schema#',
		title: 'FhirBundle',
		type: 'object',
		properties: {
			resourceType: { const: 'Bundle' },
			entry: {
				type: 'array',
				items: {
					type: 'object',
					properties: {
						resource: {
							anyOf: Array.from({ length: FHIR_RESOURCE_COUNT }, (_, index) => ({
								$ref: `#/definitions/Resource${index}`,
							})),
						},
					},
				},
			},
		},
		definitions,
	};
}
