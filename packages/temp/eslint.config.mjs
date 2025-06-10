import utilizeConfig from '@utilize/eslint-config/node';

/** @type {import('eslint').Linter.Config[]} */
export default [
	...utilizeConfig,
	{
		ignores: ['dist', 'test/__fixtures__/**'],
	},
];
