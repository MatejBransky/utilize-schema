import type { ParsedJSONSchemaObject } from '@utilize/json-schema';

import { generator as allOfGenerator } from './allOfGenerator';
import { generator as anyGenerator } from './anyGenerator';
import { generator as anyOfGenerator } from './anyOfGenerator';
import { generator as arrayGenerator } from './arrayGenerator';
import { generator as booleanGenerator } from './booleanGenerator';
import type { ExpressionGenerator } from './createGenerator';
import { generator as enumGenerator } from './enumGenerator';
import { generator as literalGenerator } from './literalGenerator';
import { generator as multipleTypeGenerator } from './multipleTypeGenerator';
import { generator as nullGenerator } from './nullGenerator';
import { generator as numberGenerator } from './numberGenerator';
import { generator as objectGenerator } from './objectGenerator';
import { generator as oneOfGenerator } from './oneOfGenerator';
import { generator as recordGenerator } from './recordGenerator';
import { generator as refGenerator } from './refGenerator';
import { generator as stringGenerator } from './stringGenerator';
import { generator as tupleGenerator } from './tupleGenerator';

const generators = [
	refGenerator,
	multipleTypeGenerator,
	anyOfGenerator,
	allOfGenerator,
	oneOfGenerator,
	nullGenerator,
	literalGenerator,
	booleanGenerator,
	numberGenerator,
	stringGenerator,
	recordGenerator,
	objectGenerator,
	tupleGenerator,
	arrayGenerator,
	enumGenerator,
];

export function selectGenerator(
	input: ParsedJSONSchemaObject
): ExpressionGenerator {
	const generator = generators.find(({ predicate }) => predicate(input));

	if (!generator) {
		return anyGenerator;
	}

	return generator;
}
