import utilizeConfig from '@utilize/eslint-config/node';

/** @type {import('eslint').Linter.Config[]} */
export default [
	...utilizeConfig,
	{
		rules: {
			'@typescript-eslint/no-explicit-any': 'off',
			'@typescript-eslint/no-unused-vars': 'off',
		},
		ignores: ['dist', 'test/__fixtures__/**'],
	},
];
