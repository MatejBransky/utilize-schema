import type { DialectId } from '@utilize/json-schema';
import { renderCaseModule as renderSuiteCase } from '@utilize/test-utils/suite/renderCaseModule';
import type { CaseModule } from '@utilize/test-utils/suite/renderCaseModule';
import type { SuiteCase } from '@utilize/test-utils/suite/loadSuite';

import { generate } from '../../src/generator';

export type { CaseModule } from '@utilize/test-utils/suite/renderCaseModule';

/**
 * Generates the types for a suite case with the package source generator and
 * appends one typed constant per instance. Shared with the baseline script.
 */
export async function renderCaseModule(
	testCase: SuiteCase,
	dialect?: DialectId
): Promise<CaseModule> {
	return renderSuiteCase(testCase, dialect, generate, __dirname + '/');
}
