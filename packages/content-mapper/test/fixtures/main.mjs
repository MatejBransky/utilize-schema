import Person from './person.jsonschema';

const valid = Person.safeParse({ name: 'Ada', age: 36 });
const invalid = Person.safeParse({ name: 1 });

console.log(JSON.stringify({ valid: valid.success, invalid: invalid.success }));
