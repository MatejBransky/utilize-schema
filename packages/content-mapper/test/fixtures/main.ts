import Person from './person.jsonschema';

const person = Person.parse({ name: 'Ada', age: 36 });
const name: string = person.name;

// @ts-expect-error the generated type says name is a string
const wrong: number = person.name;

console.log(name, wrong);
