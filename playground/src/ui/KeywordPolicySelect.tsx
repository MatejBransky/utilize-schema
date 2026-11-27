import type { KeywordPolicy } from '@utilize/json-schema';
import {
	Select,
	SelectContent,
	SelectItem,
	SelectLabel,
	SelectTrigger,
	SelectValue,
} from '@ui-sdk/react/select';

import { isKeywordPolicy } from '../urlState';

import styles from '../App.module.css';

const options: { value: KeywordPolicy; label: string; hint: string }[] = [
	{ value: 'error', label: 'Error', hint: 'Reject keywords outside the dialect' },
	{ value: 'warn', label: 'Warning', hint: 'Report them as warnings' },
	{ value: 'ignore', label: 'Ignore', hint: 'Do not report them' },
];

export function KeywordPolicySelect({
	value,
	onChange,
}: {
	value: KeywordPolicy;
	onChange: (value: KeywordPolicy) => void;
}) {
	return (
		<div className={`${styles.policyPicker} ${styles.keywordPolicyPicker}`}>
			<Select
				items={options.map(({ value: optionValue, label }) => ({ value: optionValue, label }))}
				value={value}
				onValueChange={(next) => {
					if (isKeywordPolicy(next)) {
						onChange(next);
					}
				}}
			>
				<SelectLabel>Keyword policy</SelectLabel>
				<SelectTrigger>
					<SelectValue />
				</SelectTrigger>
				<SelectContent className={styles.policyContent}>
					{options.map((option) => (
						<SelectItem key={option.value} value={option.value} title={option.hint}>
							{option.label}
						</SelectItem>
					))}
				</SelectContent>
			</Select>
		</div>
	);
}
