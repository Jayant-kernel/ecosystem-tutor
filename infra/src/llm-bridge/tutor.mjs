import { buildSystemPrompt, selectTools } from './tools.mjs';
import { createGeminiProvider } from './providers/gemini.mjs';
import { createBedrockProvider } from './providers/bedrock.mjs';
import { createGrokProvider } from './providers/grok.mjs';
import { createGroqProvider } from './providers/groq.mjs';
import { createOpenAIProvider } from './providers/openai.mjs';
import { buildVisualTourText, ensureDirectVisualPlan, isDirectVisualRequest, sanitizeVisualToolCalls } from './visual.mjs';
import { UpstreamError } from './errors.mjs';

export { buildSystemPrompt, selectTools, TOOLS, THEORY_TOOLS } from './tools.mjs';

/** Build one provider by name. Unknown names fall back to Gemini. */
function providerFor(name, env, deps) {
  const key = String(name || 'gemini').toLowerCase();
  if (key === 'openai') return createOpenAIProvider(env, deps.openai || {});
  if (key === 'groq') return createGroqProvider(env, deps.groq || {});
  if (key === 'grok' || key === 'xai') return createGrokProvider(env, deps.grok || {});
  if (key === 'bedrock') return createBedrockProvider(env, deps.bedrock || {});
  return createGeminiProvider(env, deps.gemini || {});
}

/**
 * Provider factory. Order is env-driven and any number of fallbacks may be
 * chained with commas:
 *
 *   LLM_PROVIDER=openai
 *   LLM_FALLBACK_PROVIDER=groq,gemini
 *   LLM_FALLBACK_PROVIDERS=gemini         // same thing, plural spelling
 *
 * Nothing outside this module knows which provider is in use.
 */
export function createProvider(env = process.env, deps = {}) {
  const primaryName = String(env.LLM_PROVIDER || 'openai').toLowerCase();
  const primary = providerFor(primaryName, env, deps);

  const configured = String(env.LLM_FALLBACK_PROVIDERS || env.LLM_FALLBACK_PROVIDER || '');
  const wanted = configured
    .split(',')
    .map((entry) => entry.trim().toLowerCase())
    .filter((entry) => entry && entry !== 'none');

  const seen = new Set([primaryName]);
  const chain = [];
  for (const name of wanted) {
    if (seen.has(name)) continue;
    seen.add(name);
    chain.push(providerFor(name, env, deps));
  }

  if (!chain.length) return primary;

  const logger = deps.logger || console;
  const ordered = [primary, ...chain];

  return {
    name: ordered.map((provider) => provider.name).join('+'),

    /**
     * Walk the chain in order. If every provider fails, preserve the provider
     * chain in the typed error so the UI does not blame only the fallback.
     */
    async generateTutorResponse(request) {
      const failures = [];
      for (const provider of ordered) {
        try {
          return await provider.generateTutorResponse(request);
        } catch (error) {
          failures.push(`${provider.name}: ${error?.message || 'request failed'}`);
          logger.warn?.(`[llm] ${provider.name} failed: ${error?.message || error}`);
        }
      }
      throw new UpstreamError(ordered.map((provider) => provider.name).join('+'), 0, failures.join(' | '));
    },
  };
}

/**
 * Provider-agnostic entry point used by the /voice pipeline.
 * Returns `{ text, toolCalls }` where `text` is suitable for TTS.
 */
export async function generateTutorResponse({
  provider,
  transcript,
  history = [],
  context = {},
} = {}) {
  if (!provider) throw new Error('An LLM provider is required');
  const result = await provider.generateTutorResponse({
    system: buildSystemPrompt(context),
    transcript,
    history,
    context,
    tools: selectTools(context.lessonMode),
  });
  const safeToolCalls = sanitizeVisualToolCalls(result.toolCalls);
  const toolCalls = ensureDirectVisualPlan(safeToolCalls, transcript, context);
  const visualPlan = toolCalls.find((call) => call?.name === 'presentVisualExplanation')?.args;
  const wordCount = String(result.text || '').trim().split(/\s+/).filter(Boolean).length;
  const needsFullTour = isDirectVisualRequest(transcript) && visualPlan && wordCount < 45;
  return { ...result, text: needsFullTour ? buildVisualTourText(visualPlan) : result.text, toolCalls };
}
