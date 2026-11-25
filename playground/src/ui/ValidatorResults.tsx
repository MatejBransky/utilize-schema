import { targets, type TargetId } from '../targets';
import type { ValidatorReport } from '../validator/protocol';
import type { ValidationState } from '../validator/useValidatorResults';

import appStyles from '../App.module.css';
import styles from './ValidatorResults.module.css';

export interface ValidatorResultsProps {
	target: TargetId;
	state: ValidationState;
}

type CardStatus = 'running' | 'valid' | 'invalid';

const STATUS_LABELS: Record<CardStatus, string> = {
	running: 'Running…',
	valid: 'Valid',
	invalid: 'Invalid',
};

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
	const status = statusOf(result);

	return (
		<section
			className={styles.card}
			aria-label={`${name} validation result`}
			data-testid={`result-${id}`}
			data-status={status}
		>
			<div className={appStyles.sectionHeader}>
				<h3 className={styles.name}>{name}</h3>
				<span className={styles.badge}>{STATUS_LABELS[status]}</span>
			</div>
			<CardBody result={result} />
		</section>
	);
}

function CardBody({ result }: { result: ValidatorReport | undefined }) {
	if (!result) {
		return <p className={styles.note}>Compiling the generated schema…</p>;
	}

	if (result.ok) {
		return (
			<>
				<p className={styles.note}>Decoded value</p>
				<pre className={styles.value}>{result.value}</pre>
			</>
		);
	}

	return (
		<>
			<p className={styles.note}>{failureNote(result)}</p>
			{result.error ? (
				<p className={styles.message}>{result.error}</p>
			) : (
				<IssueList issues={result.issues} />
			)}
		</>
	);
}

function failureNote(result: ValidatorReport): string {
	if (result.error) {
		return 'The validator could not run';
	}

	if (result.issues.length > 0) {
		return `${result.issues.length} ${result.issues.length === 1 ? 'issue' : 'issues'}`;
	}

	return 'The validator rejected the data.';
}

function IssueList({ issues }: { issues: ValidatorReport['issues'] }) {
	return (
		<ul className={styles.issues}>
			{issues.map((issue, index) => (
				<li key={`${issue.path}-${index}`} className={styles.issue}>
					<code className={styles.path}>{issue.path}</code>
					<span className={styles.issueMessage}>{issue.message}</span>
				</li>
			))}
		</ul>
	);
}

function statusOf(result: ValidatorReport | undefined): CardStatus {
	if (!result) {
		return 'running';
	}

	return result.ok ? 'valid' : 'invalid';
}

function targetLabel(target: TargetId): string {
	return targets.find((item) => item.value === target)?.label ?? target;
}
