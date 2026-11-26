/** Narrows an event target without relying on `instanceof` across realms. */
export function isElement(target: EventTarget | null): target is Element {
	return typeof target === 'object' && target !== null && 'closest' in target;
}
