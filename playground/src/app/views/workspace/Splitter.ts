import type { Html } from '@effect/ui/html';

import { AppMessage } from '../../messages';
import type { AppModel } from '../../model';

import styles from '../../../App.module.css';

export function Splitter(
	h: Html.H<AppMessage>,
	model: AppModel,
	{ min, max }: { min: number; max: number }
) {
	return h.div
		.class(styles.resizeHandle)
		.attr('role', 'separator')
		.attr('aria-label', 'Resize schema and test data sections')
		.attr('data-slot', 'resizable-handle')
		.attr('data-orientation', 'vertical')
		.attr('aria-orientation', 'horizontal')
		.attr('aria-controls', 'schema-output-row')
		.attr('tabindex', '0')
		.attr('aria-valuenow', String(Math.round(model.topSplit)))
		.attr('aria-valuemin', String(min))
		.attr('aria-valuemax', String(Math.round(max)))
		.attr('data-hovering', model.splitHovering ? '' : undefined)
		.attr('data-dragging', model.splitDragging ? '' : undefined)
		.on('pointerdown', ({ y }) => AppMessage.PressedSplitter({ y }), { capturePointer: true })
		.on('pointermove', ({ y }) => AppMessage.MovedSplitter({ y }))
		.on('pointerup', () => AppMessage.ReleasedSplitter())
		.on('pointercancel', () => AppMessage.ReleasedSplitter())
		.on('mouseenter', () => AppMessage.HoveredSplitter())
		.on('mouseleave', () => AppMessage.LeftSplitter())
		.on('keydown', ({ key, shift }) => AppMessage.PressedSplitterKey({ key, shift }), {
			preventDefault: true,
		});
}
