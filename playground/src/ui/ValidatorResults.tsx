import { targets, type TargetId } from '../targets';
import type { ValidationState } from '../validator/useValidatorResults';

import styles from './ValidatorResults.module.css';

interface ValidatorResultsProps {
	target: TargetId;
	state: ValidationState;
}

export function ValidatorResults({ target, state }: ValidatorResultsProps) {
	if (state.status === 'unavailable') {
		return (
			<p className={styles.message} role="status">
				{state.reason}
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

	return (
		<div className={styles.results} data-testid="validator-results">
			<ValidatorCard id={target} name={targetLabel(target)} state={state} />
		</div>
	);
}

interface ValidatorCardProps {
	id: string;
	name: string;
	state: Extract<ValidationState, { status: 'running' | 'ready' }>;
}

function ValidatorCard({ id, name, state }: ValidatorCardProps) {
	const result = state.status === 'ready' ? state.result : undefined;
	const status = !result ? 'running' : result.ok ? 'valid' : 'invalid';

	return (
		<section
			className={styles.card}
			aria-label={`${name} validation result`}
			data-testid={`result-${id}`}
			data-status={status}
		>
			{status === 'running' ? (
				<p className={styles.note}>Compiling the generated schema…</p>
			) : result?.ok ? (
				<>
					<p className={styles.note}>Decoded value</p>
					<pre className={styles.value}>{result.value}</pre>
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

function targetLabel(target: TargetId): string {
	return targets.find((item) => item.value === target)?.label ?? target;
}
