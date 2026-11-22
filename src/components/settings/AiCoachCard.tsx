import { useState } from 'react';
import { ExternalLink, KeyRound, Loader2, ShieldCheck } from 'lucide-react';
import { toast } from 'sonner';
import { Button } from '@/components/ui/button';
import { maskKey, setAiKey, useAiKey, useAiUsage, usageCost } from '@/lib/ai/device';
import { AiError, testKey } from '@/lib/ai/client';

/**
 * Your own Anthropic key, stored only on this phone (never in backups or the
 * app's public code). Requests go straight from the phone to Anthropic.
 */
export function AiCoachCard() {
  const key = useAiKey();
  const usage = useAiUsage();
  const [draft, setDraft] = useState('');
  const [busy, setBusy] = useState(false);

  const save = async () => {
    const k = draft.trim();
    if (!k) return;
    if (!k.startsWith('sk-ant-')) { toast.error('That doesn\'t look like an Anthropic key — it should start with sk-ant-'); return; }
    setAiKey(k);
    setBusy(true);
    try {
      await testKey();
      setDraft('');
      toast.success('Coach connected', { description: 'Your key is saved on this phone only.' });
    } catch (e) {
      setAiKey(null);
      toast.error(e instanceof AiError ? e.message : 'That key didn\'t work.');
    } finally {
      setBusy(false);
    }
  };

  const test = async () => {
    setBusy(true);
    try { await testKey(); toast.success('Coach is connected and working'); }
    catch (e) { toast.error(e instanceof AiError ? e.message : 'Test failed'); }
    finally { setBusy(false); }
  };

  return (
    <section className="space-y-2">
      <h2 className="section-label">AI coach</h2>
      {key ? (
        <>
          <div className="list-group">
            <div className="flex min-h-[52px] items-center gap-3 px-4">
              <KeyRound className="h-5 w-5 shrink-0 text-success" />
              <span className="flex-1 text-body font-medium">Connected</span>
              <span className="font-mono text-footnote text-muted-foreground">{maskKey(key)}</span>
            </div>
            <div className="flex min-h-[52px] items-center gap-3 px-4">
              <span className="flex-1 text-body font-medium">This month</span>
              <span className="text-footnote tabular-nums text-muted-foreground">{usage.calls} request{usage.calls === 1 ? '' : 's'} · about ${usageCost(usage).toFixed(2)}</span>
            </div>
            <button type="button" onClick={test} disabled={busy} className="flex min-h-[52px] w-full items-center gap-3 px-4 text-left text-body font-medium text-primary active:bg-accent/70">
              {busy && <Loader2 className="h-4 w-4 animate-spin" />} Test connection
            </button>
            <button type="button" onClick={() => { setAiKey(null); toast.success('Key removed from this phone'); }} className="flex min-h-[52px] w-full items-center px-4 text-left text-body font-medium text-destructive active:bg-accent/70">
              Remove key
            </button>
          </div>
          <p className="flex items-start gap-1.5 px-1 text-footnote text-muted-foreground">
            <ShieldCheck className="mt-0.5 h-3.5 w-3.5 shrink-0" />
            Stored on this phone only — never in backups. Cost is an estimate; your real bill and spending cap are at console.anthropic.com.
          </p>
        </>
      ) : (
        <div className="surface space-y-3 p-4">
          <p className="text-body">The coach plans new goals with you and runs your weekly check-in. It uses your own Anthropic key — about $2–6 a month for normal use.</p>
          <ol className="space-y-1.5 text-footnote text-muted-foreground">
            <li><b className="text-foreground">1.</b> Sign in at console.anthropic.com and add a little credit.</li>
            <li><b className="text-foreground">2.</b> Set a monthly spending limit (Settings → Limits).</li>
            <li><b className="text-foreground">3.</b> Create a key and paste it below.</li>
          </ol>
          <a href="https://console.anthropic.com/settings/keys" target="_blank" rel="noreferrer" className="inline-flex items-center gap-1 text-footnote font-semibold text-primary">
            Open the Anthropic console <ExternalLink className="h-3.5 w-3.5" />
          </a>
          <form className="flex gap-2" onSubmit={e => { e.preventDefault(); save(); }}>
            <input type="password" autoComplete="off" value={draft} onChange={e => setDraft(e.target.value)} placeholder="sk-ant-…" aria-label="Anthropic key"
              className="h-11 min-w-0 flex-1 rounded-xl bg-secondary px-3 font-mono text-body outline-none placeholder:text-muted-foreground" />
            <Button type="submit" className="h-11 rounded-xl px-4 font-semibold" disabled={!draft.trim() || busy}>
              {busy ? <Loader2 className="h-4 w-4 animate-spin" /> : 'Connect'}
            </Button>
          </form>
          <p className="text-footnote text-muted-foreground">No key? The coach still works by copying a prompt into your Claude app and pasting the reply back.</p>
        </div>
      )}
    </section>
  );
}
