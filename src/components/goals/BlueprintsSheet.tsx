import { useNavigate } from 'react-router-dom';
import { Bookmark, Trash2 } from 'lucide-react';
import { toast } from 'sonner';
import { Dialog, DialogContent, DialogDescription, DialogHeader, DialogTitle } from '@/components/app/ResponsiveDialog';
import { RowMenu } from '@/components/app/RowMenu';
import { useGoals } from '@/hooks/useGoals';
import { stores } from '@/lib/storage';

/** Saved goal plans you can start again any time. */
export function BlueprintsSheet({ open, onClose }: { open: boolean; onClose: () => void }) {
  const { templates, createFromTemplate, deleteTemplate } = useGoals();
  const navigate = useNavigate();
  return (
    <Dialog open={open} onOpenChange={o => !o && onClose()}>
      <DialogContent className="max-w-md">
        <DialogHeader>
          <DialogTitle className="text-title">Blueprints</DialogTitle>
          <DialogDescription>Reuse a plan you've saved. Deadlines are set from today.</DialogDescription>
        </DialogHeader>
        {templates.length === 0 ? (
          <p className="py-6 text-center text-body text-muted-foreground">No blueprints yet. Open a goal and choose “Save as blueprint”.</p>
        ) : (
          <div className="list-group">
            {templates.map(t => (
              <div key={t.id} className="flex items-center gap-3 px-4 py-3">
                <span className="flex h-9 w-9 shrink-0 items-center justify-center rounded-full bg-primary/10 text-primary"><Bookmark className="h-4 w-4" /></span>
                <div className="min-w-0 flex-1">
                  <p className="truncate text-body font-semibold">{t.name}</p>
                  <p className="text-footnote text-muted-foreground">{t.phases.length} phases · {t.phases.reduce((s, p) => s + p.tasks.length, 0)} tasks</p>
                </div>
                <button type="button" className="pressable h-9 rounded-full bg-primary px-3.5 text-footnote font-semibold text-primary-foreground"
                  onClick={() => { const g = createFromTemplate(t); onClose(); navigate(`/goals/${g.id}`); toast.success('Goal created from blueprint'); }}>
                  Use
                </button>
                <RowMenu label={`Actions for ${t.name}`} items={[{
                  label: 'Delete blueprint', icon: Trash2, destructive: true,
                  onSelect: () => { deleteTemplate(t.id); toast.success('Blueprint deleted', { action: { label: 'Undo', onClick: () => stores.GOAL_TEMPLATES.update(l => [...l, t]) } }); },
                }]} />
              </div>
            ))}
          </div>
        )}
      </DialogContent>
    </Dialog>
  );
}
