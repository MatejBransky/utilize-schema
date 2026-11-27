import { Mount } from '@effect/ui';
import type { Html } from '@effect/ui/html';

import { WatchBrowser } from '../browser';
import type { AppMessage } from '../messages';
import { activeFileOf, monacoThemeOf, problemsOf, signatureOf } from '../model';
import type { AppModel } from '../model';
import { Controls } from './header/Controls';
import { Header } from './header/Header';
import { browserMessage } from './messages';
import { Workspace } from './workspace/Workspace';

import styles from '../../App.module.css';

export function AppView(h: Html.H<AppMessage>, model: AppModel) {
	const active = activeFileOf(model);

	if (!active) {
		return h.main.class(styles.empty).children('Add a JSON Schema file to start.');
	}

	const problems = problemsOf(model);
	const copied = model.copiedFor !== null && model.copiedFor === model.code;
	const shared =
		model.sharedFor !== null &&
		model.sharedFor ===
			signatureOf({
				files: model.files,
				target: model.target,
				keywordPolicy: model.keywordPolicy,
				formatMode: model.formatMode,
				data: model.data,
			});

	return h.div
		.class(styles.app)
		.onMount(WatchBrowser().pipe(Mount.map((event) => browserMessage(event))))
		.children(
			Header(h, {
				colorMode: model.colorMode,
				shared,
				children: Controls(h, model),
			}),
			Workspace(h, model, {
				active,
				problems,
				monacoTheme: monacoThemeOf(model),
				copied,
			})
		);
}
