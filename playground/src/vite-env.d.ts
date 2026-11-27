/// <reference types="vite/client" />

declare module 'virtual:zod-types' {
	const files: Record<string, string>;
	export default files;
}

declare module 'virtual:json-schema-formats-types' {
	const declaration: string;
	export default declaration;
}

declare module 'virtual:effect-types' {
	const files: Record<string, string>;
	export default files;
}
