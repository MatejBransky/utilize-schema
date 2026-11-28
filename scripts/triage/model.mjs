/**
 * Model configuration for the triage bot.
 *
 * The bot is deliberately provider-agnostic: `TRIAGE_MODEL` is a
 * `provider/model` string, and the provider's usual API key environment
 * variable is populated from one secret. Anything that is not a built-in
 * OpenCode provider can be configured with `TRIAGE_MODEL_BASE_URL` (an
 * OpenAI-compatible endpoint) or `TRIAGE_OPENCODE_CONFIG` (a full
 * `opencode.json` content string).
 */

const PROVIDER_ENV = {
	'opencode-go': 'OPENCODE_API_KEY',
	opencode: 'OPENCODE_API_KEY',
	anthropic: 'ANTHROPIC_API_KEY',
	openai: 'OPENAI_API_KEY',
	openrouter: 'OPENROUTER_API_KEY',
	deepseek: 'DEEPSEEK_API_KEY',
	google: 'GEMINI_API_KEY',
	'google-vertex': 'GOOGLE_CLOUD_API_KEY',
	xai: 'XAI_API_KEY',
	groq: 'GROQ_API_KEY',
	mistral: 'MISTRAL_API_KEY',
	cerebras: 'CEREBRAS_API_KEY',
	fireworks: 'FIREWORKS_API_KEY',
	together: 'TOGETHER_API_KEY',
	minimax: 'MINIMAX_API_KEY',
	moonshotai: 'MOONSHOT_API_KEY',
	zai: 'ZAI_API_KEY',
	nvidia: 'NVIDIA_API_KEY',
	huggingface: 'HF_TOKEN',
	'vercel-ai-gateway': 'AI_GATEWAY_API_KEY',
	'cloudflare-workers-ai': 'CLOUDFLARE_API_KEY',
};

const EXTRA_ENV_ALIASES = {
	google: ['GOOGLE_GENERATIVE_AI_API_KEY'],
};

/** Base permissions: the agent can work, but cannot write to GitHub. */
const SAFE_PERMISSIONS = {
	edit: 'allow',
	read: 'allow',
	grep: 'allow',
	glob: 'allow',
	bash: {
		'*': 'allow',
		'git push*': 'deny',
		'git remote*': 'deny',
		'gh pr create*': 'deny',
		'gh issue comment*': 'deny',
		'gh label*': 'deny',
		'npm publish*': 'deny',
		'pnpm publish*': 'deny',
	},
};

export function parseModel(model) {
	const value = String(model ?? '').trim();
	const slash = value.indexOf('/');
	if (slash <= 0 || slash === value.length - 1) {
		throw new Error(
			`Invalid TRIAGE_MODEL "${value}". Use the "provider/model" format, for example "opencode-go/deepseek-v4.1-flash".`
		);
	}
	const provider = value.slice(0, slash);
	const rest = value.slice(slash + 1);
	const hash = rest.indexOf('#');
	const modelId = hash === -1 ? rest : rest.slice(0, hash);
	const variant = hash === -1 ? null : rest.slice(hash + 1);
	if (!modelId) {
		throw new Error(`Invalid TRIAGE_MODEL "${value}": the model id is empty.`);
	}
	return { model: value, provider, modelId, variant };
}

function parseUserConfig(value) {
	if (!value) {
		return null;
	}
	try {
		return JSON.parse(value);
	} catch (error) {
		throw new Error(`TRIAGE_OPENCODE_CONFIG is not valid JSON: ${error.message}`, { cause: error });
	}
}

function applyProviderKey(env, provider, apiKey) {
	const envName = PROVIDER_ENV[provider];
	if (!envName) {
		return;
	}
	env[envName] = apiKey;
	for (const alias of EXTRA_ENV_ALIASES[provider] ?? []) {
		env[alias] = apiKey;
	}
}

function buildProviderConfig({ provider, modelId, baseUrl, parsedConfig }) {
	if (parsedConfig) {
		return parsedConfig;
	}
	if (!baseUrl || PROVIDER_ENV[provider]) {
		return {};
	}
	return {
		provider: {
			[provider]: {
				npm: '@ai-sdk/openai-compatible',
				name: provider,
				options: {
					baseURL: baseUrl,
					apiKey: '{env:TRIAGE_MODEL_API_KEY}',
				},
				models: {
					[modelId]: { name: modelId },
				},
			},
		},
	};
}

function mergePermissions(permission) {
	const user =
		permission && typeof permission === 'object' && !Array.isArray(permission) ? permission : {};
	const bash =
		user.bash && typeof user.bash === 'object' && !Array.isArray(user.bash) ? user.bash : {};
	return {
		...SAFE_PERMISSIONS,
		...user,
		bash: {
			...SAFE_PERMISSIONS.bash,
			...bash,
		},
	};
}

/**
 * Build the environment for the OpenCode child process. The caller's
 * `TRIAGE_WRITE_TOKEN` is always removed: the agent must never be able to
 * push, comment, or open PRs.
 */
export function buildAgentEnv({ model, apiKey, baseUrl, userConfig, baseEnv = process.env }) {
	const { provider, modelId } = parseModel(model);
	const env = { ...baseEnv };
	delete env.TRIAGE_WRITE_TOKEN;
	delete env.TRIAGE_APP_PRIVATE_KEY;
	delete env.INPUT_TRIAGE_APP_PRIVATE_KEY;

	env.TRIAGE_MODEL_API_KEY = apiKey;
	applyProviderKey(env, provider, apiKey);

	const parsedConfig = parseUserConfig(userConfig);
	const hasBuiltinProvider = Boolean(PROVIDER_ENV[provider]);
	if (!hasBuiltinProvider && !parsedConfig && !baseUrl) {
		throw new Error(
			`Unsupported provider "${provider}". Set TRIAGE_MODEL_BASE_URL for an OpenAI-compatible endpoint, or TRIAGE_OPENCODE_CONFIG with a full provider config.`
		);
	}

	const config = buildProviderConfig({ provider, modelId, baseUrl, parsedConfig });
	config.permission = mergePermissions(config.permission);
	env.OPENCODE_CONFIG_CONTENT = JSON.stringify(config);
	return env;
}
