import { z } from 'zod/v4';

const ActivitySchemaBase = z.object({
	name: z.string(),
	// some other fields with distinguished input / output behavior
});

type IActivityInput =
	| string
	| (z.input<typeof ActivitySchemaBase> & {
			subactivities: IActivityInput[] | null;
	  });

type IActivityOutput =
	| string
	| (z.output<typeof ActivitySchemaBase> & {
			subactivities: IActivityOutput[] | null;
	  });

const ActivitySchema: z.ZodType<IActivityOutput, IActivityInput> = z.union([
	z.string(),
	ActivitySchemaBase.extend({
		get subactivities() {
			return z.nullable(z.array(ActivitySchema));
		},
	}),
]);

type InferActivityUnion = z.output<typeof ActivitySchema>;
/*
string | {
    name: string;
    subactivities: IActivityOutput[] | null;
}
 */
