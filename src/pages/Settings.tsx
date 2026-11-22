import { useState } from 'react';
import { ChevronRight } from 'lucide-react';
import { stores } from '@/lib/storage';
import { useStore } from '@/hooks/useStore';
import { useSettings } from '@/hooks/useSettings';
import { BUILT_IN_EXERCISE_IDS, EXERCISE_LABELS, type CompoundExercise } from '@/types/workout';
import { getStandard, suggestedCustomTarget } from '@/lib/strength-standards';
import { PageHeader } from '@/components/app/PageHeader';
import { Dialog, DialogContent, DialogDescription, DialogHeader, DialogTitle } from '@/components/app/ResponsiveDialog';
import { Switch } from '@/components/ui/switch';
import { Textarea } from '@/components/ui/textarea';
import { Button } from '@/components/ui/button';
import { DataCard } from '@/components/settings/DataCard';
import { AppearanceCard } from '@/components/settings/AppearanceCard';
import { AiCoachCard } from '@/components/settings/AiCoachCard';

const MIN_BODYWEIGHT = 50;
const MAX_BODYWEIGHT = 700;

function Row({ label, hint, children, onClick }: { label: string; hint?: string; children?: React.ReactNode; onClick?: () => void }) {
  const inner = (
    <>
      <span className="min-w-0 flex-1 py-2">
        <span className="block text-body font-medium">{label}</span>
        {hint && <span className="block text-footnote text-muted-foreground">{hint}</span>}
      </span>
      {children}
      {onClick && <ChevronRight className="h-4 w-4 shrink-0 text-muted-foreground/60" />}
    </>
  );
  const cls = 'flex min-h-[52px] w-full items-center gap-3 px-4 text-left';
  return onClick
    ? <button type="button" onClick={onClick} className={`${cls} active:bg-accent/70`}>{inner}</button>
    : <div className={cls}>{inner}</div>;
}

