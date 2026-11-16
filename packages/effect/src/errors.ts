export class UnsupportedEffectSchemaFeatureError extends Error {
	constructor(keyword: string, detail?: string) {
		super(
			`"${keyword}" is not supported by the Effect Schema generator${detail ? `: ${detail}` : ''}.`
		);
		this.name = 'UnsupportedEffectSchemaFeatureError';
	}
}

export class UnresolvedReferenceError extends Error {
	constructor(ref: string) {
		super(`Could not resolve $ref "${ref}".`);
		this.name = 'UnresolvedReferenceError';
	}
}
