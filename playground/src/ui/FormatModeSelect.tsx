import {
	Select,
	SelectContent,
	SelectItem,
	SelectLabel,
	SelectTrigger,
	SelectValue,
} from '@ui-sdk/react/select';

import { formatModes, isFormatMode } from '../formatMode';
import type { FormatMode } from '../formatMode';

import styles from '../App.module.css';

export function FormatModeSelect({
	value,
	disabled,
	onChange,
}: {
	value: FormatMode;
	disabled: boolean;
	onChange: (value: FormatMode) => void;
}) {
	return (
		<div className={`${styles.policyPicker} ${styles.formatPicker}`}>
			<Select
				items={formatModes.map(({ value: mode, label }) => ({ value: mode, label }))}
				value={value}
				onValueChange={(next) => {
					if (isFormatMode(next)) {
						onChange(next);
					}
				}}
			>
				<SelectLabel>Format</SelectLabel>
				<SelectTrigger disabled={disabled}>
					<SelectValue />
				</SelectTrigger>
				<SelectContent className={styles.policyContent}>
					{formatModes.map((option) => (
						<SelectItem key={option.value} value={option.value} title={option.hint}>
							{option.label}
						</SelectItem>
					))}
				</SelectContent>
			</Select>
		</div>
	);
}
