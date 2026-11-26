import type { Person } from '../person.jsonschema';

const name: string = ({} as Person).name;

export { name };
