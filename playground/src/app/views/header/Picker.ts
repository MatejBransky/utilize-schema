import type { Html } from '@effect/ui/html';
import { Select } from '@effect/ui-kit';

import type { AppMessage } from '../../messages';

import styles from '../../../App.module.css';
import pickerStyles from '../../../ui/SelectPicker.module.css';

export interface PickerOption {
	value: string;
	label: string;
	disabled?: boolean;
}

export interface PickerProps {
	key: string;
	label: string;
	placeholder: string;
	value: string | null;
	open: boolean;
	options: PickerOption[];
	onOpen: AppMessage;
	onClose: AppMessage;
	onPick: (value: string) => AppMessage | undefined;
	disabled?: boolean;
}

export function Picker(h: Html.H<AppMessage>, options: PickerProps) {
	const props = {
		open: options.open,
		items: options.options.map((item) => ({
			value: item.value,
			label: item.label,
			disabled: item.disabled === true,
		})),
		value: options.value ?? undefined,
		placeholder: options.placeholder,
		disabled: options.disabled === true,
	};

	return Select(h, {
		key: options.key,
		props,
		onEmit: {
			RequestedOpen: () => options.onOpen,
			RequestedClose: () => options.onClose,
			Picked: ({ value }) => (typeof value === 'string' ? options.onPick(value) : undefined),
			Settled: () => undefined,
		},
		view: (select) =>
			h.div.class(pickerStyles.picker).children(
				select.label(h.div.attr('data-slot', 'select-label')).children(options.label),
				select
					.trigger(h.button.class(pickerStyles.trigger).attr('data-slot', 'select-trigger'))
					.children(select.value(h.span.attr('data-slot', 'select-value'))),
				select.positioner(h.div).children(
					select
						.popup(
							h.div
								.class(`${pickerStyles.content} ${styles.policyContent}`)
								.attr('data-slot', 'select-content')
						)
						.children(
							options.options.map((item) =>
								select
									.item({
										element: h.div
											.class(pickerStyles.item)
											.attr('data-slot', 'select-item')
											.attr('title', item.label),
										value: item.value,
									})
									.children(
										h.span.class(pickerStyles.name).children(item.label),
										select.itemIndicator({
											element: h.span.attr('data-slot', 'select-item-indicator'),
											value: item.value,
										})
									)
							)
						)
				)
			),
	});
}
