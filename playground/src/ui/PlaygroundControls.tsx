import type { Playground } from '../playgroundHooks';
import { PlaygroundSelects } from './PlaygroundSelects';
import type { PlaygroundSelectsModel } from './PlaygroundSelects';
import { PragmaticInferenceSwitch } from './PragmaticInferenceSwitch';

export type PlaygroundControlsModel = Pick<Playground, 'target' | 'inference' | 'applyInference'> &
	PlaygroundSelectsModel;

export function PlaygroundControls({ playground }: { playground: PlaygroundControlsModel }) {
	const { target, inference, applyInference } = playground;

	return (
		<>
			<PlaygroundSelects playground={playground} />
			{target === 'typescript' ? (
				<PragmaticInferenceSwitch
					checked={inference === 'pragmatic'}
					onChange={(checked) => applyInference(checked ? 'pragmatic' : 'spec')}
				/>
			) : null}
		</>
	);
}
