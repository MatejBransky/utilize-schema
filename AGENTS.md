# Agent notes

## ui-sdk

This project uses [ui-sdk](https://ui-sdk.dev/) via `@ui-sdk/react` and
`@ui-sdk/core` in the `playground` app.

Before using ui-sdk, follow the `ui-sdk` skill if it is installed, and read
`node_modules/@ui-sdk/react/docs/llms.txt` (in this pnpm workspace:
`playground/node_modules/@ui-sdk/react/docs/llms.txt`). To build a new
component, also search `node_modules/@ui-sdk/react/docs/core.md` by heading and
read `rendering.md` next to it.

## Styling

Do not add Tailwind CSS. Use CSS Modules (`*.module.css`) for app-specific
styling and the `--ui-*` tokens plus `data-slot` attributes for ui-sdk
components.
