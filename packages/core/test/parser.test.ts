import { assert, expect, test } from 'vitest';

import { dereference, normalize, rules, type JSONSchema } from '../src';
import { link } from '../src/linker';
import { parse } from '../src/parser';
import { ASTKind } from '../src/types/AST';

async function parseFromSchema(
	schema: JSONSchema,
	fileName: string = 'test-schema'
) {
	const dereferencedSchema = await dereference(schema, { cwd: process.cwd() });
	const linkedSchema = link(dereferencedSchema);
	const normalizedSchema = normalize({
		rootSchema: linkedSchema,
		fileName,
		rules,
	});
	return parse({ schema: normalizedSchema, stack: new Map() });
}

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

	const ast = await parseFromSchema(input, 'RefWrapper');
	assert(ast.kind === ASTKind.OBJECT, 'AST node should be of kind OBJECT');
	const fooAst = ast.properties.find((p) => p.keyName === 'foo')?.ast;
	assert(fooAst, 'Foo property should exist in the AST');
	// AST node should be of kind REFERENCE
	assert(fooAst.kind === ASTKind.REFERENCE);
	// Should preserve default from the wrapper
	expect(fooAst.default).toBe('baz');
	// Reference should point to the referenced AST node
	expect(fooAst.reference.kind).toBe(ASTKind.STRING);
	// Referenced fooAst node should not have default (unless defined in $defs)
	expect(fooAst.reference.default).toBeUndefined();
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

	const ast = await parseFromSchema(input, 'Cyclic');

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

test('keep title only in the union and not in its nodes', async () => {
	const input: JSONSchema = {
		type: ['object', 'boolean'],
		title: 'UnionTitle',
		properties: {
			foo: { type: 'string' },
			bar: { type: 'number' },
		},
	};

	const ast = await parseFromSchema(input, 'UnionTitle');
	assert(ast.kind === ASTKind.UNION, 'AST node should be of kind UNION');
	expect(ast.meta?.title).toBe('UnionTitle');
	expect(
		ast.nodes.map((n) => ({
			title: n.meta?.title,
			standaloneName: n.standaloneName,
		}))
	).toEqual([
		{ title: undefined, standaloneName: undefined },
		{ title: undefined, standaloneName: undefined },
	]);
});
