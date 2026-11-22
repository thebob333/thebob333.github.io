import { useState } from 'react';
import { ClipboardCopy, Check } from 'lucide-react';
import { toast } from 'sonner';
import { Button } from '@/components/ui/button';
import { Textarea } from '@/components/ui/textarea';

/**
 * No key? Copy the prompt into your own Claude app, paste the reply back.
 * Same result, no cost, nothing to steal.
 */
export function PasteFallback({ prompt, onReply, extra }: { prompt: () => string; onReply: (text: string) => void; extra?: React.ReactNode }) {
  const [copied, setCopied] = useState(false);
  const [reply, setReply] = useState('');

  const copy = async () => {
    try {
      await navigator.clipboard.writeText(prompt());
      setCopied(true);
      toast.success('Copied — paste it into the Claude app');
    } catch {
      toast.error("Couldn't copy — your browser blocked it");
    }
  };

  return (
    <div className="space-y-3">
      {extra}
      <div className="flex items-start gap-3">
        <span className="flex h-7 w-7 shrink-0 items-center justify-center rounded-full bg-primary text-footnote font-bold text-primary-foreground">1</span>
        <div className="min-w-0 flex-1">
          <p className="text-body font-medium">Copy the prompt into the Claude app</p>
          <Button variant="secondary" className="mt-2 h-11 w-full rounded-xl" onClick={copy}>
            {copied ? <Check className="mr-2 h-4 w-4" /> : <ClipboardCopy className="mr-2 h-4 w-4" />}{copied ? 'Copied' : 'Copy prompt'}
          </Button>
        </div>
      </div>
      <div className="flex items-start gap-3">
        <span className="flex h-7 w-7 shrink-0 items-center justify-center rounded-full bg-primary text-footnote font-bold text-primary-foreground">2</span>
        <div className="min-w-0 flex-1">
          <p className="text-body font-medium">Paste Claude's whole reply here</p>
          <Textarea value={reply} onChange={e => setReply(e.target.value)} rows={4} className="mt-2 rounded-xl font-mono text-footnote" placeholder='{ "summary": … }' />
          <Button className="mt-2 h-11 w-full rounded-xl font-semibold" disabled={!reply.trim()} onClick={() => onReply(reply)}>Continue</Button>
        </div>
      </div>
      <p className="text-footnote text-muted-foreground">Tip: add your own key in Settings → AI coach and this happens instantly, right here.</p>
    </div>
  );
}
