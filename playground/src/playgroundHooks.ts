import { useState } from 'react';

import { useDataDrop } from './useDataDrop';
import { useWorkspaceLayout } from './useWorkspaceLayout';
import { useValidatorResults } from './validator/useValidatorResults';
import { exampleOptions, targetOptions } from './hooks/options';
import { useEditorNavigation } from './hooks/useEditorNavigation';
import { useExampleSelection } from './hooks/useExampleSelection';
import { useFeedback } from './hooks/useFeedback';
import { useGeneration } from './hooks/useGeneration';
import { useGeneratorSettings } from './hooks/useGeneratorSettings';
import { useSchemaFiles } from './hooks/useSchemaFiles';
import { useTestData } from './hooks/useTestData';
import { useTheme } from './hooks/useTheme';
import { useWorkspacePersistence } from './hooks/useWorkspacePersistence';
import { loadState } from './playgroundState';

/**
 * Wires the playground's independent state modules together. Components import
 * this barrel and read everything from the returned `Playground` value.
 */
export function usePlayground() {
	const [initial] = useState(loadState);
	const settings = useGeneratorSettings(initial);
	const testData = useTestData(initial.data);
	const workspace = useSchemaFiles(initial.files, { ...settings, setData: testData.setData });
	const generation = useGeneration(
		workspace.files,
		settings.target,
		settings.keywordPolicy,
		settings.formatMode,
		settings.inference
	);
	const theme = useTheme();
	const editors = useEditorNavigation(workspace.setActiveId);
	const layout = useWorkspaceLayout();
	const dataDrop = useDataDrop({
		collapsed: layout.dataCollapsed,
		onData: testData.updateData,
	});
	const validation = useValidatorResults(
		settings.target,
		generation.runtime,
		testData.data,
		generation.busy
	);
	const feedback = useFeedback(
		workspace.files,
		settings.target,
		settings.keywordPolicy,
		settings.formatMode,
		settings.inference,
		generation.code,
		testData.data,
		editors.codeEditorRef
	);
	const { activeExample, activeCase, applyExample } = useExampleSelection(
		generation.exampleId,
		testData.data,
		(files) => workspace.applyExample(files),
		testData.setData
	);

	useWorkspacePersistence({
		files: workspace.files,
		target: settings.target,
		keywordPolicy: settings.keywordPolicy,
		formatMode: settings.formatMode,
		inference: settings.inference,
		data: testData.data,
	});

	return {
		...settings,
		...workspace,
		...generation,
		...theme,
		...editors,
		...feedback,
		...testData,
		validation,
		layout,
		dataDrop,
		activeExample,
		activeCase,
		applyExample,
		targetOptions,
		exampleOptions,
	};
}

export type Playground = ReturnType<typeof usePlayground>;
