import { z } from 'zod/v4';

export const PropertyB = z.object({
	innerAttributeName: z.string().optional(),
	outerAttributeName: z.string().optional(),
});
export type PropertyB = z.infer<typeof PropertyB>;

export const TestObject = z.object({
	propertyB: PropertyB.optional(),
});
export type TestObject = z.infer<typeof TestObject>;

export const PropertyA = z.object({
	innerAttributeName: z.string().optional(),
	outerAttributeName: z.string().optional(),
});
export type PropertyA = z.infer<typeof PropertyA>;

export const TestArray = z.object({
	propertyA: z.array(PropertyA).optional(),
});
export type TestArray = z.infer<typeof TestArray>;

export const Example = z.object({
	testArray: TestArray.optional(),
	testObject: TestObject.optional(),
});
export type Example = z.infer<typeof Example>;
