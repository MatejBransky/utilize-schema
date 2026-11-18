import {
	Select,
	SelectContent,
	SelectItem,
	SelectItemIndicator,
	SelectLabel,
	SelectTrigger,
	SelectValue,
} from '@ui-sdk/react/select';

import styles from './SelectPicker.module.css';

export interface PickerOption {
	value: string;
	label: string;
	hint?: string;
	keywords?: string[];
	disabled?: boolean;
}

interface SelectPickerProps {
	label: string;
	placeholder: string;
	value: string | null;
	options: PickerOption[];
	onChange: (value: string) => void;
}

export function SelectPicker({ label, placeholder, value, options, onChange }: SelectPickerProps) {
	return (
		<div className={styles.picker}>
			<Select
				value={value}
				placeholder={placeholder}
				onValueChange={(next) => {
					if (typeof next === 'string') {
						onChange(next);
					}
				}}
				items={options.map(({ value: optionValue, label: optionLabel, keywords, disabled }) => ({
					value: optionValue,
					label: optionLabel,
					keywords,
					disabled,
				}))}
			>
				<SelectLabel>{label}</SelectLabel>
				<SelectTrigger className={styles.trigger}>
					<SelectValue />
				</SelectTrigger>
				<SelectContent className={styles.content}>
					{options.map((option) => (
						<SelectItem
							key={option.value}
							value={option.value}
							label={option.label}
							disabled={option.disabled}
							className={styles.item}
						>
							<span className={styles.name}>{option.label}</span>
							{option.hint ? <span className={styles.hint}>{option.hint}</span> : null}
							<SelectItemIndicator />
						</SelectItem>
					))}
				</SelectContent>
			</Select>
		</div>
	);
}
