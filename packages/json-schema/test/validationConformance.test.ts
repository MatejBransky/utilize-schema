import { expect, test } from 'vitest';

import { isCompatible } from '../../test-utils/src/suite/compatibility';
import { loadSuiteFiles } from '../../test-utils/src/suite/loadSuite';

import { createJsonSchemaValidator } from '../src/runtime';

const files = loadSuiteFiles().filter((file) => !file.name.startsWith('format-'));

for (const dialect of [2019, 2020] as const) {
	test(`official advanced fixtures: ${dialect}`, () => {
		const rootUri = 'https://suite.test/root.json';
		const failures: string[] = [];
		let cases = 0;
		let instances = 0;

		for (const file of files) {
			for (const suiteCase of file.cases) {
				if (
					!isCompatible(suiteCase.compatibility, dialect) ||
					suiteCase.tags?.includes('format-assertion')
				) {
					continue;
				}

				cases += 1;
				instances += suiteCase.tests.length;
				const validate = createJsonSchemaValidator({
					rootUri,
					documents: { [rootUri]: suiteCase.schema, ...suiteCase.externalSchemas },
					dialect: dialect === 2019 ? '2019-09' : '2020-12',
				});

				for (const suiteTest of suiteCase.tests) {
					if (validate(suiteTest.data, rootUri) !== suiteTest.valid) {
						failures.push(`${file.name} :: ${suiteCase.description} :: ${suiteTest.description}`);
					}
				}
			}
		}

		expect(cases).toBe(dialect === 2019 ? 357 : 370);
		expect(instances).toBe(dialect === 2019 ? 1152 : 1179);
		expect(failures).toEqual([]);
	}, 120_000);
}
