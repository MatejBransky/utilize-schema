import Person from './person.jsonschema';

const person = Person.parse({ name: 'Ada', age: 36 });
const name: string = person.name;

console.log(name, person);
