import type { Problem } from './bundle';

export function collectProblems(
	schemaProblems: Problem[],
	bundleProblems: Problem[],
	generationProblems: Problem[]
): Problem[] {
	const generation = generationProblems.filter(
		(problem) =>
			!bundleProblems.some(
				(existing) =>
					existing.severity === problem.severity &&
					issueText(existing.message) === issueText(problem.message)
			)
	);
	const all = [...schemaProblems, ...bundleProblems, ...generation];
	const seen = new Set<string>();

	return all.filter((problem) => {
		const key = `${problem.fileId}|${problem.severity}|${problem.message}|${problem.line ?? ''}`;

		if (seen.has(key)) {
			return false;
		}
		seen.add(key);
		return true;
	});
}

export function fileHasError(fileId: string, problems: Problem[]): boolean {
	return problems.some((problem) => problem.fileId === fileId && problem.severity === 'error');
}

function issueText(message: string): string {
	return message.replace(/\s+\([^()]*\)$/, '');
}
