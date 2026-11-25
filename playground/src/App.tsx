import { usePlayground } from './playgroundHooks';
import { DataPane } from './ui/DataPane';
import { Header } from './ui/Header';
import { OutputPane } from './ui/OutputPane';
import { PlaygroundControls } from './ui/PlaygroundControls';
import { ResultPane } from './ui/ResultPane';
import { SchemaPane } from './ui/SchemaPane';
import { WorkspaceSplitter } from './ui/WorkspaceSplitter';

import styles from './App.module.css';

export default function App() {
	const playground = usePlayground();
	const { files, activeId, layout } = playground;
	const { workspaceRef, style, resizing, dataCollapsed } = layout;
	const active = files.find((file) => file.id === activeId) ?? files[0];

	if (!active) {
		return <main className={styles.empty}>Add a JSON Schema file to start.</main>;
	}

	return (
		<div className={styles.app}>
			<Header
				colorMode={playground.colorMode}
				onColorModeChange={playground.setColorMode}
				onShare={() => {
					void playground.share();
				}}
				shared={playground.shared}
			>
				<PlaygroundControls playground={playground} />
			</Header>

			<main
				ref={workspaceRef}
				className={styles.workspace}
				style={style}
				data-resizing={resizing ? 'true' : undefined}
				data-collapsed={dataCollapsed ? 'true' : undefined}
			>
				<SchemaPane playground={playground} active={active} />
				<OutputPane playground={playground} />
				<DataPane playground={playground} />
				<ResultPane playground={playground} />
				<WorkspaceSplitter layout={layout} />
			</main>
		</div>
	);
}
