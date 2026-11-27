import { examples } from '../../examples';
import { targets } from '../../targets';

export function targetOptionsFor() {
	return targets.map((option) => ({
		value: option.value,
		label: option.label,
		disabled: option.disabled === true,
	}));
}

export function exampleOptionsFor() {
	return examples.map((example) => ({ value: example.id, label: example.name }));
}
