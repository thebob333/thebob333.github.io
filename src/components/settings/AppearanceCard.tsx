import { useEffect, useState } from 'react';
import { useTheme } from 'next-themes';
import { Monitor, Moon, Palette, Sun } from 'lucide-react';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';

const OPTIONS = [
  { id: 'system', label: 'Auto', icon: Monitor, hint: 'Match iPhone' },
  { id: 'light', label: 'Light', icon: Sun },
  { id: 'dark', label: 'Dark', icon: Moon },
] as const;

export function AppearanceCard() {
  const { theme, setTheme } = useTheme();
  // next-themes only knows the theme after mount.
  const [mounted, setMounted] = useState(false);
  useEffect(() => setMounted(true), []);
  const current = mounted ? theme ?? 'system' : 'system';

  return (
    <Card className="shadow-sm">
      <CardHeader>
        <CardTitle className="flex items-center gap-2">
          <Palette className="h-5 w-5 text-primary" /> Appearance
        </CardTitle>
      </CardHeader>
      <CardContent>
        <div role="radiogroup" aria-label="Theme" className="grid grid-cols-3 gap-2">
          {OPTIONS.map(o => (
            <button
              key={o.id}
              role="radio"
              aria-checked={current === o.id}
              onClick={() => setTheme(o.id)}
              className={`flex h-16 flex-col items-center justify-center gap-1 rounded-xl border text-sm font-medium transition-colors ${
                current === o.id ? 'border-primary bg-primary/10 text-primary' : 'text-muted-foreground hover:bg-accent'
              }`}
            >
              <o.icon className="h-5 w-5" />
              {o.label}
            </button>
          ))}
        </div>
        <p className="mt-2 text-xs text-muted-foreground">Auto follows your iPhone's light/dark setting.</p>
      </CardContent>
    </Card>
  );
}
