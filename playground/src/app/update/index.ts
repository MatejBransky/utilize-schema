import type { HandlerMap } from './types';
import { selectionHandlers } from './selection';
import { renameStartHandlers } from './renameStart';
import { renameHandlers } from './rename';
import { editorHandlers } from './editor';
import { settingsHandlers } from './settings';
import { exampleHandlers } from './example';
import { generationHandlers } from './generation';
import { dataHandlers } from './data';
import { feedbackHandlers } from './feedback';
import { copyHandlers } from './copy';
import { dragHandlers } from './drag';
import { dropHandlers } from './drop';
import { layoutHandlers } from './layout';
import { splitterHandlers } from './splitter';
import { historyHandlers } from './history';

export const update = {
	...selectionHandlers,
	...renameStartHandlers,
	...renameHandlers,
	...editorHandlers,
	...settingsHandlers,
	...exampleHandlers,
	...generationHandlers,
	...dataHandlers,
	...feedbackHandlers,
	...copyHandlers,
	...dragHandlers,
	...dropHandlers,
	...layoutHandlers,
	...splitterHandlers,
	...historyHandlers,
} satisfies HandlerMap;
