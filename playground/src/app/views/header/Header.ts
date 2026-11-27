import type { Html } from '@effect/ui/html';
import { Button } from '@effect/ui-kit';

import { AutoIcon, GitHubIcon, MoonIcon, SunIcon } from '../../icons';
import { AppMessage } from '../../messages';
import type { ControlNodes } from './Controls';

import headerStyles from '../../../ui/Header.module.css';

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
		children: ControlNodes;
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
