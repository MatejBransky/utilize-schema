import { useState } from 'react';

import { clearExampleUrl } from '../playgroundUrl';

/** Test-data content, with user edits detaching the workspace from its example. */
export function useTestData(initial: string) {
	const [data, setData] = useState(initial);

	function updateData(content: string) {
		// The editor also reports programmatic value changes (for example when an
		// example loads); those must keep the example URL intact.
		if (content === data) {
			return;
		}

		clearExampleUrl();
		setData(content);
	}

	return { data, setData, updateData };
}
