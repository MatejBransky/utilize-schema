import { z } from 'zod/v4';

export const CatalogItemReaderStep = z.object({});
export type CatalogItemReaderStep = z.infer<typeof CatalogItemReaderStep>;

export const ConditionStep = z.object({
	condition: z.string().optional(),
});
export type ConditionStep = z.infer<typeof ConditionStep>;

export const DataWriteStrategy = z.enum(['APPEND', 'REPLACE']);
export type DataWriteStrategy = z.infer<typeof DataWriteStrategy>;

export const DbWriterStep = z.object({
	stepType: z.literal('DbWriterStep').optional(),
	dataWriteStrategy: DataWriteStrategy.optional(),
});
export type DbWriterStep = z.infer<typeof DbWriterStep>;

export const DeleteAttributeStep = z.object({
	attributeNames: z.array(z.string()).optional(),
});
export type DeleteAttributeStep = z.infer<typeof DeleteAttributeStep>;

export const AttributeMapping = z.object({
	innerAttributeName: z.string().optional(),
	outerAttributeName: z.string().optional(),
});
export type AttributeMapping = z.infer<typeof AttributeMapping>;

export const InputMapping = z.object({
	inputName: z.string().optional(),
	attributeMapping: z.array(AttributeMapping).optional(),
});
export type InputMapping = z.infer<typeof InputMapping>;

export const OutputMapping = z.object({
	outputName: z.string().optional(),
	attributeMapping: z.array(AttributeMapping).optional(),
});
export type OutputMapping = z.infer<typeof OutputMapping>;

export const EmbeddedPlanStep = z.object({
	inputMappings: z.array(InputMapping).optional(),
	outputMappings: z.array(OutputMapping).optional(),
});
export type EmbeddedPlanStep = z.infer<typeof EmbeddedPlanStep>;

export const GroupByBasicConfiguration = z.object({
	attributes: z.array(z.string()).optional(),
});
export type GroupByBasicConfiguration = z.infer<
	typeof GroupByBasicConfiguration
>;

export const DataType = z
	.enum([
		'BOOLEAN',
		'DATE',
		'DATETIME',
		'FLOAT',
		'INTEGER',
		'LONG',
		'STRING',
		'UNKNOWN',
	])
	.default('STRING')
	.meta({ title: 'DataType' });
export type DataType = z.infer<typeof DataType>;

export const Id = z.string().uuid().default('unknownId');
export type Id = z.infer<typeof Id>;

export const Attribute = z.object({
	name: z.string().default(''),
	type: DataType,
	id: Id,
});
export type Attribute = z.infer<typeof Attribute>;

export const GroupByExpressionAttribute = z.object({
	groupByExpression: z.string().default(''),
	attribute: Attribute.optional(),
});
export type GroupByExpressionAttribute = z.infer<
	typeof GroupByExpressionAttribute
>;

export const GroupByExpressionConfiguration = z.object({
	isConvertible: z.boolean().default(false),
	attributes: z.array(GroupByExpressionAttribute).optional(),
});
export type GroupByExpressionConfiguration = z.infer<
	typeof GroupByExpressionConfiguration
>;

export const GroupByConfiguration = z.object({
	asExpression: z.boolean().default(false),
	configuration: GroupByBasicConfiguration.optional(),
	expressionConfiguration: GroupByExpressionConfiguration.optional(),
});
export type GroupByConfiguration = z.infer<typeof GroupByConfiguration>;

export const AggregationFunction = z
	.enum([
		'COUNT',
		'SUM',
		'AVERAGE',
		'MINIMUM',
		'MAXIMUM',
		'CONCATENATE',
		'COUNT_DISTINCT',
		'ANY_VALUE',
		'UNKNOWN',
	])
	.default('UNKNOWN');
export type AggregationFunction = z.infer<typeof AggregationFunction>;

export const AggregationBasicAttribute = z.object({
	inputAttribute: z.string().default(''),
	aggregationFunction: AggregationFunction,
	outputAttribute: Attribute.optional(),
});
export type AggregationBasicAttribute = z.infer<
	typeof AggregationBasicAttribute
>;

export const AggregationBasicConfiguration = z.object({
	attributes: z.array(AggregationBasicAttribute).optional(),
});
export type AggregationBasicConfiguration = z.infer<
	typeof AggregationBasicConfiguration
