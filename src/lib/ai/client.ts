/**
 * Talks to Claude straight from the phone with your own key (stored only on
 * this device — see ./device.ts). Every reply is structured data checked
 * against a schema, so the app never has to guess at loose text.
 */
import Anthropic from '@anthropic-ai/sdk';
import { betaZodOutputFormat } from '@anthropic-ai/sdk/helpers/beta/zod';
import type { z } from 'zod/v4';
import { addUsage, getAiKey } from './device';

export const MODEL = 'claude-opus-5-5';

export class AiError extends Error {
  constructor(message: string, readonly kind: 'no-key' | 'auth' | 'credit' | 'rate' | 'offline' | 'refusal' | 'bad-reply' | 'other') {
    super(message);
  }
}

function client(): Anthropic {
  const apiKey = getAiKey();
  if (!apiKey) throw new AiError('Add your Anthropic key in Settings → AI coach first.', 'no-key');
  // The key is the user's own and lives only on their phone; requests go straight to Anthropic.
  return new Anthropic({ apiKey, dangerouslyAllowBrowser: true, maxRetries: 2, timeout: 120_000 });
}

function friendly(err: unknown): AiError {
  if (err instanceof AiError) return err;
  if (err instanceof Anthropic.AuthenticationError || err instanceof Anthropic.PermissionDeniedError) {
    return new AiError("That key didn't work. Check it in Settings → AI coach (it starts with sk-ant-).", 'auth');
  }
  if (err instanceof Anthropic.RateLimitError) return new AiError('Claude is busy or your spending cap was reached. Try again in a minute.', 'rate');
  if (err instanceof Anthropic.APIConnectionError) return new AiError("Couldn't reach Claude. Check your connection and try again.", 'offline');
  if (err instanceof Anthropic.BadRequestError && /credit|balance|billing/i.test(err.message)) {
    return new AiError('Your Anthropic account is out of credit. Add some at console.anthropic.com.', 'credit');
  }
  if (err instanceof Anthropic.APIError) return new AiError(`Claude had a problem (${err.status ?? 'error'}). Try again.`, 'other');
  return new AiError('Something went wrong talking to Claude. Try again.', 'other');
}

export interface AskOptions<S extends z.ZodType> {
  system: string;
  messages: { role: 'user' | 'assistant'; content: string }[];
  schema: S;
  effort?: 'low' | 'medium' | 'high';
  maxTokens?: number;
}

/** One structured request. Throws AiError with a message you can show as-is. */
export async function askJSON<S extends z.ZodType>(opts: AskOptions<S>): Promise<z.infer<S>> {
  try {
    const res = await client().beta.messages.parse({
      model: MODEL,
      max_tokens: opts.maxTokens ?? 16000,
      system: opts.system,
      messages: opts.messages,
      output_config: { format: betaZodOutputFormat(opts.schema), effort: opts.effort ?? 'medium' },
      // If a safety check declines, let Anthropic retry on a fallback model automatically.
      betas: ['server-side-fallback-2026-07-01'],
      fallbacks: 'default',
    });
    addUsage(res.usage.input_tokens + (res.usage.cache_read_input_tokens ?? 0) + (res.usage.cache_creation_input_tokens ?? 0), res.usage.output_tokens);
    if (res.stop_reason === 'refusal') throw new AiError("Claude couldn't help with that one. Try rewording it.", 'refusal');
    if (res.stop_reason === 'max_tokens') throw new AiError('The reply was too long and got cut off. Try again.', 'bad-reply');
    if (!res.parsed_output) throw new AiError("Claude's reply didn't come through properly. Try again.", 'bad-reply');
    return res.parsed_output as z.infer<S>;
  } catch (err) {
    throw friendly(err);
  }
}

/** A tiny, cheap request to confirm the key works. */
export async function testKey(): Promise<void> {
  const { z } = await import('zod/v4');
  await askJSON({
    system: 'Reply with ok: true.',
    messages: [{ role: 'user', content: 'Connection check.' }],
    schema: z.object({ ok: z.boolean() }),
    effort: 'low',
    maxTokens: 2000,
  });
}
