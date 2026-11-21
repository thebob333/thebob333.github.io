import { useMemo, useState } from 'react';
import { Check, Plus, Search } from 'lucide-react';
import { Dialog, DialogContent, DialogHeader, DialogTitle } from '@/components/app/ResponsiveDialog';
import { EXERCISE_LABELS, type CustomExercise } from '@/types/workout';

/** Searchable list of every exercise (built-in + your custom ones). */
export function ExercisePicker({ open, onClose, onPick, customExercises, exclude = [], title = 'Add exercise', onCreateCustom }: {
  open: boolean;
  onClose: () => void;
  onPick: (id: string) => void;
  customExercises: CustomExercise[];
  /** Already chosen — shown with a check and not pickable. */
  exclude?: string[];
  title?: string;
  onCreateCustom?: () => void;
}) {
  const [query, setQuery] = useState('');
  const options = useMemo(() => {
    const all = [
      ...Object.entries(EXERCISE_LABELS).map(([id, label]) => ({ id, label, custom: false })),
      ...customExercises.filter(e => !e.archived).map(e => ({ id: e.id, label: e.name, custom: true })),
    ];
    const q = query.trim().toLowerCase();
    return (q ? all.filter(o => o.label.toLowerCase().includes(q)) : all).sort((a, b) => a.label.localeCompare(b.label));
  }, [customExercises, query]);

  const close = () => { setQuery(''); onClose(); };

  return (
    <Dialog open={open} onOpenChange={o => !o && close()}>
      <DialogContent className="max-w-md">
        <DialogHeader><DialogTitle className="text-title">{title}</DialogTitle></DialogHeader>
        <label className="flex h-11 items-center gap-2 rounded-xl bg-secondary px-3">
          <Search className="h-4 w-4 text-muted-foreground" />
          <input value={query} onChange={e => setQuery(e.target.value)} placeholder="Search exercises" className="h-full flex-1 bg-transparent text-body outline-none placeholder:text-muted-foreground" />
        </label>
        <div className="list-group max-h-[50vh] overflow-y-auto">
          {options.map(o => {
            const taken = exclude.includes(o.id);
            return (
              <button
                key={o.id}
                type="button"
                disabled={taken}
                onClick={() => { onPick(o.id); close(); }}
                className="flex min-h-[50px] w-full items-center gap-3 px-4 text-left text-body font-medium active:bg-accent/70 disabled:text-muted-foreground"
              >
                <span className="flex-1 truncate">{o.label}</span>
                {o.custom && <span className="text-footnote text-muted-foreground">Custom</span>}
                {taken && <Check className="h-4 w-4 text-move" />}
              </button>
            );
          })}
          {options.length === 0 && <p className="px-4 py-6 text-center text-footnote text-muted-foreground">No exercise called “{query}”.</p>}
        </div>
        {onCreateCustom && (
          <button type="button" onClick={() => { close(); onCreateCustom(); }} className="flex h-11 items-center justify-center gap-1.5 text-body font-semibold text-primary">
            <Plus className="h-4 w-4" /> Create a custom exercise
          </button>
        )}
      </DialogContent>
    </Dialog>
  );
}
