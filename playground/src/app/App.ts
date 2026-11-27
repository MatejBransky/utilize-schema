import { Html } from '@effect/ui/html';

import { generateCommand } from './commands';
import { AppMessage } from './messages';
import { AppModel, initialModel } from './model';
import { update } from './update';
import { AppView } from './views/AppView';

export const App = Html.component({
	name: 'App',
	model: AppModel,
	message: AppMessage,
}).make({
	init: ($) => {
		const model = initialModel();

		return $.set(model).run(generateCommand(model));
	},
	update,
	view: AppView,
});
