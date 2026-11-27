import { useEffect, useRef, useState } from 'react';

import type { Problem } from '../bundle';
import type { MonacoEditorHandle } from '../monaco/MonacoEditor';

/** Editor refs plus selecting a problem and moving the schema cursor to it. */
export function useEditorNavigation(setActiveId: (id: string) => void) {
	const schemaEditorRef = useRef<MonacoEditorHandle>(null);
	const dataEditorRef = useRef<MonacoEditorHandle>(null);
	const codeEditorRef = useRef<MonacoEditorHandle>(null);
	const [cursor, setCursor] = useState({ line: 1, column: 1 });
	const [pendingPosition, setPendingPosition] = useState<{ line: number; column: number }>();

	useEffect(() => {
		if (!pendingPosition) {
			return;
		}

		schemaEditorRef.current?.focusAt(pendingPosition.line, pendingPosition.column);
		setPendingPosition(undefined);
	}, [pendingPosition]);

	function selectProblem(problem: Problem) {
		if (problem.fileId) {
			setActiveId(problem.fileId);
		}

		setPendingPosition({
			line: problem.line ?? 1,
			column: problem.column ?? 1,
		});
	}

	return {
		schemaEditorRef,
		dataEditorRef,
		codeEditorRef,
		cursor,
		setCursor,
		selectProblem,
	};
}
