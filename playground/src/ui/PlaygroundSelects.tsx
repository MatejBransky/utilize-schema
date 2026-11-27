import type { Playground } from '../playgroundHooks';
import { isAvailableTarget } from '../urlState';
import { FormatModeSelect } from './FormatModeSelect';
import { KeywordPolicySelect } from './KeywordPolicySelect';
import { SelectPicker } from './SelectPicker';

import styles from '../App.module.css';

export type PlaygroundSelectsModel = Pick<
	Playground,
	| 'target'
	| 'keywordPolicy'
	| 'formatMode'
	| 'exampleId'
	| 'targetOptions'
	| 'exampleOptions'
	| 'applyGenerator'
	| 'applyExample'
	| 'applyKeywordPolicy'
	| 'applyFormatMode'
>;

export function PlaygroundSelects({ playground }: { playground: PlaygroundSelectsModel }) {
	const {
		target,
		keywordPolicy,
		formatMode,
		exampleId,
		targetOptions,
		exampleOptions,
		applyGenerator: onGeneratorChange,
		applyExample: onExampleChange,
		applyKeywordPolicy: onKeywordPolicyChange,
		applyFormatMode: onFormatModeChange,
	} = playground;

	return (
		<>
			<div className={styles.generatorPicker}>
				<SelectPicker
					label="Generator"
					placeholder="Choose a generator"
					value={target}
					options={targetOptions}
					onChange={(value) => {
						if (isAvailableTarget(value)) {
							onGeneratorChange(value);
						}
					}}
				/>
			</div>
			<div className={styles.examplePicker}>
				<SelectPicker
					label="Example"
					placeholder="Custom schema"
					value={exampleId}
					options={exampleOptions}
					onChange={onExampleChange}
				/>
			</div>
			<KeywordPolicySelect value={keywordPolicy} onChange={onKeywordPolicyChange} />
			<FormatModeSelect
				value={formatMode}
				disabled={target === 'typescript'}
				onChange={onFormatModeChange}
			/>
		</>
	);
}
