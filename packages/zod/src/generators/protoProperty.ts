import { ts } from '../utils';

export interface ProtoInputCheck {
	/** Report a missing own `__proto__` as a missing required property. */
	required: boolean;
	/** Schemas that the own `__proto__` value has to satisfy. */
	valueExpressions: string[];
	/** Reject a present own `__proto__` as an unrecognized key. */
	rejectAsAdditional?: boolean;
}

/**
 * Builds a `superRefine` body for an own `__proto__` key.
 *
 * Zod skips that key in object, record and catchall parsing: the shape never
 * validates it, `required` is never enforced and the parsed output drops it.
 * The raw input still owns the property when the value comes from JSON, so it
 * has to be checked before the schema parses it.
 */
export function protoInputCheck({
	required,
	valueExpressions,
	rejectAsAdditional = false,
}: ProtoInputCheck): string {
	const missingCheck = required
		? ts`ctx.addIssue({
          code: 'custom',
          message: 'Required property is missing.',
          path: ['__proto__'],
        });`
		: '';
	const rejectionCheck = rejectAsAdditional
		? ts`ctx.addIssue({
          code: 'custom',
          message: 'Unrecognized key.',
          path: ['__proto__'],
        });`
		: '';
	const presentChecks = [
		rejectionCheck,
		...valueExpressions.map((expression) =>
			protoValueCheck(expression, valueExpressions.length > 1)
		),
	]
		.filter(Boolean)
		.join('\n');
	const presentBlock =
		presentChecks === ''
			? required
				? ts`if (descriptor === undefined) {
        ${missingCheck}
      }`
				: ''
			: required
				? ts`if (descriptor === undefined) {
        ${missingCheck}
      } else {
        ${presentChecks}
      }`
				: ts`if (descriptor !== undefined) {
        ${presentChecks}
      }`;

	return ts`if (typeof value === 'object' && value !== null && !Array.isArray(value)) {
      const descriptor = Object.getOwnPropertyDescriptor(value, '__proto__');

      ${presentBlock}
    }`;
}

function protoValueCheck(expression: string, scoped: boolean): string {
	const check = ts`const result = ${expression}.safeParse(descriptor.value);

        if (!result.success) {
          for (const issue of result.error.issues) {
            ctx.addIssue({
              code: 'custom',
              message: issue.message,
              path: ['__proto__', ...issue.path],
            });
          }
        }`;

	// Several checks declare `result`, so each needs its own block.
	return scoped
		? ts`{
        ${check}
      }`
		: check;
}
