/**
 * This type will be used as the intermediate representation
 * between normalized JSON Schema and runtime validation code generators (e.g., Zod, ArkType).
 *
 * Design note:
 * The AST structure will be developed iteratively, driven by the needs of the code generator(s).
 * Instead of designing the AST in isolation, we will first write tests for the generator (e.g., Zod generator)
 * using hand-crafted AST nodes as input and expected code as output. As generator requirements become clear,
 * the AST node types and structure will be refined to support all necessary features for runtime validation
 * and type inference.
 *
 * This approach ensures the AST is minimal, practical, and tailored to real-world code generation needs,
 * avoiding overengineering and premature abstraction.
 *
 * The parser, which transforms normalized JSON Schema into AST, will be implemented only after the generator's
 * requirements are well understood.
 */

import type { JSONSchemaType } from './JSONSchema';

export const ASTKind = {
	STRING: 'STRING',
	BOOLEAN: 'BOOLEAN',
	NUMBER: 'NUMBER',
	INTEGER: 'INTEGER',
	ENUM: 'ENUM',
	INTERSECTION: 'INTERSECTION',
	OBJECT: 'OBJECT',
	ARRAY: 'ARRAY',
	UNION: 'UNION',
	TUPLE: 'TUPLE',
	LITERAL: 'LITERAL',
	NULL: 'NULL',
	ANY: 'ANY',
	UNKNOWN: 'UNKNOWN',
} as const;
export type ASTKind = (typeof ASTKind)[keyof typeof ASTKind];

export type ASTNode =
	| StringNode
	| BooleanNode
	| NumberNode
	| IntegerNode
	| EnumNode
	| IntersectionNode
	| ObjectNode
	| ArrayNode
	| UnionNode
	| TupleNode
	| LiteralNode
	| NullNode
	| AnyNode
	| UnknownNode;

export type ASTNodeWithKeyName = ASTNode & { keyName: string };
export type ASTNodeWithStandaloneName = ASTNode & { standaloneName: string };

/** Metadata for the node, such as provenance, title, and description */
export interface ASTMeta {
	provenance?: string;
	title?: string;
	description?: string;
}

export interface BaseASTNode {
	standaloneName?: string; // Unique name for the node, used in code generation
	kind: ASTKind;
	keyName?: string;
	default?: unknown;
	examples?: unknown[];
	params?: unknown;
	meta?: ASTMeta;
}

export interface StringNode extends BaseASTNode {
	kind: 'STRING';
	params?: {
		minLength?: number;
		maxLength?: number;
		pattern?: string;
		format?: string;
	};
	default?: string;
}

export interface BooleanNode extends BaseASTNode {
	kind: 'BOOLEAN';
}

export interface NumberNode extends BaseASTNode {
	kind: 'NUMBER';
	params?: {
		minimum?: number;
		maximum?: number;
		exclusiveMinimum?: number;
		exclusiveMaximum?: number;
		multipleOf?: number;
	};
	default?: number;
}

export interface IntegerNode extends Omit<NumberNode, 'kind'> {
	kind: 'INTEGER';
}

export interface EnumNode extends BaseASTNode {
	kind: 'ENUM';
	params: EnumParam[];
}

export interface EnumParam {
	ast: ASTNode;
	keyName: string;
}

export interface ObjectNode extends BaseASTNode {
	kind: 'OBJECT';
	params: ObjectParam[];
	superTypes: ObjectNode[];
}

export interface ObjectParam {
	ast: ASTNode;
	keyName: string;
	isRequired: boolean;
	isPatternProperty: boolean;
	isUnreachableDefinition: boolean;
}

export interface IntersectionNode extends BaseASTNode {
	kind: 'INTERSECTION';
	params: ASTNode[];
}

export interface ArrayNode extends BaseASTNode {
	kind: 'ARRAY';
	params: ASTNode;
}

export interface UnionNode extends BaseASTNode {
	kind: 'UNION';
	params: ASTNode[];
}

export interface TupleNode extends BaseASTNode {
	kind: 'TUPLE';
	params: ASTNode[];
	spreadParam?: ASTNode; // Optional spread parameter for tuples
	minItems: number; // Minimum number of items in the tuple
	maxItems?: number; // Optional maximum number of items in the tuple
}

export interface LiteralNode extends BaseASTNode {
	kind: 'LITERAL';
	params: JSONSchemaType; // The literal value, e.g., a string, number, boolean, etc.
}

export interface NullNode extends BaseASTNode {
	kind: 'NULL';
}

export interface AnyNode extends BaseASTNode {
	kind: 'ANY';
}

export interface UnknownNode extends BaseASTNode {
	kind: 'UNKNOWN';
}

export const ANY_NODE: AnyNode = {
	kind: 'ANY',
};

export const UNKNOWN_NODE: UnknownNode & ASTNodeWithKeyName = {
	kind: 'UNKNOWN',
	keyName: 'unknown',
};

export const ANY_ADDITIONAL_PROPERTIES: AnyNode & ASTNodeWithKeyName = {
	kind: 'ANY',
	keyName: '[k: string]',
};

export const UNKNOWN_ADDITIONAL_PROPERTIES: UnknownNode & ASTNodeWithKeyName = {
	kind: 'UNKNOWN',
	keyName: '[k: string]',
};
