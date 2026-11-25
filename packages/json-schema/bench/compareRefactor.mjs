import { performance } from 'node:perf_hooks';
import { pathToFileURL } from 'node:url';

const [baselinePath, candidatePath, selectedCase = 'all'] = process.argv.slice(2);

if (!baselinePath || !candidatePath) {
	throw new Error(
		'Usage: node --expose-gc bench/compareRefactor.mjs <baseline.mjs> <candidate.mjs> [external|prepare|index|link|all]'
	);
}

const [baseline, candidate] = await Promise.all([
	import(pathToFileURL(baselinePath).href),
	import(pathToFileURL(candidatePath).href),
]);

const iterations = Number(process.env.BENCH_ITERATIONS ?? 2000);
const warmupIterations = Number(process.env.BENCH_WARMUP ?? 300);
const tolerance = Number(process.env.BENCH_TOLERANCE ?? 0.05);

function createNormalizationSchema() {
	const properties = {};

	for (let index = 0; index < 300; index += 1) {
		properties[`field${index}`] = {
			type: 'object',
			properties: {
				name: { type: 'string', minLength: index % 5 },
				values: {
					type: 'array',
					prefixItems: [{ type: 'number' }, { type: 'boolean' }],
					items: false,
				},
			},
			required: ['name'],
			unevaluatedProperties: false,
		};
	}

	return {
		$schema: 'https://json-schema.org/draft/2020-12/schema',
		type: 'object',
		properties,
		allOf: [{ if: { required: ['field0'] }, then: { required: ['field1'] } }],
		default: { ignored: { type: 'string' } },
		examples: [{ ignored: { type: 'number' } }],
	};
}

function createIdentifierSchema() {
	const definitions = {};
	const properties = {};

	for (let index = 0; index < 300; index += 1) {
		definitions[`item${index}`] = {
			$id: `item-${index}.json`,
			$anchor: `item${index}`,
			type: 'object',
			properties: {
				value: { type: 'string' },
				nested: { $ref: `#item${index}` },
			},
		};
		properties[`field${index}`] = { $ref: `item-${index}.json` };
	}

	return {
		$schema: 'https://json-schema.org/draft/2020-12/schema',
		$id: 'https://example.com/root.json',
		type: 'object',
		properties,
		definitions,
	};
}

function createExternalSchemas() {
	const schemas = {};

	for (let documentIndex = 0; documentIndex < 20; documentIndex += 1) {
		const definitions = {};

		for (let index = 0; index < 50; index += 1) {
			definitions[`item${index}`] = {
				$id: `https://example.com/doc${documentIndex}/item${index}.json`,
				type: 'object',
				properties: {
					value: { type: 'string' },
					nested: { type: 'object', properties: { enabled: { type: 'boolean' } } },
				},
			};
		}

		schemas[`https://example.com/doc${documentIndex}.json`] = {
			$id: `https://example.com/doc${documentIndex}.json`,
			definitions,
		};
	}

	return schemas;
}

function createExternalTask(modules, schemas) {
	return {
		setup() {},
		run() {
			modules.indexExternalSchemas(schemas);
		},
	};
}

function createPrepareTask(modules, schema) {
	let input;

	return {
		setup() {
			input = structuredClone(schema);
		},
		run() {
			modules.prepareSchema(input);
		},
	};
}

function createIndexTask(modules, schema) {
	let input;
	let index;

	return {
		setup() {
			input = structuredClone(schema);
			index = modules.createSchemaIndex();
		},
		run() {
			index.addDocument('root.json', input);
		},
	};
}

function createLinkTask(modules, schema) {
	let input;

	return {
		setup() {
			const cloned = structuredClone(schema);
			const dialects = modules.prepareSchema(cloned);
			const identifiers = modules.createSchemaIndex();
			identifiers.addDocument('root.json', cloned, dialects);

			input = {
				schema: cloned,
				parent: null,
				path: [],
				filePath: 'root.json',
				fileName: 'root.json',
				$refs: { exists: () => false, get: () => undefined },
				identifiers,
				stack: new Set(),
				dialects,
			};
		},
		run() {
			modules.link(input);
		},
	};
}

function statistics(samples) {
	const sorted = samples.toSorted((left, right) => left - right);
	const sum = sorted.reduce((total, value) => total + value, 0);
	const mean = sum / sorted.length;
	const median = sorted[Math.floor(sorted.length / 2)];
	const p95 = sorted[Math.min(sorted.length - 1, Math.ceil(sorted.length * 0.95) - 1)];

	return { mean, median, p95 };
}

async function compare(name, createTask) {
	const baselineTask = createTask(baseline);
	const candidateTask = createTask(candidate);
	const baselineSamples = [];
	const candidateSamples = [];

	for (let index = 0; index < warmupIterations; index += 1) {
		baselineTask.setup();
		baselineTask.run();
		candidateTask.setup();
		candidateTask.run();
	}

	for (let index = 0; index < iterations; index += 1) {
		if (index % 100 === 0) {
			global.gc?.();
		}

		const baselineFirst = index % 2 === 0;
		const first = baselineFirst ? baselineTask : candidateTask;
		const second = baselineFirst ? candidateTask : baselineTask;

		first.setup();
		const firstStart = performance.now();
		first.run();
		const firstDuration = performance.now() - firstStart;

		second.setup();
		const secondStart = performance.now();
		second.run();
		const secondDuration = performance.now() - secondStart;

		if (baselineFirst) {
			baselineSamples.push(firstDuration);
			candidateSamples.push(secondDuration);
		} else {
			candidateSamples.push(firstDuration);
			baselineSamples.push(secondDuration);
		}
	}

	const baselineStats = statistics(baselineSamples);
	const candidateStats = statistics(candidateSamples);
	const meanDelta = candidateStats.mean / baselineStats.mean - 1;
	const medianDelta = candidateStats.median / baselineStats.median - 1;
	const passed = meanDelta <= tolerance && medianDelta <= tolerance;

	console.log(
		JSON.stringify(
			{
				case: name,
				passed,
				iterations,
				warmupIterations,
				tolerancePercent: tolerance * 100,
				baseline: Object.fromEntries(
					Object.entries(baselineStats).map(([key, value]) => [key, Number(value.toFixed(4))])
				),
				candidate: Object.fromEntries(
					Object.entries(candidateStats).map(([key, value]) => [key, Number(value.toFixed(4))])
				),
				meanDeltaPercent: Number((meanDelta * 100).toFixed(2)),
				medianDeltaPercent: Number((medianDelta * 100).toFixed(2)),
			},
			null,
			2
		)
	);

	return passed;
}

const normalizationSchema = createNormalizationSchema();
const identifierSchema = createIdentifierSchema();
const externalSchemas = createExternalSchemas();
const results = [];

if (selectedCase === 'all' || selectedCase === 'external') {
	results.push(
		await compare('indexExternalSchemas', (modules) => createExternalTask(modules, externalSchemas))
	);
}

if (selectedCase === 'all' || selectedCase === 'prepare') {
	results.push(
		await compare('prepareSchema', (modules) => createPrepareTask(modules, normalizationSchema))
	);
}

if (selectedCase === 'all' || selectedCase === 'index') {
	results.push(
		await compare('createSchemaIndex', (modules) => createIndexTask(modules, identifierSchema))
	);
}

if (selectedCase === 'all' || selectedCase === 'link') {
	results.push(await compare('link', (modules) => createLinkTask(modules, identifierSchema)));
}

if (!results.length) {
	throw new Error(`Unknown benchmark case: ${selectedCase}`);
}

if (results.some((passed) => !passed)) {
	process.exitCode = 1;
}
