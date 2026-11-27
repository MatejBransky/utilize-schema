export function problemsText(): string {
	return document.querySelector('[data-testid="problems"]')?.textContent ?? '';
}

export function tabNames(): string[] {
	return Array.from(document.querySelectorAll('[role="tab"]')).map((tab) => tab.textContent ?? '');
}

export function resultStatus(target: 'zod' | 'effect'): string | null {
	return (
		document.querySelector(`[data-testid="result-${target}"]`)?.getAttribute('data-status') ?? null
	);
}

export function generatedCode(): string {
	return document.querySelector('[data-testid="generated-code"]')?.getAttribute('data-value') ?? '';
}
