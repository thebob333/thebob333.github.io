import { useState } from 'react';
import { Check, Plus, Trash2 } from 'lucide-react';
import { toast } from 'sonner';
import { Dialog, DialogContent, DialogDescription, DialogHeader, DialogTitle } from '@/components/app/ResponsiveDialog';
import { Button } from '@/components/ui/button';
import { useStore } from '@/hooks/useStore';
import { DEFAULT_CATEGORIES, generateId, stores, type BlockCategory } from '@/lib/storage';
import { cn } from '@/lib/utils';

const COLOR_PRESETS = [
  '130 100% 40%', '42 100% 50%', '280 80% 55%', '210 80% 50%', '170 70% 40%',
  '350 80% 55%', '20 90% 50%', '300 70% 50%', '160 60% 45%', '60 20% 40%',
];

/** Add and remove the colored categories used by Plan blocks. */
export function CategoriesSheet({ open, onClose }: { open: boolean; onClose: () => void }) {
  const categories = useStore(stores.BLOCK_CATEGORIES);
  const [name, setName] = useState('');
  const [color, setColor] = useState(COLOR_PRESETS[3]);

  const add = () => {
    if (!name.trim()) return;
    const cat: BlockCategory = { id: generateId(), name: name.trim(), color };
    stores.BLOCK_CATEGORIES.update(prev => [...prev, cat]);
    setName('');
    toast.success(`Added ${cat.name}`);
  };

  const remove = (cat: BlockCategory) => {
    // Never delete blocks along with a category — move them to Personal.
    const fallback = 'personal';
    const moved = stores.TIME_BLOCKS.get().filter(b => b.categoryId === cat.id).length;
    stores.BLOCK_CATEGORIES.update(prev => prev.filter(c => c.id !== cat.id));
    stores.TIME_BLOCKS.update(prev => (moved ? prev.map(b => (b.categoryId === cat.id ? { ...b, categoryId: fallback } : b)) : prev));
    stores.REPEATABLE_BLOCKS.update(prev => (prev.some(r => r.categoryId === cat.id) ? prev.map(r => (r.categoryId === cat.id ? { ...r, categoryId: fallback } : r)) : prev));
    toast.success(moved ? `${cat.name} removed — ${moved} block${moved === 1 ? '' : 's'} moved to Personal` : `${cat.name} removed`);
  };

  return (
    <Dialog open={open} onOpenChange={o => !o && onClose()}>
      <DialogContent className="max-w-md">
        <DialogHeader>
          <DialogTitle className="text-title">Categories</DialogTitle>
          <DialogDescription>Colors for your Plan blocks.</DialogDescription>
        </DialogHeader>
        <div className="list-group max-h-[40vh] overflow-y-auto">
          {categories.map(c => (
            <div key={c.id} className="flex min-h-[50px] items-center gap-3 px-4">
              <span className="h-4 w-4 shrink-0 rounded-full" style={{ backgroundColor: `hsl(${c.color})` }} />
              <span className="flex-1 truncate text-body font-medium">{c.name}</span>
              {!DEFAULT_CATEGORIES.some(d => d.id === c.id) && (
                <button type="button" aria-label={`Remove ${c.name}`} onClick={() => remove(c)} className="flex h-10 w-10 items-center justify-center text-muted-foreground">
                  <Trash2 className="h-4 w-4" />
                </button>
              )}
            </div>
          ))}
        </div>
        <form className="space-y-3" onSubmit={e => { e.preventDefault(); add(); }}>
          <input value={name} onChange={e => setName(e.target.value)} placeholder="New category" className="h-12 w-full rounded-xl bg-secondary px-3 text-body outline-none placeholder:text-muted-foreground" />
          <div className="flex flex-wrap gap-2" role="radiogroup" aria-label="Color">
            {COLOR_PRESETS.map(c => (
              <button key={c} type="button" role="radio" aria-checked={c === color} aria-label={`Color ${c}`} onClick={() => setColor(c)}
                className={cn('flex h-9 w-9 items-center justify-center rounded-full', c === color && 'ring-2 ring-foreground ring-offset-2 ring-offset-background')}
                style={{ backgroundColor: `hsl(${c})` }}>
                {c === color && <Check className="h-4 w-4 text-white" strokeWidth={3} />}
              </button>
            ))}
          </div>
          <Button type="submit" className="h-12 w-full rounded-xl text-body font-semibold" disabled={!name.trim()}><Plus className="mr-1.5 h-4 w-4" /> Add category</Button>
        </form>
      </DialogContent>
    </Dialog>
  );
}
