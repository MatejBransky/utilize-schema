import { usePlayground } from './playgroundHooks';
import { Header } from './ui/Header';
import { OutputPane } from './ui/OutputPane';
import { PlaygroundControls } from './ui/PlaygroundControls';
import { SchemaPane } from './ui/SchemaPane';

import styles from './App.module.css';

export default function App() {
	const playground = usePlayground();
	const { files, activeId } = playground;
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

			<main className={styles.workspace}>
				<SchemaPane playground={playground} active={active} />
				<OutputPane playground={playground} />
			</main>
		</div>
	);
}
