import { Button } from '@ui-sdk/react/button';
import type { ReactNode } from 'react';

import type { ColorMode } from '../theme';
import { AutoIcon, GitHubIcon, MoonIcon, SunIcon } from './icons';

import styles from './Header.module.css';

const NEXT_COLOR_MODE: Record<ColorMode, ColorMode> = {
	auto: 'light',
	light: 'dark',
	dark: 'auto',
};

const COLOR_MODE_LABELS: Record<ColorMode, string> = {
	auto: 'Auto',
	light: 'Light',
	dark: 'Dark',
};

function ColorModeIcon({ mode }: { mode: ColorMode }) {
	switch (mode) {
		case 'light':
			return <SunIcon />;
		case 'dark':
			return <MoonIcon />;
		default:
			return <AutoIcon />;
	}
}

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
					<p className={styles.subtitle}>Generate Zod, Effect Schema or TypeScript</p>
				</div>
			</div>

			{children ? <div className={styles.settings}>{children}</div> : null}

			<div className={styles.actions}>
				<Button
					className={styles.iconButton}
					aria-label="Color mode"
					title={`Color mode: ${COLOR_MODE_LABELS[colorMode]}`}
					data-mode={colorMode}
					onClick={() => onColorModeChange(NEXT_COLOR_MODE[colorMode])}
				>
					<ColorModeIcon mode={colorMode} />
				</Button>

				<Button onClick={onShare}>{shared ? 'Link copied' : 'Share'}</Button>

				<Button
					className={styles.iconButton}
					aria-label="GitHub"
					title="GitHub"
					render={
						<a
							href="https://github.com/MatejBransky/utilize-schema"
							target="_blank"
							rel="noreferrer"
						/>
					}
				>
					<GitHubIcon />
				</Button>
			</div>
		</header>
	);
}
