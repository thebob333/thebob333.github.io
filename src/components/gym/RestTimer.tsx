import { useEffect, useState } from 'react';
import { Timer } from 'lucide-react';
import { toast } from 'sonner';
import { DropdownMenu, DropdownMenuContent, DropdownMenuItem, DropdownMenuLabel, DropdownMenuTrigger } from '@/components/ui/dropdown-menu';

const PRESETS = [60, 90, 120, 180];
const fmt = (n: number) => `${Math.floor(n / 60)}:${String(n % 60).padStart(2, '0')}`;

/**
 * Compact rest timer pill. Tap to start the last-used length, tap again to stop;
 * the small menu picks a length. Timestamp-based, so it stays right when the phone locks.
 */
export function RestTimer() {
  const [seconds, setSeconds] = useState(90);
  const [endsAt, setEndsAt] = useState<number | null>(null);
  const [now, setNow] = useState(() => Date.now());

  useEffect(() => {
    if (endsAt === null) return;
    const tick = () => {
      const t = Date.now();
      setNow(t);
      if (t >= endsAt) {
        setEndsAt(null);
        toast.success('Rest done — next set 💪');
        navigator.vibrate?.(200);
      }
    };
    tick();
    const id = setInterval(tick, 250);
    document.addEventListener('visibilitychange', tick);
    return () => { clearInterval(id); document.removeEventListener('visibilitychange', tick); };
  }, [endsAt]);

  const running = endsAt !== null;
  const left = running ? Math.max(0, Math.ceil((endsAt - now) / 1000)) : seconds;
  const start = (s: number) => { setSeconds(s); setEndsAt(Date.now() + s * 1000); };

  return (
    <div className="flex h-12 items-center overflow-hidden rounded-2xl bg-secondary">
      <button
        type="button"
        onClick={() => (running ? setEndsAt(null) : start(seconds))}
        aria-label={running ? `Stop rest timer, ${fmt(left)} left` : `Start ${fmt(seconds)} rest`}
        className={`flex h-full items-center gap-2 pl-3.5 pr-2 text-headline tabular-nums ${running ? 'text-move' : 'text-foreground'}`}
      >
        <Timer className="h-[18px] w-[18px]" /> {fmt(left)}
      </button>
      <DropdownMenu>
        <DropdownMenuTrigger aria-label="Rest length" className="flex h-full items-center pl-1 pr-3 text-footnote font-semibold text-muted-foreground">
          {running ? 'Stop' : 'Rest'}
        </DropdownMenuTrigger>
        <DropdownMenuContent align="start" side="top">
          <DropdownMenuLabel className="text-footnote">Rest for</DropdownMenuLabel>
          {PRESETS.map(p => (
            <DropdownMenuItem key={p} className="h-10 text-body" onSelect={() => start(p)}>{fmt(p)}</DropdownMenuItem>
          ))}
          {running && <DropdownMenuItem className="h-10 text-body text-destructive" onSelect={() => setEndsAt(null)}>Stop timer</DropdownMenuItem>}
        </DropdownMenuContent>
      </DropdownMenu>
    </div>
  );
}
