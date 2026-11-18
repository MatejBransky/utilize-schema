import { register } from 'node:module';

/** Registers the Node loader for `.jsonschema` imports. */
register(new URL('./loader.mjs', import.meta.url));
