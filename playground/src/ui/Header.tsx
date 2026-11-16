import { Button } from '@ui-sdk/react/button';
import type { ReactNode } from 'react';
import {
	SegmentedControl,
	SegmentedControlIndicator,
	SegmentedControlItem,
} from '@ui-sdk/react/segmented-control';

import { isColorMode, type ColorMode } from '../theme';

import styles from './Header.module.css';

interface HeaderProps {
	colorMode: ColorMode;
	onColorModeChange: (mode: ColorMode) => void;
	onShare: () => void;
	shared: boolean;
	children?: ReactNode;
}

export function Header({ colorMode, onColorModeChange, onShare, shared, children }: HeaderProps) {
	return (
		<header className={styles.header}>
			<div className={styles.brand}>
				<span className={styles.logo} aria-hidden="true">
					◈
				</span>
				<div className={styles.brandText}>
					<h1 className={styles.title}>Utilize JSON Schema</h1>
					<p className={styles.subtitle}>Generate to Zod, Effect Schema and more</p>
				</div>
			</div>

			<div className={styles.actions}>
				{children}
				<SegmentedControl
					aria-label="Color mode"
					value={colorMode}
					onValueChange={(value) => {
						if (isColorMode(value)) {
							onColorModeChange(value);
						}
					}}
				>
					<SegmentedControlIndicator />
					<SegmentedControlItem value="auto">Auto</SegmentedControlItem>
					<SegmentedControlItem value="light">Light</SegmentedControlItem>
					<SegmentedControlItem value="dark">Dark</SegmentedControlItem>
				</SegmentedControl>

				<Button onClick={onShare}>{shared ? 'Link copied' : 'Share'}</Button>

				<Button
					render={
						<a
							href="https://github.com/MatejBransky/utilize-schema"
							target="_blank"
							rel="noreferrer"
						/>
					}
				>
					GitHub
				</Button>
			</div>
		</header>
	);
}
