import type { Tabs } from '@effect/ui-kit';

export type TabsOptions = Parameters<typeof Tabs>[1];

export type TabsView = Parameters<NonNullable<TabsOptions['view']>>[0];
