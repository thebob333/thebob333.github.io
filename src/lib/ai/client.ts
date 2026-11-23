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

/** The server's own explanation, e.g. "Schema is too complex for compilation." */
function apiMessage(err: InstanceType<typeof Anthropic.APIError>): string {
  const body = err.error as { error?: { message?: unknown } } | undefined;
  const m = body?.error?.message;
  return typeof m === 'string' ? m : '';
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
  if (err instanceof Anthropic.APIError) {
    const detail = apiMessage(err);
    console.error('Claude API error', err.status, detail);
    return new AiError(`Claude had a problem (${err.status ?? 'error'})${detail ? `: ${detail.slice(0, 220)}` : '. Try again.'}`, 'other');
  }
  return new AiError('Something went wrong talking to Claude. Try again.', 'other');
}

export interface AskOptions<S extends z.ZodType> {
  system: string;
  messages: { role: 'user' | 'assistant'; content: string }[];
  schema: S;
  effort?: 'low' | 'medium' | 'high';
  maxTokens?: number;
  /** Stream the reply (needed for long replies; avoids request timeouts). */
  stream?: boolean;
}

type Usage = { input_tokens: number; output_tokens: number; cache_read_input_tokens?: number | null; cache_creation_input_tokens?: number | null };
const track = (u: Usage) => addUsage(u.input_tokens + (u.cache_read_input_tokens ?? 0) + (u.cache_creation_input_tokens ?? 0), u.output_tokens);

/** One structured request. Throws AiError with a message you can show as-is. */
export async function askJSON<S extends z.ZodType>(opts: AskOptions<S>): Promise<z.infer<S>> {
  try {
    const params = {
      model: MODEL,
      max_tokens: opts.maxTokens ?? 16000,
      system: opts.system,
      messages: opts.messages,
      output_config: { format: betaZodOutputFormat(opts.schema), effort: opts.effort ?? 'medium' },
      // If a safety check declines, let Anthropic retry on a fallback model automatically.
      betas: ['server-side-fallback-2026-07-01'],
      fallbacks: 'default' as const,
    };
    const send = (p: typeof params | Omit<typeof params, 'betas' | 'fallbacks'>) => (opts.stream
      ? client().beta.messages.stream(p).finalMessage()
      : client().beta.messages.parse(p));
    let res: Awaited<ReturnType<typeof send>>;
    try {
      res = await send(params);
    } catch (e) {
      // Some accounts or request shapes reject the refusal-fallback beta: retry once without it.
      if (!(e instanceof Anthropic.BadRequestError) || /credit|balance|billing|schema/i.test(apiMessage(e))) throw e;
      const { betas: _b, fallbacks: _f, ...plain } = params;
      res = await send(plain);
    }
    track(res.usage);
    if (res.stop_reason === 'refusal') throw new AiError("Claude couldn't help with that one. Try rewording it.", 'refusal');
    if (res.stop_reason === 'max_tokens') throw new AiError('The reply was too long and got cut off. Try again.', 'bad-reply');
    if (!res.parsed_output) throw new AiError("Claude's reply didn't come through properly. Try again.", 'bad-reply');
    return res.parsed_output as z.infer<S>;
  } catch (err) {
    throw friendly(err);
  }
}

export interface Research { text: string; sources: { title: string; url: string }[] }

/**
 * Research with live web search (Anthropic runs the searches). Returns a plain
 * brief plus the pages it used. `onSearch` is called with each search query as it happens.
 */
export async function research(system: string, prompt: string, onSearch?: (query: string) => void): Promise<Research> {
  try {
    const c = client();
    const messages: Anthropic.Beta.BetaMessageParam[] = [{ role: 'user', content: prompt }];
    let final: Anthropic.Beta.BetaMessage | null = null;
    // Long searches can pause; send the turn back so the server continues it.
    let withFallback = true;
    for (let i = 0; i < 4; i++) {
      const run = () => {
        const stream = c.beta.messages.stream({
          model: MODEL,
          max_tokens: 12000,
          system,
          messages,
          tools: [{ type: 'web_search_20260209', name: 'web_search', max_uses: 6 }],
          output_config: { effort: 'medium' },
          ...(withFallback ? { betas: ['server-side-fallback-2026-07-01'], fallbacks: 'default' as const } : {}),
        });
        stream.on('contentBlock', block => {
          if (block.type === 'server_tool_use' && block.name === 'web_search') {
            const q = (block.input as { query?: unknown })?.query;
            if (typeof q === 'string') onSearch?.(q);
          }
        });
        return stream.finalMessage();
      };
      try {
        final = await run();
      } catch (e) {
        if (!withFallback || !(e instanceof Anthropic.BadRequestError)) throw e;
        withFallback = false;
        final = await run();
      }
      track(final.usage);
      if (final.stop_reason !== 'pause_turn') break;
      messages.push({ role: 'assistant', content: final.content });
    }
    if (!final || final.stop_reason === 'refusal') throw new AiError("Claude couldn't research that one. Try rewording it.", 'refusal');
    // Text from every turn of the conversation (a paused turn may hold part of it).
    const all = [...messages.filter(m => m.role === 'assistant').flatMap(m => (Array.isArray(m.content) ? m.content : [])), ...final.content];
    const text = all.filter((b): b is Anthropic.Beta.BetaTextBlock => b.type === 'text').map(b => b.text).join('').trim();
    const sources: Research['sources'] = [];
    for (const b of all) {
      if (b.type !== 'web_search_tool_result' || !Array.isArray(b.content)) continue; // an error result is an object, not a list
      for (const r of b.content) if (r.type === 'web_search_result' && !sources.some(x => x.url === r.url)) sources.push({ title: r.title, url: r.url });
    }
    return { text, sources: sources.slice(0, 8) };
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
