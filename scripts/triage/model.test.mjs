import assert from 'node:assert/strict';
import test from 'node:test';

import { buildAgentEnv, parseModel } from './model.mjs';

void test('parses provider/model and an optional variant', () => {
	assert.deepEqual(parseModel('opencode-go/deepseek-v4.1-flash'), {
		model: 'opencode-go/deepseek-v4.1-flash',
		provider: 'opencode-go',
		modelId: 'deepseek-v4.1-flash',
		variant: null,
	});
	assert.deepEqual(parseModel('openrouter/meta/llama-3#high'), {
		model: 'openrouter/meta/llama-3#high',
		provider: 'openrouter',
		modelId: 'meta/llama-3',
		variant: 'high',
	});
});

void test('rejects malformed model strings', () => {
	assert.throws(() => parseModel('deepseek-v4.1-flash'));
	assert.throws(() => parseModel('opencode-go/'));
	assert.throws(() => parseModel('/deepseek-v4.1-flash'));
});

void test('maps built-in providers to their API key env var', () => {
	const env = buildAgentEnv({
		model: 'opencode-go/deepseek-v4.1-flash',
		apiKey: 'go-key',
		baseEnv: { TRIAGE_WRITE_TOKEN: 'write-token', HOME: '/tmp' },
	});
	assert.equal(env.OPENCODE_API_KEY, 'go-key');
	assert.equal(env.TRIAGE_WRITE_TOKEN, undefined);
	assert.equal(env.HOME, '/tmp');
	assert.ok(JSON.parse(env.OPENCODE_CONFIG_CONTENT).permission);
});

void test('maps anthropic and keeps the write token out', () => {
	const env = buildAgentEnv({
		model: 'anthropic/claude-sonnet-4-6',
		apiKey: 'anthropic-key',
		baseEnv: { TRIAGE_WRITE_TOKEN: 'write-token', TRIAGE_APP_PRIVATE_KEY: 'pem' },
	});
	assert.equal(env.ANTHROPIC_API_KEY, 'anthropic-key');
	assert.equal(env.TRIAGE_WRITE_TOKEN, undefined);
	assert.equal(env.TRIAGE_APP_PRIVATE_KEY, undefined);
});

void test('builds an openai-compatible config for a custom provider', () => {
	const env = buildAgentEnv({
		model: 'custom/my-model',
		apiKey: 'custom-key',
		baseUrl: 'https://example.test/v1',
		baseEnv: {},
	});
	const config = JSON.parse(env.OPENCODE_CONFIG_CONTENT);
	assert.equal(config.provider.custom.options.baseURL, 'https://example.test/v1');
	assert.equal(config.provider.custom.models['my-model'].name, 'my-model');
});

void test('rejects an unknown provider without a base URL or config', () => {
	assert.throws(() => buildAgentEnv({ model: 'unknown/model', apiKey: 'key', baseEnv: {} }));
});
