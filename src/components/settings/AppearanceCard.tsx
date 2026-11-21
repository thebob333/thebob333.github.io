import { useEffect, useState } from 'react';
import { useTheme } from 'next-themes';
import { Monitor, Moon, Sun } from 'lucide-react';
import { cn } from '@/lib/utils';

const OPTIONS = [
  { id: 'system', label: 'Auto', icon: Monitor },
  { id: 'light', label: 'Light', icon: Sun },
  { id: 'dark', label: 'Dark', icon: Moon },
] as const;

/** Light / dark / follow the phone. */
export function AppearanceCard() {
  const { theme, setTheme } = useTheme();
  // next-themes only knows the theme after mount.
  const [mounted, setMounted] = useState(false);
  useEffect(() => setMounted(true), []);
  const current = mounted ? theme ?? 'system' : 'system';

  return (
    <section className="space-y-2">
      <h2 className="section-label">Appearance</h2>
      <div role="radiogroup" aria-label="Theme" className="grid grid-cols-3 gap-2">
        {OPTIONS.map(o => (
          <button
            key={o.id}
            type="button"
            role="radio"
            aria-checked={current === o.id}
            onClick={() => setTheme(o.id)}
            className={cn('surface pressable flex h-[72px] flex-col items-center justify-center gap-1.5 text-footnote font-semibold transition-colors',
              current === o.id ? 'text-primary ring-2 ring-primary' : 'text-muted-foreground')}
          >
            <o.icon className="h-5 w-5" />
            {o.label}
          </button>
        ))}
      </div>
      <p className="px-1 text-footnote text-muted-foreground">Auto follows your iPhone's light/dark setting.</p>
    </section>
  );
}
