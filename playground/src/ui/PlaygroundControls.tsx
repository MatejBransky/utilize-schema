import type { KeywordPolicy } from '@utilize/json-schema';
import {
	Select,
	SelectContent,
	SelectItem,
	SelectLabel,
	SelectTrigger,
	SelectValue,
} from '@ui-sdk/react/select';

import { formatModes, isFormatMode } from '../formatMode';
import type { Playground } from '../playgroundHooks';
import { isAvailableTarget, isKeywordPolicy } from '../urlState';
import { SelectPicker } from './SelectPicker';

import styles from '../App.module.css';

const keywordPolicyOptions: Array<{ value: KeywordPolicy; label: string; hint: string }> = [
	{ value: 'error', label: 'Error', hint: 'Reject keywords outside the dialect' },
	{ value: 'warn', label: 'Warning', hint: 'Report them as warnings' },
	{ value: 'ignore', label: 'Ignore', hint: 'Do not report them' },
];

type PlaygroundControlsModel = Pick<
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

interface PlaygroundControlsProps {
	playground: PlaygroundControlsModel;
}

export function PlaygroundControls({ playground }: PlaygroundControlsProps) {
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
			<div className={`${styles.policyPicker} ${styles.keywordPolicyPicker}`}>
				<Select
					items={keywordPolicyOptions.map(({ value, label }) => ({ value, label }))}
					value={keywordPolicy}
					onValueChange={(value) => {
						if (isKeywordPolicy(value)) {
							onKeywordPolicyChange(value);
						}
					}}
				>
					<SelectLabel>Keyword policy</SelectLabel>
					<SelectTrigger>
						<SelectValue />
					</SelectTrigger>
					<SelectContent className={styles.policyContent}>
						{keywordPolicyOptions.map((option) => (
							<SelectItem key={option.value} value={option.value} title={option.hint}>
								{option.label}
							</SelectItem>
						))}
					</SelectContent>
				</Select>
			</div>
			<div className={`${styles.policyPicker} ${styles.formatPicker}`}>
				<Select
					items={formatModes.map(({ value, label }) => ({ value, label }))}
					value={formatMode}
					onValueChange={(value) => {
						if (isFormatMode(value)) {
							onFormatModeChange(value);
						}
					}}
				>
					<SelectLabel>Format</SelectLabel>
					<SelectTrigger disabled={target === 'typescript'}>
						<SelectValue />
					</SelectTrigger>
					<SelectContent className={styles.policyContent}>
						{formatModes.map((option) => (
							<SelectItem key={option.value} value={option.value} title={option.hint}>
								{option.label}
							</SelectItem>
						))}
					</SelectContent>
				</Select>
			</div>
		</>
	);
}
