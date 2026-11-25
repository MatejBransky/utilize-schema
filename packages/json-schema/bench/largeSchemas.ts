import { readFile, mkdtemp, rm } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { performance } from 'node:perf_hooks';

import {
	AZURE_RESOURCE_COUNT,
	createFhirSchema,
	FHIR_RESOURCE_COUNT,
	writeAzureTemplate,
} from './fixtures.ts';

import { parse } from '../dist/index.mjs';

const iterations = Number(process.env.BENCH_ITERATIONS ?? 20);

async function measure(label: string, run: () => Promise<object>) {
	for (let index = 0; index < 2; index += 1) {
		await run();
	}

	const times: number[] = [];

	for (let index = 0; index < iterations; index += 1) {
		const start = performance.now();
		await run();
		times.push(performance.now() - start);
	}

	times.sort((left, right) => left - right);

	const median = times[Math.floor(times.length / 2)];
	const p95 = times[Math.min(times.length - 1, Math.floor(times.length * 0.95))];
	const max = times.at(-1);

	if (max === undefined) {
		throw new Error('Expected at least one measurement');
	}

	return { label, median, p95, min: times[0], max };
}

const directory = await mkdtemp(join(tmpdir(), 'utilize-schema-bench-'));

try {
	await writeAzureTemplate(directory);
	const azureRoot = JSON.parse(await readFile(join(directory, 'azure.json'), 'utf8')) as unknown;
	const fhirSchema = createFhirSchema();

	const results = [
		await measure(`Azure-like template (${AZURE_RESOURCE_COUNT} linked files)`, () =>
			parse(structuredClone(azureRoot) as never, {
				cwd: directory + '/',
				fileName: 'azure.json',
			})
		),
		await measure(`FHIR-like bundle (${FHIR_RESOURCE_COUNT} resources)`, () =>
			parse(structuredClone(fhirSchema) as never, {
				cwd: '/',
				fileName: 'fhir.json',
			})
		),
	];

	console.log(`\n${iterations} iterations, milliseconds\n`);
	console.log(
		'fixture'.padEnd(52),
		'median'.padStart(8),
		'p95'.padStart(8),
		'min'.padStart(8),
		'max'.padStart(8)
	);

	for (const result of results) {
		console.log(
			result.label.padEnd(52),
			result.median.toFixed(1).padStart(8),
			result.p95.toFixed(1).padStart(8),
			result.min.toFixed(1).padStart(8),
			result.max.toFixed(1).padStart(8)
		);
	}
} finally {
	await rm(directory, { recursive: true, force: true });
}
