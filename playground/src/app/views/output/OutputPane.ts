import type { Html } from '@effect/ui/html';

import type { Problem } from '../../../bundle';
import type { AppMessage } from '../../messages';
import type { AppModel } from '../../model';
import { CodeEditor } from './CodeEditor';
import { OutputHeader } from './OutputHeader';
import { ProblemsSection } from './ProblemsSection';

import styles from '../../../App.module.css';

export function OutputPane(
	h: Html.H<AppMessage>,
	model: AppModel,
	problems: Problem[],
	monacoTheme: string,
	copied: boolean
) {
	return h.section
		.class(`${styles.pane} ${styles.outputPane}`)
		.children(
			OutputHeader(h, { busy: model.busy, code: model.code, copied }),
			CodeEditor(h, { model, monacoTheme }),
			ProblemsSection(h, model, problems)
		);
}
