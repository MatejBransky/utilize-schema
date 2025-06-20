import { assert, expect, test } from 'vitest';

import {
	dereference,
	normalize,
	Reference,
	rules,
	safeStringify,
	type JSONSchema,
} from '../src';
import { link } from '../src/linker';
import { parse } from '../src/parser';
import { ASTKind } from '../src/types/AST';

test('parses $ref wrapper as REFERENCE AST node and preserves default', async () => {
	// Root schema with $ref and default
	const input: JSONSchema = {
		type: 'object',
		properties: {
			foo: {
				$ref: '#/$defs/Bar',
				default: 'baz',
			},
		},
		$defs: {
			Bar: {
				type: 'string',
			},
		},
	};

	const dereferencedSchema = await dereference(input, { cwd: process.cwd() });
	// Link schema (sets Parent and Reference)
	const linkedSchema = link(dereferencedSchema);

	// Parse AST for the property 'foo'
	const fooSchema = linkedSchema.properties?.foo;

	assert(fooSchema, 'fooSchema should not be undefined');

	const ast = parse({ schema: fooSchema, stack: new Map() });

	// AST node should be of kind REFERENCE
	assert(ast.kind === ASTKind.REFERENCE);

	// Should preserve default from the wrapper
	expect(ast.default).toBe('baz');

	// Reference should point to the referenced AST node
	expect(ast.reference.kind).toBe(ASTKind.STRING);

	// Referenced AST node should not have default (unless defined in $defs)
	expect(ast.reference.default).toBeUndefined();
});

test('parses cyclic $ref as REFERENCE AST node with circular=true', async () => {
	// Cyclic schema: object with property 'next' referencing itself
	const input: JSONSchema = {
		type: 'object',
		properties: {
			value: { type: 'string' },
			next: { $ref: '#' },
		},
		required: ['value'],
	};

	const dereferencedSchema = await dereference(input, { cwd: process.cwd() });
	const linkedSchema = link(dereferencedSchema);
	const normalizedSchema = normalize({
		rootSchema: linkedSchema,
		fileName: 'Cyclic',
		rules,
	});

	const ast = parse({ schema: normalizedSchema, stack: new Map() });

	// AST node should be of kind REFERENCE and circular=true
	assert(ast.kind === ASTKind.OBJECT, 'AST node should be of kind REFERENCE');
	expect(ast.standaloneName).toBe('Cyclic');
	const nextProp = ast.properties.find((p) => p.keyName === 'next');
	assert(nextProp, 'Next property should exist in the AST');
	assert(
		nextProp.ast.kind === ASTKind.REFERENCE,
		'Next property should be a REFERENCE'
	);
	expect(nextProp.ast.circular).toBe(true);
	expect(nextProp.ast.reference).toBe(ast);
});
