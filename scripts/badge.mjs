// Renders the committed shields-style conformance badges with shared geometry
// and colour thresholds.
const LABEL_WIDTH = 62;
const CHARACTER_WIDTH = 7;
const VALUE_PADDING = 10;

const COLOR_THRESHOLDS = [
	{ minimum: 95, color: '#4c1' },
	{ minimum: 90, color: '#97ca00' },
	{ minimum: 75, color: '#a4a61d' },
	{ minimum: 60, color: '#dfb317' },
	{ minimum: 40, color: '#fe7d37' },
	{ minimum: 0, color: '#e05d44' },
];

export function pickColor(percent) {
	return COLOR_THRESHOLDS.find(({ minimum }) => percent >= minimum).color;
}

/**
 * @param {{ label: string, message: string, color: string, description?: string }} badge
 */
export function renderBadge({ label, message, color, description = `${label}: ${message}` }) {
	const valueWidth = message.length * CHARACTER_WIDTH + VALUE_PADDING;
	const width = LABEL_WIDTH + valueWidth;
	const labelCenter = LABEL_WIDTH / 2;
	const valueCenter = LABEL_WIDTH + valueWidth / 2;

	return `<svg xmlns="http://www.w3.org/2000/svg" width="${width}" height="20" role="img" aria-label="${description}">
	<title>${description}</title>
	<linearGradient id="s" x2="0" y2="100%">
		<stop offset="0" stop-color="#bbb" stop-opacity=".1"/>
		<stop offset="1" stop-opacity=".1"/>
	</linearGradient>
	<clipPath id="r"><rect width="${width}" height="20" rx="3" fill="#fff"/></clipPath>
	<g clip-path="url(#r)">
		<rect width="${LABEL_WIDTH}" height="20" fill="#555"/>
		<rect x="${LABEL_WIDTH}" width="${valueWidth}" height="20" fill="${color}"/>
		<rect width="${width}" height="20" fill="url(#s)"/>
	</g>
	<g fill="#fff" text-anchor="middle" font-family="Verdana,Geneva,DejaVu Sans,sans-serif" font-size="11">
		<text x="${labelCenter}" y="15" fill="#010101" fill-opacity=".3">${label}</text>
		<text x="${labelCenter}" y="14">${label}</text>
		<text x="${valueCenter}" y="15" fill="#010101" fill-opacity=".3">${message}</text>
		<text x="${valueCenter}" y="14">${message}</text>
	</g>
</svg>
`;
}
