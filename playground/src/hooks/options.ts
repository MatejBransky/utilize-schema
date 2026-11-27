import { examples } from '../examples';
import { targets } from '../targets';

/** Searchable option lists for the target and example pickers. */
export const targetOptions = targets.map((option) => ({
	value: option.value,
	label: option.label,
	keywords: [option.disabled ? 'coming soon' : 'available'],
	disabled: option.disabled,
}));

export const exampleOptions = examples.map((example) => ({
	value: example.id,
	label: example.name,
	keywords: [example.group],
}));
