import type { Html } from '@effect/ui/html';

import { formatModes, isFormatMode } from '../../../formatMode';
import { isAvailableTarget, isKeywordPolicy } from '../../../urlState';
import { AppMessage } from '../../messages';
import { exampleOptionsFor, targetOptionsFor } from '../../model';
import type { AppModel } from '../../model';
import { Picker } from './Picker';

import styles from '../../../App.module.css';

export function Controls(h: Html.H<AppMessage>, model: AppModel) {
	return [
		h.div.class(styles.generatorPicker).children(
			Picker(h, {
				key: 'generator',
				label: 'Generator',
				placeholder: 'Choose a generator',
				value: model.target,
				open: model.openSelect === 'generator',
				options: targetOptionsFor(),
				onOpen: AppMessage.RequestedOpenSelect({ which: 'generator' }),
				onClose: AppMessage.RequestedCloseSelect(),
				onPick: (value) =>
					isAvailableTarget(value) ? AppMessage.PickedTarget({ value }) : undefined,
			})
		),
		h.div.class(styles.examplePicker).children(
			Picker(h, {
				key: 'example',
				label: 'Example',
				placeholder: 'Custom schema',
				value: model.exampleId,
				open: model.openSelect === 'example',
				options: exampleOptionsFor(),
				onOpen: AppMessage.RequestedOpenSelect({ which: 'example' }),
				onClose: AppMessage.RequestedCloseSelect(),
				onPick: (value) => AppMessage.PickedExample({ id: value }),
			})
		),
		h.div.class(`${styles.policyPicker} ${styles.keywordPolicyPicker}`).children(
			Picker(h, {
				key: 'policy',
				label: 'Keyword policy',
				placeholder: 'Keyword policy',
				value: model.keywordPolicy,
				open: model.openSelect === 'policy',
				options: [
					{ value: 'error', label: 'Error' },
					{ value: 'warn', label: 'Warning' },
					{ value: 'ignore', label: 'Ignore' },
				],
				onOpen: AppMessage.RequestedOpenSelect({ which: 'policy' }),
				onClose: AppMessage.RequestedCloseSelect(),
				onPick: (value) =>
					isKeywordPolicy(value) ? AppMessage.PickedKeywordPolicy({ value }) : undefined,
			})
		),
		h.div.class(`${styles.policyPicker} ${styles.formatPicker}`).children(
			Picker(h, {
				key: 'format',
				label: 'Format',
				placeholder: 'Format',
				value: model.formatMode,
				open: model.openSelect === 'format',
				options: formatModes.map(({ value, label }) => ({ value, label })),
				onOpen: AppMessage.RequestedOpenSelect({ which: 'format' }),
				onClose: AppMessage.RequestedCloseSelect(),
				onPick: (value) =>
					isFormatMode(value) ? AppMessage.PickedFormatMode({ value }) : undefined,
				disabled: model.target === 'typescript',
			})
		),
	];
}

export type ControlNodes = ReturnType<typeof Controls>;
