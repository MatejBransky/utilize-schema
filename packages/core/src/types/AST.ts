/**
 * This type is used as the intermediate representation
 * between normalized JSON Schema and runtime validation code generators (e.g., Zod, ArkType).
 *
 * The AST structure is designed to be minimal and practical, evolving based on generator needs.
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
	DISCRIMINATED_UNION: 'DISCRIMINATED_UNION',
	TUPLE: 'TUPLE',
	LITERAL: 'LITERAL',
	NULL: 'NULL',
	ANY: 'ANY',
	UNKNOWN: 'UNKNOWN',
	NEVER: 'NEVER',
	REFERENCE: 'REFERENCE',
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
	| DiscriminatedUnionNode
	| TupleNode
	| LiteralNode
	| NullNode
	| AnyNode
	| UnknownNode
	| NeverNode
	| ReferenceNode;

export type ASTNodeWithKeyName = ASTNode & { keyName: string };
export type ASTNodeWithStandaloneName = ASTNode & { standaloneName: string };

/** Metadata for the node, such as provenance, title, and description */
export interface ASTMeta {
	provenance?: string;
	title?: string;
	description?: string;
}

export interface BaseASTNode {
	kind: ASTKind;
	standaloneName?: string; // Unique name for the node, used in code generation
	keyName?: string;
	default?: unknown;
	examples?: unknown[];
	meta?: ASTMeta;
}

export interface StringNode extends BaseASTNode {
	kind: 'STRING';
	minLength?: number;
	maxLength?: number;
	pattern?: string;
	format?: string;
	default?: string;
}

export interface BooleanNode extends BaseASTNode {
	kind: 'BOOLEAN';
}

export interface NumberNode extends BaseASTNode {
	kind: 'NUMBER';
	minimum?: number;
	maximum?: number;
	exclusiveMinimum?: number;
	exclusiveMaximum?: number;
	multipleOf?: number;
	default?: number;
}

export interface IntegerNode extends Omit<NumberNode, 'kind'> {
	kind: 'INTEGER';
}

export type SupportedEnumValue = string | number | boolean | null;

export interface EnumNode extends BaseASTNode {
	kind: 'ENUM';
	values: SupportedEnumValue[];
}

export interface ObjectNode extends BaseASTNode {
	kind: 'OBJECT';
	properties: ObjectProperty[];
	superTypes: ObjectNode[];
}

export interface ObjectProperty {
	ast: ASTNode;
	keyName: string;
	isRequired: boolean;
	isPatternProperty: boolean;
}

export interface IntersectionNode extends BaseASTNode {
	kind: 'INTERSECTION';
	nodes: ASTNode[];
}

export interface ArrayNode extends BaseASTNode {
	kind: 'ARRAY';
	items: ASTNode;
	minItems?: number;
	maxItems?: number;
}

export interface UnionNode extends BaseASTNode {
	kind: 'UNION';
	nodes: ASTNode[];
}

export interface DiscriminatedUnionNode extends BaseASTNode {
	kind: 'DISCRIMINATED_UNION';
	discriminator: string;
	nodes: ASTNode[];
}

export interface TupleNode extends BaseASTNode {
	kind: 'TUPLE';
	items: ASTNode[];
	minItems: number;
	maxItems?: number;
	spreadParam?: ASTNode;
}

export interface LiteralNode extends BaseASTNode {
	kind: 'LITERAL';
	value: JSONSchemaType;
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

export interface NeverNode extends BaseASTNode {
	kind: 'NEVER';
}

export interface ReferenceNode extends BaseASTNode {
	kind: 'REFERENCE';
	refName: string; // Name of the referenced schema
	reference: ASTNode;
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

export const NO_ADDITIONAL_PROPERTIES: NeverNode & ASTNodeWithKeyName = {
	kind: 'NEVER',
	keyName: '',
};

export const ADDITIONAL_PROPERTY_KEY_NAME = '[k: string]';

export function isASTNode(node: unknown): node is ASTNode {
	return (
		typeof node === 'object' &&
		node !== null &&
		'kind' in node &&
		Object.values(ASTKind).includes((node as BaseASTNode).kind)
	);
}
