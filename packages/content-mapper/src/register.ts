// fallow-ignore-file coverage-gaps -- the Node loader is registered in the spawned mapper process; the integration tests exercise it end to end

import { register } from 'node:module';

/** Registers the Node loader for `.jsonschema` imports. */
register(new URL('./loader.mjs', import.meta.url));
