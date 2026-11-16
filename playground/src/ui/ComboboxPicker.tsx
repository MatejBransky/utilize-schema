import {
	Combobox,
	ComboboxContent,
	ComboboxEmpty,
	ComboboxInput,
	ComboboxItem,
	ComboboxLabel,
	ComboboxList,
	ComboboxTrigger,
} from '@ui-sdk/react/combobox';

import styles from './ComboboxPicker.module.css';

export interface PickerOption {
	value: string;
	label: string;
	hint?: string;
	keywords?: string[];
	disabled?: boolean;
}

interface ComboboxPickerProps {
	label: string;
	placeholder: string;
	triggerLabel: string;
	value: string | null;
	options: PickerOption[];
	onChange: (value: string) => void;
}

export function ComboboxPicker({
	label,
	placeholder,
	triggerLabel,
	value,
	options,
	onChange,
}: ComboboxPickerProps) {
	return (
		<div className={styles.picker}>
			<Combobox
				value={value}
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
				<ComboboxLabel>{label}</ComboboxLabel>
				<div className={styles.row}>
					<ComboboxInput className={styles.input} placeholder={placeholder} />
					<ComboboxTrigger aria-label={triggerLabel} />
				</div>
				<ComboboxContent className={styles.content}>
					<ComboboxEmpty>No matches.</ComboboxEmpty>
					<ComboboxList>
						{(state) =>
							(state.items as PickerOption[]).map((item) => {
								const option = options.find((candidate) => candidate.value === item.value) ?? item;

								return (
									<ComboboxItem
										key={option.value}
										value={option.value}
										label={option.label}
										keywords={option.keywords}
										disabled={option.disabled}
										className={styles.item}
									>
										<span className={styles.name}>{option.label}</span>
										{option.hint ? <span className={styles.hint}>{option.hint}</span> : null}
									</ComboboxItem>
								);
							})
						}
					</ComboboxList>
				</ComboboxContent>
			</Combobox>
		</div>
	);
}
