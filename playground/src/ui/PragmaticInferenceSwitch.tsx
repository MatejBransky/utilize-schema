import { Switch, SwitchThumb } from '@ui-sdk/react/switch';

import styles from '../App.module.css';

export function PragmaticInferenceSwitch({
	checked,
	onChange,
}: {
	checked: boolean;
	onChange: (checked: boolean) => void;
}) {
	return (
		<label className={styles.pragmaticInference} data-slot="label">
			<span>Pragmatic inference</span>
			<Switch checked={checked} onCheckedChange={onChange}>
				<SwitchThumb />
			</Switch>
		</label>
	);
}
