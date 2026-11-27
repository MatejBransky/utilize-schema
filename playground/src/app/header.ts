import type { Html } from '@effect/ui/html';
import { Button, Select } from '@effect/ui-kit';

import { formatModes, isFormatMode } from '../formatMode';
import { isAvailableTarget, isKeywordPolicy } from '../urlState';
import { AutoIcon, GitHubIcon, MoonIcon, SunIcon } from './icons';
import { AppMessage } from './messages';
import { exampleOptionsFor, targetOptionsFor } from './model';
import type { AppModel } from './model';

import styles from '../App.module.css';
import headerStyles from '../ui/Header.module.css';
import pickerStyles from '../ui/SelectPicker.module.css';

const COLOR_MODE_LABELS = { auto: 'Auto', light: 'Light', dark: 'Dark' } as const;

export function Header(
	h: Html.H<AppMessage>,
	{
		colorMode,
		shared,
		children,
	}: {
		colorMode: 'auto' | 'light' | 'dark';
		shared: boolean;
		children: ReturnType<typeof Controls>;
	}
) {
	return h.header.class(headerStyles.header).children(
		h.div
			.class(headerStyles.brand)
			.children(
				h.span.class(headerStyles.logo).attr('aria-hidden', 'true').children('◈'),
				h.div
					.class(headerStyles.brandText)
					.children(
						h.h1.class(headerStyles.title).children('Utilize JSON Schema'),
						h.p.class(headerStyles.subtitle).children('Generate Zod, Effect Schema or TypeScript')
					)
			),
		h.div.class(headerStyles.settings).children(children),
		h.div.class(headerStyles.actions).children(
			Button(h, {
				element: h.button
					.class(headerStyles.iconButton)
					.attr('aria-label', 'Color mode')
					.attr('title', `Color mode: ${COLOR_MODE_LABELS[colorMode]}`)
					.attr('data-mode', colorMode),
				onPress: AppMessage.CycledColorMode(),
			})
				.attr('data-slot', 'button')
				.children(ColorModeIcon(h, colorMode)),
			Button(h, { onPress: AppMessage.ClickedShare() })
				.attr('data-slot', 'button')
				.children(shared ? 'Link copied' : 'Share'),
			h.a
				.attr('href', 'https://matejbransky.github.io/utilize-schema/reports/')
				.attr('target', '_blank')
				.attr('rel', 'noreferrer')
				.attr('data-slot', 'button')
				.children('Reports'),
			h.a
				.class(headerStyles.iconButton)
				.attr('href', 'https://github.com/MatejBransky/utilize-schema')
				.attr('target', '_blank')
				.attr('rel', 'noreferrer')
				.attr('aria-label', 'GitHub')
				.attr('title', 'GitHub')
				.attr('data-slot', 'button')
				.children(GitHubIcon(h))
		)
	);
}

function ColorModeIcon(h: Html.H<AppMessage>, mode: 'auto' | 'light' | 'dark') {
	return mode === 'light' ? SunIcon(h) : mode === 'dark' ? MoonIcon(h) : AutoIcon(h);
}

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

function Picker(
	h: Html.H<AppMessage>,
	options: {
		key: string;
		label: string;
		placeholder: string;
		value: string | null;
		open: boolean;
		options: { value: string; label: string; disabled?: boolean }[];
		onOpen: AppMessage;
		onClose: AppMessage;
		onPick: (value: string) => AppMessage | undefined;
		disabled?: boolean;
	}
) {
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