>;

export const AggregationExpressionAttribute = z.object({
	aggregationExpression: z.string().default(''),
	outputAttribute: Attribute.optional(),
});
export type AggregationExpressionAttribute = z.infer<
	typeof AggregationExpressionAttribute
>;

export const AggregationExpressionConfiguration = z.object({
	isConvertible: z.boolean().default(false),
	attributes: z.array(AggregationExpressionAttribute).optional(),
});
export type AggregationExpressionConfiguration = z.infer<
	typeof AggregationExpressionConfiguration
>;

export const AggregationConfiguration = z.object({
	asExpression: z.boolean().default(false),
	configuration: AggregationBasicConfiguration.optional(),
	expressionConfiguration: AggregationExpressionConfiguration.optional(),
});
export type AggregationConfiguration = z.infer<typeof AggregationConfiguration>;

export const GroupAggregatorStep = z.object({
	groupBy: GroupByConfiguration.optional(),
	aggregation: AggregationConfiguration.optional(),
});
export type GroupAggregatorStep = z.infer<typeof GroupAggregatorStep>;

export const InputStep = z.object({
	attributes: z.array(Attribute).optional(),
});
export type InputStep = z.infer<typeof InputStep>;

export const JoinType = z
	.enum(['LEFT', 'RIGHT', 'INNER', 'OUTER'])
	.default('INNER');
export type JoinType = z.infer<typeof JoinType>;

export const JoinKey = z.object({
	value: z.string().optional(),
	isExpression: z.boolean().default(false),
});
export type JoinKey = z.infer<typeof JoinKey>;

export const SelectedAttributes = z.object({
	attributes: z.array(z.string()).optional(),
	useAllAttributes: z.boolean().default(false),
});
export type SelectedAttributes = z.infer<typeof SelectedAttributes>;

export const JoinStep = z
	.object({
		joinType: JoinType,
		leftKey: JoinKey.optional(),
		rightKey: JoinKey.optional(),
		leftAttributes: SelectedAttributes.optional(),
		rightAttributes: SelectedAttributes.optional(),
	})
	.meta({ title: 'JoinStep' });
export type JoinStep = z.infer<typeof JoinStep>;

export const OneDataWriterStep = z.object({
	tableId: Id,
});
export type OneDataWriterStep = z.infer<typeof OneDataWriterStep>;

export const OutputStep = z.object({
	passAllAttributes: z.boolean().default(true),
	attributes: z.array(z.string()).optional(),
});
export type OutputStep = z.infer<typeof OutputStep>;

export const RulePlanStep = z.object({
	inputAttributeMappings: z.array(AttributeMapping).optional(),
	outputAttributeMappings: z.array(AttributeMapping).optional(),
});
export type RulePlanStep = z.infer<typeof RulePlanStep>;

export const Assignment = z.object({
	expression: z.string().optional(),
	attribute: z.string().optional(),
});
export type Assignment = z.infer<typeof Assignment>;

export const TransformDataStep = z.object({
	assignments: z.array(Assignment).optional(),
});
export type TransformDataStep = z.infer<typeof TransformDataStep>;

export const TransformationCatalogItemOutputStep = z.object({
	structureLock: z.boolean().default(false),
	writeAllAttributes: z.boolean().default(true),
	attributes: z.array(z.string()).optional(),
});
export type TransformationCatalogItemOutputStep = z.infer<
	typeof TransformationCatalogItemOutputStep
>;

export const ColumnMapping = z.object({
	destination: z.string().optional(),
	in_a: z.string().optional(),
	in_b: z.string().optional(),
});
export type ColumnMapping = z.infer<typeof ColumnMapping>;

export const UnionStreamStep = z.object({
	columnMappings: z.array(ColumnMapping).optional(),
});
export type UnionStreamStep = z.infer<typeof UnionStreamStep>;

export const Step = z.union([
	CatalogItemReaderStep,
	ConditionStep,
	DbWriterStep,
	DeleteAttributeStep,
	EmbeddedPlanStep,
	GroupAggregatorStep,
	InputStep,
	JoinStep,
	OneDataWriterStep,
	OutputStep,
	RulePlanStep,
	TransformDataStep,
	TransformationCatalogItemOutputStep,
	UnionStreamStep,
]);
export type Step = z.infer<typeof Step>;
