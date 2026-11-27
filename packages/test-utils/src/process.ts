/** The captured output of a failed child process, without trusting the thrown value. */
export function commandOutput(error: unknown) {
	if (typeof error !== 'object' || error === null) {
		return { stdout: '', stderr: '' };
	}

	const stdout = 'stdout' in error ? error.stdout : undefined;
	const stderr = 'stderr' in error ? error.stderr : undefined;

	return {
		stdout: typeof stdout === 'string' ? stdout : '',
		stderr: typeof stderr === 'string' ? stderr : '',
	};
}
