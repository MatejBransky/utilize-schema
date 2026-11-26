/**
 * Rejects with `createError()` when `promise` takes longer than `milliseconds`.
 * The original promise keeps running; callers that cache it must drop the entry
 * so the next attempt starts fresh instead of awaiting the same work again.
 */
export function withTimeout<T>(
	promise: Promise<T>,
	milliseconds: number,
	createError: () => Error
): Promise<T> {
	return new Promise((resolve, reject) => {
		const timer = setTimeout(() => reject(createError()), milliseconds);

		promise.then(
			(value) => {
				clearTimeout(timer);
				resolve(value);
			},
			(error: unknown) => {
				clearTimeout(timer);
				reject(error);
			}
		);
	});
}
