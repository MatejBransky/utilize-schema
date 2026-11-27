import type { Collapsible } from '@effect/ui-kit';

export type CollapsibleOptions = Parameters<typeof Collapsible>[1];

export type CollapsibleView = Parameters<NonNullable<CollapsibleOptions['view']>>[0];
