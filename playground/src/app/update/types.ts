import type { Component } from '@effect/ui';

import type { AppMessage } from '../messages';
import type { AppModel } from '../model';

export type AppUpdate = Component.Update<AppModel, AppMessage, never, Record<never, never>>;
export type UpdateResult = AppModel | Component.Step<AppModel, AppMessage, never>;

export type Handler<Tag extends AppMessage['_tag']> = (
	$: AppUpdate,
	message: Omit<Extract<AppMessage, { _tag: Tag }>, '_tag'>
) => UpdateResult;

export type HandlerMap = { [Tag in AppMessage['_tag']]: Handler<Tag> };
