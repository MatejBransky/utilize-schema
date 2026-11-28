import { useEffect, useState } from 'react';
import type { RefObject } from 'react';

import type { MonacoEditorHandle } from '../monaco/MonacoEditor';

/** Clipboard feedback for the generated-code editor. */
export function useCopyFeedback(code: string, codeEditorRef: RefObject<MonacoEditorHandle | null>) {
	const [copy, setCopy] = useState<{ value: string; id: number } | null>(null);
	const copied = copy !== null && copy.value === code;

	// Timers are a real side effect; the flag itself is derived above.
	useEffect(() => {
		if (copy === null) {
			return;
		}

		const timer = setTimeout(() => setCopy(null), 2000);

		return () => clearTimeout(timer);
	}, [copy]);

	async function copyCode() {
		const text = codeEditorRef.current?.getValue() ?? code;

		try {
			await navigator.clipboard.writeText(text);
			setCopy((current) => ({ value: text, id: (current?.id ?? 0) + 1 }));
		} catch {
			setCopy(null);
		}
	}

	return { copied, copyCode };
}