export default function SettingsPage() {
  const { settings, updateSettings } = useSettings();
  const customExercises = useStore(stores.CUSTOM_EXERCISES).filter(e => !e.archived);
  // Local drafts so typing never saves a half-entered value (e.g. "0" while clearing the field).
  const [bodyweightDraft, setBodyweightDraft] = useState(() => String(settings.bodyweight));
  const [quotesDraft, setQuotesDraft] = useState(() => settings.customQuotes.join('\n'));
  const [goalsOpen, setGoalsOpen] = useState(false);
  const [quotesOpen, setQuotesOpen] = useState(false);
  const customTargets = Object.keys(settings.goldTargets ?? {}).length;

  const commitBodyweight = (text: string) => {
    setBodyweightDraft(text);
    const n = Number(text);
    if (text.trim() !== '' && Number.isFinite(n) && n >= MIN_BODYWEIGHT && n <= MAX_BODYWEIGHT) updateSettings({ bodyweight: n });
  };

  const updateQuotes = (text: string) => {
    setQuotesDraft(text);
    updateSettings({ customQuotes: text.split('\n').map(q => q.trim()).filter(Boolean) });
  };

  const setGoldTarget = (id: string, raw: string) => {
    const val = raw === '' ? undefined : Number(raw);
    updateSettings(s => {
      const next = { ...s.goldTargets };
      if (val && Number.isFinite(val) && val > 0) next[id] = val;
      else delete next[id];
      return { goldTargets: next };
    });
  };

  const targetInput = (id: string, placeholder: number, unit: string, label: string) => (
    <label className="flex h-10 w-[104px] shrink-0 items-center rounded-xl bg-secondary px-3">
      <input type="number" inputMode="numeric" aria-label={`${label} goal`} placeholder={String(placeholder)} value={settings.goldTargets?.[id] || ''}
        onChange={e => setGoldTarget(id, e.target.value)} className="w-full min-w-0 bg-transparent text-right text-body font-semibold tabular-nums outline-none placeholder:font-normal placeholder:text-muted-foreground" />
      <span className="ml-1 text-footnote text-muted-foreground">{unit}</span>
    </label>
  );

  return (
    <div className="mx-auto max-w-lg space-y-7 pb-10">
      <PageHeader title="Settings" back />

      <DataCard>
        <AiCoachCard />

        <AppearanceCard />

        <section className="space-y-2">
          <h2 className="section-label">Training</h2>
          <div className="list-group">
            <Row label="Bodyweight" hint="For strength standards and bodyweight lifts">
              <label className="flex h-10 w-[104px] shrink-0 items-center rounded-xl bg-secondary px-3">
                <input type="number" inputMode="decimal" aria-label="Bodyweight in pounds" value={bodyweightDraft}
                  onChange={e => commitBodyweight(e.target.value)} onBlur={() => setBodyweightDraft(String(settings.bodyweight))}
                  className="w-full min-w-0 bg-transparent text-right text-body font-semibold tabular-nums outline-none" />
                <span className="ml-1 text-footnote text-muted-foreground">lb</span>
              </label>
            </Row>
            <Row label="Strength goals" hint={customTargets ? `${customTargets} set by you` : 'Using recommended levels'} onClick={() => setGoalsOpen(true)} />
          </div>
          <p className="px-1 text-footnote text-muted-foreground">Exercise targets and your weekly split live in Gym → Program.</p>
        </section>

        <section className="space-y-2">
          <h2 className="section-label">Today screen</h2>
          <div className="list-group">
            <Row label="Daily quote" hint="A line of motivation on your Now card">
              <Switch checked={settings.quotesEnabled} onCheckedChange={checked => updateSettings({ quotesEnabled: checked })} aria-label="Daily quote" />
            </Row>
            {settings.quotesEnabled && (
              <Row label="Your own quotes" hint={settings.customQuotes.length ? `${settings.customQuotes.length} added` : 'Using built-in quotes'} onClick={() => setQuotesOpen(true)} />
            )}
          </div>
        </section>

        <section className="space-y-2">
          <h2 className="section-label">On a computer</h2>
          <div className="list-group">
            <Row label="Fire ambience button" hint="Adds a crackling-fire sound toggle to the top bar">
              <Switch checked={settings.ambientSoundEnabled} onCheckedChange={checked => updateSettings({ ambientSoundEnabled: checked })} aria-label="Fire ambience button" />
            </Row>
          </div>
        </section>
      </DataCard>

      {/* Strength goals */}
      <Dialog open={goalsOpen} onOpenChange={setGoalsOpen}>
        <DialogContent className="max-w-md">
          <DialogHeader>
            <DialogTitle className="text-title">Strength goals</DialogTitle>
            <DialogDescription>Your “gold” level for each lift — it fills in the strength map. Leave a box empty to use the recommended level shown.</DialogDescription>
          </DialogHeader>
          <div className="list-group max-h-[55vh] overflow-y-auto">
            {BUILT_IN_EXERCISE_IDS.map(ex => {
              const label = EXERCISE_LABELS[ex as CompoundExercise];
              return (
                <Row key={ex} label={label}>
                  {targetInput(ex, getStandard(ex as CompoundExercise, 'advanced', settings.bodyweight), ex === 'pull_up' ? 'reps' : 'lb', label)}
                </Row>
              );
            })}
            {customExercises.map(ce => (
              <Row key={ce.id} label={ce.name} hint="Custom">
                {targetInput(ce.id, suggestedCustomTarget(ce.equipment, settings.bodyweight), ce.equipment === 'bodyweight' ? 'reps' : 'lb', ce.name)}
              </Row>
            ))}
          </div>
          <Button className="h-12 w-full rounded-xl text-body font-semibold" onClick={() => setGoalsOpen(false)}>Done</Button>
        </DialogContent>
      </Dialog>

      {/* Quotes */}
      <Dialog open={quotesOpen} onOpenChange={setQuotesOpen}>
        <DialogContent className="max-w-md">
          <DialogHeader>
            <DialogTitle className="text-title">Your own quotes</DialogTitle>
            <DialogDescription>One per line. Leave empty to use the built-in ones.</DialogDescription>
          </DialogHeader>
          <Textarea className="h-48 rounded-xl text-body" placeholder="The obstacle is the way." value={quotesDraft} onChange={e => updateQuotes(e.target.value)} />
          <Button className="h-12 w-full rounded-xl text-body font-semibold" onClick={() => setQuotesOpen(false)}>Done</Button>
        </DialogContent>
      </Dialog>
    </div>
  );
}
