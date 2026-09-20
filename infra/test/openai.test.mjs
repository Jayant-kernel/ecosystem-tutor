import test from 'node:test';
import assert from 'node:assert/strict';
import { createOpenAIProvider, OPENAI_CHAT_URL, DEFAULT_OPENAI_MODEL } from '../src/llm-bridge/providers/openai.mjs';

test('openai posts to the OpenAI endpoint with the configured model', async () => {
  let captured;
  const provider = createOpenAIProvider(
    { OPENAI_API_KEY: 'sk-test', OPENAI_MODEL_ID: 'gpt-test' },
    { fetchImpl: async (url, options) => { captured = { url, options }; return { ok: true, json: async () => ({ choices: [{ message: { content: 'hello' } }] }) }; } },
  );
  const result = await provider.generateTutorResponse({ system: 's', transcript: 't', context: {}, tools: [] });
  assert.equal(result.text, 'hello');
  assert.equal(captured.url, OPENAI_CHAT_URL);
  assert.equal(JSON.parse(captured.options.body).model, 'gpt-test');
  assert.equal(DEFAULT_OPENAI_MODEL, 'gpt-4o-mini');
});

test('openai requires an API key', async () => {
  const provider = createOpenAIProvider({}, { fetchImpl: async () => { throw new Error('should not fetch'); } });
  await assert.rejects(() => provider.generateTutorResponse({ system: 's', transcript: 't', context: {}, tools: [] }), /OPENAI_API_KEY is not set/);
});

test('openai collects sequential highlightLines calls with columns in one turn', async () => {
  const toolCalls = [
    { id: 'c1', type: 'function', function: { name: 'highlightLines', arguments: JSON.stringify({ startLine: 1, endLine: 1, note: 'Function declaration' }) } },
    { id: 'c2', type: 'function', function: { name: 'highlightLines', arguments: JSON.stringify({ startLine: 2, endLine: 2, startColumn: 17, endColumn: 30, note: 'reduce()' }) } },
    { id: 'c3', type: 'function', function: { name: 'highlightLines', arguments: JSON.stringify({ startLine: 2, endLine: 2, startColumn: 46, endColumn: 47, note: 'Initial value' }) } },
  ];
  const provider = createOpenAIProvider(
    { OPENAI_API_KEY: 'sk-test' },
    {
      fetchImpl: async () => ({
        ok: true,
        json: async () => ({ choices: [{ message: { content: "Let's break this down.", tool_calls: toolCalls } }] }),
      }),
    },
  );
  const { TOOLS } = await import('../src/llm-bridge/tools.mjs');
  const result = await provider.generateTutorResponse({ system: 's', transcript: 'Explain this function.', context: {}, tools: TOOLS });
  assert.equal(result.toolCalls.length, 3);
  assert.deepEqual(result.toolCalls[1].args, { startLine: 2, endLine: 2, startColumn: 17, endColumn: 30, note: 'reduce()' });
  assert.match(result.text, /break this down/);
});
