const EXAMPLE_PARAM = 'example';
const GENERATOR_PARAM = 'generator';
const KEYWORD_POLICY_PARAM = 'keyword-policy';
const FORMAT_MODE_PARAM = 'format-mode';
const INFER_FORMAT_AS_STRING_PARAM = 'infer-format-as-string';

export const playgroundParams = {
	example: EXAMPLE_PARAM,
	generator: GENERATOR_PARAM,
	keywordPolicy: KEYWORD_POLICY_PARAM,
	formatMode: FORMAT_MODE_PARAM,
	inferFormatAsString: INFER_FORMAT_AS_STRING_PARAM,
} as const;

export function updateUrl(values: Record<string, string | null>, mode: 'push' | 'replace'): void {
	const url = new URL(location.href);

	for (const [key, value] of Object.entries(values)) {
		if (value === null) {
			url.searchParams.delete(key);
		} else {
			url.searchParams.set(key, value);
		}
	}
	url.hash = '';

	const href = `${url.pathname}${url.search}`;

	if (mode === 'push') {
		history.pushState(null, '', href);
	} else {
		history.replaceState(null, '', href);
	}
}

export function setExampleUrl(id: string | null, mode: 'push' | 'replace'): void {
	updateUrl({ [EXAMPLE_PARAM]: id }, mode);
}

export function clearExampleUrl(): void {
	const url = new URL(location.href);

	if (url.searchParams.has(EXAMPLE_PARAM) || url.hash) {
		setExampleUrl(null, 'replace');
	}
}
