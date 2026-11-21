import type { Dialect, ParsedJSONSchemaObject } from '@utilize/json-schema';

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
import { isTypedLiteral } from './schemaParts';
import { generator as stringGenerator } from './stringGenerator';
import { generator as tupleGenerator } from './tupleGenerator';

import { isRefNode } from '../utils';

let generators: ExpressionGenerator[] | undefined;

/**
 * Built lazily because the generator modules import `generateSchema`, which
 * imports this module. Eagerly reading the imports while they are still
 * initializing yields `undefined` entries in the list.
 */
function getGenerators(): ExpressionGenerator[] {
	generators ??= [
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

	return generators;
}

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

	const generator = getGenerators().find(({ predicate }) => predicate(input, dialect));

	if (!generator) {
		return anyGenerator;
	}

	return generator;
}
