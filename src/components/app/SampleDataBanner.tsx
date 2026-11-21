import { useState } from 'react';
import { useStore } from '@/hooks/useStore';
import { stores } from '@/lib/storage';
import { Sparkles } from 'lucide-react';
import { toast } from 'sonner';
import { getSampleRecord, keepSampleData, removeSampleData } from '@/lib/sample-data';

/** Shown while sample data is loaded, with a one-tap way to remove it. */
export function SampleDataBanner() {
  // Re-check whenever goals change (sample data may be added after this mounts).
  useStore(stores.GOALS);
  const [hidden, setHidden] = useState(false);
  const active = !hidden && !!getSampleRecord();
  if (!active) return null;
  const setActive = (v: boolean) => setHidden(!v);
  return (
    <div className="flex items-center gap-3 rounded-2xl border border-dashed border-primary/40 bg-primary/5 p-3">
      <Sparkles className="h-4 w-4 shrink-0 text-primary" />
      <p className="min-w-0 flex-1 text-xs text-muted-foreground">You're exploring with sample data.</p>
      <button type="button" className="h-9 rounded-full px-2 text-xs font-medium text-muted-foreground" onClick={() => { keepSampleData(); setActive(false); }}>Keep it</button>
      <button type="button" className="h-9 rounded-full bg-primary px-3 text-xs font-semibold text-primary-foreground" onClick={() => { removeSampleData(); setActive(false); toast.success('Sample data removed — the app is all yours'); }}>
        Remove
      </button>
    </div>
  );
}
