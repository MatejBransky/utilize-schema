// fallow-ignore-file coverage-gaps -- the demo entry runs the mapper end to end; the content mapper integration test covers the same path

import type { z } from 'zod';

import Person from './person.jsonschema';

const person = Person.parse({ name: 'Ada', age: 36 });
const name: string = person.name;
// The generated default export is a plain Zod schema.
const schema: z.ZodType = Person;

console.log(name, person, schema === Person);
