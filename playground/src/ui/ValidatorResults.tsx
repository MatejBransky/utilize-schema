import type { RuntimeResult } from '../runtime';

import styles from './ValidatorResults.module.css';

/** What happened to one generated validator. */
export type ValidatorOutcome =
	| { status: 'unavailable'; reason: string }
	| { status: 'checked'; result: RuntimeResult };

export type ValidationState =
	| { status: 'running' }
	| { status: 'unavailable' }
	| { status: 'invalid-json'; message: string }
	| { status: 'error'; message: string }
	| {
			status: 'ready';
			zod: ValidatorOutcome;
			effect: ValidatorOutcome;
	  };

interface ValidatorResultsProps {
	state: ValidationState;
}

export function ValidatorResults({ state }: ValidatorResultsProps) {
	if (state.status === 'unavailable') {
		return (
			<p className={styles.message} role="status">
				The schema does not produce a runtime validator for this data.
			</p>
		);
	}

	if (state.status === 'invalid-json') {
		return (
			<p className={styles.message} role="alert">
				The test data is not valid JSON: {state.message}
			</p>
		);
	}

	if (state.status === 'error') {
		return (
			<p className={styles.message} role="alert">
				{state.message}
			</p>
		);
	}

	const ready = state.status === 'ready';

	return (
		<div className={styles.results} data-testid="validator-results">
			<ValidatorCard id="zod" name="Zod" outcome={ready ? state.zod : undefined} />
			<ValidatorCard id="effect" name="Effect Schema" outcome={ready ? state.effect : undefined} />
		</div>
	);
}

interface ValidatorCardProps {
	id: string;
	name: string;
	/** Missing while the validators are still running. */
	outcome: ValidatorOutcome | undefined;
}

function ValidatorCard({ id, name, outcome }: ValidatorCardProps) {
	const result = outcome?.status === 'checked' ? outcome.result : undefined;
	const status = !outcome
		? 'running'
		: outcome.status === 'unavailable'
			? 'unavailable'
			: outcome.result.ok
				? 'valid'
				: 'invalid';

	return (
		<section
			className={styles.card}
			aria-label={`${name} validation result`}
			data-testid={`result-${id}`}
			data-status={status}
		>
			<div className={styles.cardHeader}>
				<h3 className={styles.name}>{name}</h3>
				<span className={styles.badge}>
					{status === 'running'
						? 'Running…'
						: status === 'unavailable'
							? 'Unavailable'
							: status === 'valid'
								? 'Valid'
								: 'Invalid'}
				</span>
			</div>
			{outcome?.status === 'unavailable' ? (
				<>
					<p className={styles.note}>The generator did not produce a runtime schema.</p>
					<p className={styles.message}>{outcome.reason}</p>
				</>
			) : status === 'running' ? (
				<p className={styles.note}>Compiling the generated schema…</p>
			) : result?.ok ? (
				<>
					<p className={styles.note}>Decoded value</p>
					<pre className={styles.value}>{formatValue(result.value)}</pre>
				</>
			) : (
				<>
					<p className={styles.note}>
						{result?.error
							? 'The validator could not run'
							: result && result.issues.length > 0
								? `${result.issues.length} ${result.issues.length === 1 ? 'issue' : 'issues'}`
								: 'The validator rejected the data.'}
					</p>
					{result?.error ? (
						<p className={styles.message}>{result.error}</p>
					) : (
						<ul className={styles.issues}>
							{result?.issues.map((issue, index) => (
								<li key={`${issue.path}-${index}`} className={styles.issue}>
									<code className={styles.path}>{issue.path}</code>
									<span className={styles.issueMessage}>{issue.message}</span>
								</li>
							))}
						</ul>
					)}
				</>
			)}
		</section>
	);
}

function formatValue(value: unknown): string {
	if (value === undefined) {
		return 'undefined';
	}

	try {
		return JSON.stringify(value, null, 2) ?? String(value);
	} catch {
		return String(value);
	}
}
