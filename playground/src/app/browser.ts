import { Mount, UiSchema } from '@effect/ui';
import { Effect, Queue, Schema, Stream } from 'effect';

import { loadState } from '../playgroundState';
import type { UrlState } from '../urlState';
import { collectDroppedFiles, hasFileDrag, readDroppedSchemas } from '../drop';
import type { DropMode } from '../drop';
import { isElement } from '../dom';

const SchemaFileEvent = Schema.Struct({
	id: Schema.String,
	name: Schema.String,
	content: Schema.String,
});

const BrowserEvent = UiSchema.TaggedEnum({
	EnteredFiles: {},
	MovedOverFiles: {
		mode: Schema.NullOr(Schema.Literals(['add', 'replace'])),
		overData: Schema.Boolean,
	},
	LeftFiles: {},
	DroppedFiles: {
		schemas: Schema.Array(Schema.Struct({ name: Schema.String, content: Schema.String })),
		mode: Schema.Literals(['add', 'replace']),
	},
	DroppedData: { content: Schema.String },
	EndedFileDrag: {},
	ChangedSystemTheme: { dark: Schema.Boolean },
	ChangedHistory: {
		files: Schema.Array(SchemaFileEvent),
		target: Schema.Literals(['zod', 'effect', 'typescript']),
		keywordPolicy: Schema.Literals(['error', 'warn', 'ignore']),
		formatMode: Schema.Literals(['annotate', 'assert']),
		data: Schema.String,
	},
	PressedOutsideRename: {},
	MeasuredLayout: {
		headerHeight: Schema.Number,
		workspaceHeight: Schema.Number,
		workspaceTop: Schema.Number,
	},
});

export type BrowserEvent = typeof BrowserEvent.Type;

/**
 * Watches the browser events the playground listens to: file drags, history,
 * the system color scheme, clicks outside the rename input, and the size of
 * the split workspace. Mounted once, on the app root.
 */
export const WatchBrowser = Mount.makeStream('WatchBrowser', {}, (_node: HTMLElement) =>
	Stream.callback<BrowserEvent>((queue) =>
		Effect.acquireRelease(
			Effect.sync(() => attach((event) => Queue.offerUnsafe(queue, event))),
			(dispose) => Effect.sync(dispose)
		)
	)
);

function attach(send: (event: BrowserEvent) => void): () => void {
	const controller = new AbortController();
	const { signal } = controller;
	const offer = (event: BrowserEvent) => {
		send(event);
	};

	const onDragEnter = (event: DragEvent) => {
		if (!hasFileDrag(event.dataTransfer)) {
			return;
		}

		event.preventDefault();
		offer(BrowserEvent.EnteredFiles());
	};

	const onDragOver = (event: DragEvent) => {
		if (!hasFileDrag(event.dataTransfer)) {
			return;
		}

		event.preventDefault();
		if (event.dataTransfer) {
			event.dataTransfer.dropEffect = 'copy';
		}
		offer(
			BrowserEvent.MovedOverFiles({
				mode: dropModeAt(event.target),
				overData: isElement(event.target) && event.target.closest('[data-data-drop]') !== null,
			})
		);
	};

	const onDragLeave = (event: DragEvent) => {
		if (event.relatedTarget === null) {
			offer(BrowserEvent.LeftFiles());
		}
	};

	const onDrop = (event: DragEvent) => {
		if (!hasFileDrag(event.dataTransfer)) {
			return;
		}

		event.preventDefault();
		const mode = dropModeAt(event.target);
		const overData = isElement(event.target) && event.target.closest('[data-data-drop]') !== null;
		const dataCollapsed =
			overData && isElement(event.target) && event.target.closest('[data-collapsed]') !== null;
		const dataTransfer = event.dataTransfer;

		offer(BrowserEvent.EndedFileDrag());

		if (!dataTransfer || dataCollapsed) {
			return;
		}

		if (overData) {
			void collectDroppedFiles(dataTransfer)
				.then((files) => readDroppedSchemas(files))
				.then((schemas) => {
					const first = schemas[0];

					if (first) {
						offer(BrowserEvent.DroppedData({ content: first.content }));
					}
				})
				.catch(() => {});
			return;
		}

		if (!mode) {
			return;
		}

		void collectDroppedFiles(dataTransfer)
			.then((files) => readDroppedSchemas(files))
			.then((schemas) => {
				if (schemas.length > 0) {
					offer(BrowserEvent.DroppedFiles({ schemas, mode }));
				}
			})
			.catch(() => {});
	};

	const onDragEnd = () => {
		offer(BrowserEvent.EndedFileDrag());
	};

	const onPopState = () => {
		const state = loadState();

		offer(BrowserEvent.ChangedHistory(historyEvent(state)));
	};

	const onPointerDown = (event: PointerEvent) => {
		const target = event.target;

		if (
			isElement(target) &&
			(target.closest('[data-rename-input]') || target.closest('[data-confirm-rename]'))
		) {
			return;
		}

		offer(BrowserEvent.PressedOutsideRename());
	};

	const themeQuery = window.matchMedia('(prefers-color-scheme: dark)');
	const onTheme = () => {
		offer(BrowserEvent.ChangedSystemTheme({ dark: themeQuery.matches }));
	};

	const measure = () => {
		const header = document.getElementById('test-data-header');
		const workspace = document.querySelector('[data-workspace]');

		if (!header || !workspace) {
			return;
		}

		const workspaceRect = workspace.getBoundingClientRect();

		offer(
			BrowserEvent.MeasuredLayout({
				headerHeight: header.getBoundingClientRect().height,
				workspaceHeight: workspaceRect.height,
				workspaceTop: workspaceRect.top,
			})
		);
	};

	const observer = new ResizeObserver(measure);
	const header = document.getElementById('test-data-header');
	const workspace = document.querySelector('[data-workspace]');

	if (header) {
		observer.observe(header);
	}
	if (workspace) {
		observer.observe(workspace);
	}

	window.addEventListener('dragenter', onDragEnter, { signal });
	window.addEventListener('dragover', onDragOver, { signal });
	window.addEventListener('dragleave', onDragLeave, { signal });
	window.addEventListener('drop', onDrop, { signal });
	window.addEventListener('dragend', onDragEnd, { signal });
	window.addEventListener('popstate', onPopState, { signal });
	window.addEventListener('pointerdown', onPointerDown, { capture: true, signal });
	themeQuery.addEventListener('change', onTheme, { signal });

	queueMicrotask(() => {
		onTheme();
		measure();
	});

	return () => {
		observer.disconnect();
		controller.abort();
	};
}

function dropModeAt(target: EventTarget | null): DropMode | null {
	if (!isElement(target)) {
		return null;
	}

	const mode = target.closest('[data-drop-mode]')?.getAttribute('data-drop-mode');

	return mode === 'add' || mode === 'replace' ? mode : null;
}

/**
 * Starts collecting immediately, while the drop event's DataTransfer is still
 * readable. Reading the files themselves finishes asynchronously.
 */
function historyEvent(state: UrlState) {
	return {
		files: state.files,
		target: state.target,
		keywordPolicy: state.keywordPolicy,
		formatMode: state.formatMode,
		data: state.data,
	};
}
