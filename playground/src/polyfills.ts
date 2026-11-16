import { Buffer } from 'buffer';

// @apidevtools/json-schema-ref-parser expects a Node-style Buffer.
(globalThis as { Buffer?: typeof Buffer }).Buffer = Buffer;
