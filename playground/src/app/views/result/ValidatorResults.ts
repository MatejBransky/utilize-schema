import type { Html } from '@effect/ui/html';

import type { AppMessage } from '../../messages';
import type { AppModel } from '../../model';
import { ValidatorCard } from './ValidatorCard';

import resultStyles from '../../../ui/ValidatorResults.module.css';

export function ValidatorResults(h: Html.H<AppMessage>, model: AppModel) {
	const state = model.validation;

	if (state.status === 'unavailable') {
		return h.p.class(resultStyles.message).attr('role', 'status').children(state.reason);
	}

	if (state.status === 'invalid-json') {
		return h.p
			.class(resultStyles.message)
			.attr('role', 'alert')
			.children(`The test data is not valid JSON: ${state.message}`);
	}

	if (state.status === 'error') {
		return h.p.class(resultStyles.message).attr('role', 'alert').children(state.message);
	}

	return h.div
		.class(resultStyles.results)
		.attr('data-testid', 'validator-results')
		.children(
			ValidatorCard(h, {
				target: model.target,
				result: state.status === 'ready' ? state.result : undefined,
			})
		);
}
