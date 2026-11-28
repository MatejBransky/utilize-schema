import type { Dialect, ParsedJSONSchemaObject } from '@utilize/json-schema';

import { allOfGenerator } from './allOfGenerator';
import { anyGenerator } from './anyGenerator';
import { anyOfGenerator } from './anyOfGenerator';
import { arrayGenerator } from './arrayGenerator';
import { booleanGenerator } from './booleanGenerator';
import type { ExpressionGenerator } from './createGenerator';
import { enumGenerator } from './enumGenerator';
import { literalGenerator } from './literalGenerator';
import { multipleTypeGenerator } from './multipleTypeGenerator';
import { nullGenerator } from './nullGenerator';
import { numberGenerator } from './numberGenerator';
import { objectGenerator } from './objectGenerator';
import { oneOfGenerator } from './oneOfGenerator';
import { recordGenerator } from './recordGenerator';
import { refGenerator } from './refGenerator';
import { isTypedLiteral } from './schemaParts';
import { stringGenerator } from './stringGenerator';
import { tupleGenerator } from './tupleGenerator';

import { isRefNode } from '../utils';

/** In priority order: the first generator whose predicate matches is used. */
const generators: ExpressionGenerator[] = [
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
	input: ParsedJSONSchemaObject,
	dialect: Dialect
): ExpressionGenerator {
	// The type adds nothing to the listed values, and a type generator (e.g.
	// for objects) would otherwise ignore the `enum`. A `$ref` node keeps the
	// reference generator, which decides whether the dialect applies siblings.
	if (!isRefNode(input) && isTypedLiteral(input, dialect)) {
		return input.const !== undefined ? literalGenerator : enumGenerator;
	}

	const generator = generators.find(({ predicate }) => predicate(input, dialect));

	if (!generator) {
		return anyGenerator;
	}

	return generator;
}
