import { join, resolve } from 'node:path';

/** Reporters shared by every Vitest workspace, with opt-in static CI artifacts. */
export function createReporters(title, workspace) {
	const reporters = [
		'default',
		...(process.env.GITHUB_ACTIONS === 'true'
			? [['github-actions', { jobSummary: { title } }]]
			: []),
	];
	const reportDirectory = process.env.TEST_REPORT_DIR;

	if (!reportDirectory) {
		return reporters;
	}

	const outputDirectory = resolve(reportDirectory, workspace);
	return [
		...reporters,
		['html', { outputDir: outputDirectory, singleFile: true }],
		['json', { outputFile: join(outputDirectory, 'results.json') }],
	];
}
