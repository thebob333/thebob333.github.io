import { Check } from 'lucide-react';
import { cn } from '@/lib/utils';

/** A 24px round check inside a 40px tap target — easy to hit with a thumb. */
export function RoundCheck({ checked, onToggle, label, tone = 'todo' }: { checked: boolean; onToggle: () => void; label: string; tone?: 'todo' | 'habit' }) {
  return (
    <button
      type="button"
      role="checkbox"
      aria-checked={checked}
      aria-label={label}
      onClick={e => { e.stopPropagation(); onToggle(); }}
      className="flex h-10 w-10 shrink-0 items-center justify-center rounded-full focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring"
    >
      <span
        className={cn(
          'flex h-6 w-6 items-center justify-center rounded-full border-2 transition-all',
          checked
            ? tone === 'habit' ? 'border-amber bg-amber text-white' : 'border-primary bg-primary text-primary-foreground'
            : tone === 'habit' ? 'border-amber/60' : 'border-muted-foreground/40',
        )}
      >
        {checked && <Check className="h-3.5 w-3.5" strokeWidth={3} />}
      </span>
    </button>
  );
}
