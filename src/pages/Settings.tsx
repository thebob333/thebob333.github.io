import { useState } from 'react';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Input } from '@/components/ui/input';
import { Textarea } from '@/components/ui/textarea';
import { Switch } from '@/components/ui/switch';
import { Label } from '@/components/ui/label';
import { Quote, Weight, Flame, Target } from 'lucide-react';
import { stores } from '@/lib/storage';
import { useStore } from '@/hooks/useStore';
import { useSettings } from '@/hooks/useSettings';
import { BUILT_IN_EXERCISE_IDS, EXERCISE_LABELS, CompoundExercise, CustomExercise } from '@/types/workout';
import { getStandard, suggestedCustomTarget } from '@/lib/strength-standards';
import { DataCard } from '@/components/settings/DataCard';
import { PageHeader } from '@/components/app/PageHeader';
import { AppearanceCard } from '@/components/settings/AppearanceCard';

const MIN_BODYWEIGHT = 50;
const MAX_BODYWEIGHT = 700;

export default function SettingsPage() {
  const { settings, updateSettings } = useSettings();
  const customExercises = useStore(stores.CUSTOM_EXERCISES).filter(e => !e.archived);
  // Local drafts so typing never saves a half-entered value (e.g. "0" while clearing the field).
  const [bodyweightDraft, setBodyweightDraft] = useState(() => String(settings.bodyweight));
  const [quotesDraft, setQuotesDraft] = useState(() => settings.customQuotes.join('\n'));

  const commitBodyweight = (text: string) => {
    setBodyweightDraft(text);
    const n = Number(text);
    if (text.trim() !== '' && Number.isFinite(n) && n >= MIN_BODYWEIGHT && n <= MAX_BODYWEIGHT) {
      updateSettings({ bodyweight: n });
    }
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

  return (
    <div className="max-w-3xl mx-auto space-y-6">
      <PageHeader title="Settings" subtitle="Your data, body metrics and preferences" back />

      <AppearanceCard />

      {/* Body Metrics */}
      <Card className="shadow-sm">
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <Weight className="h-5 w-5 text-primary" /> Body Metrics
          </CardTitle>
        </CardHeader>
        <CardContent className="space-y-4">
          <div className="flex items-center gap-4">
            <Label className="w-32">Bodyweight (lbs)</Label>
            <Input
              type="number"
              inputMode="decimal"
              value={bodyweightDraft}
              onChange={e => commitBodyweight(e.target.value)}
              onBlur={() => setBodyweightDraft(String(settings.bodyweight))}
              className="w-32"
              min={MIN_BODYWEIGHT}
              max={MAX_BODYWEIGHT}
            />
          </div>
          <p className="text-xs text-muted-foreground">Used for strength standards comparison and 1RM calculations</p>
        </CardContent>
      </Card>

      {/* Strength Goals */}
      <Card className="shadow-sm">
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <Target className="h-5 w-5 text-primary" /> Strength Goals
          </CardTitle>
        </CardHeader>
        <CardContent className="space-y-4">
          <p className="text-xs text-muted-foreground">
            Set your personal targets for each lift. Leave blank to use bodyweight-based defaults (advanced level).
          </p>
          <div className="space-y-3">
            {BUILT_IN_EXERCISE_IDS.map(ex => {
              const defaultVal = getStandard(ex as CompoundExercise, 'advanced', settings.bodyweight);
              const unit = ex === 'pull_up' ? 'reps' : 'lbs';
              const customVal = settings.goldTargets?.[ex];
              return (
                <div key={ex} className="flex items-center gap-3">
                  <Label className="w-36 text-sm">{EXERCISE_LABELS[ex as CompoundExercise]}</Label>
                  <Input
                    type="number"
                    inputMode="numeric"
                    className="w-24"
                    placeholder={String(defaultVal)}
                    value={customVal || ''}
                    onChange={e => setGoldTarget(ex, e.target.value)}
                  />
                  <span className="text-xs text-muted-foreground w-8">{unit}</span>
                </div>
              );
            })}
          </div>
          {customExercises.length > 0 && (
            <>
              <div className="border-t border-border pt-4 mt-4">
                <p className="text-xs text-muted-foreground mb-3">
                  Custom exercises — leave blank to use the suggested goal shown.
                </p>
              </div>
              <div className="space-y-3">
                {customExercises.map((ce: CustomExercise) => {
                  const unit = ce.equipment === 'bodyweight' ? 'reps' : 'lbs';
                  const customVal = settings.goldTargets?.[ce.id];
                  return (
                    <div key={ce.id} className="flex items-center gap-3">
                      <Label className="w-36 text-sm truncate" title={ce.name}>{ce.name}</Label>
                      <Input
                        type="number"
                        inputMode="numeric"
                        className="w-24"
                        placeholder={String(suggestedCustomTarget(ce.equipment, settings.bodyweight))}
                        value={customVal || ''}
                        onChange={e => setGoldTarget(ce.id, e.target.value)}
                      />
                      <span className="text-xs text-muted-foreground w-8">{unit}</span>
                    </div>
                  );
                })}
              </div>
            </>
          )}
        </CardContent>
      </Card>

      {/* Ambient Sound */}
      <Card className="shadow-sm">
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <Flame className="h-5 w-5 text-primary" /> Ambient Sound
          </CardTitle>
        </CardHeader>
        <CardContent className="space-y-4">
          <div className="flex items-center justify-between">
            <div>
              <Label>Show fire ambience button</Label>
              <p className="text-xs text-muted-foreground mt-0.5">Displays a toggle in the header to play crackling fire audio</p>
            </div>
            <Switch checked={settings.ambientSoundEnabled} onCheckedChange={(checked) => updateSettings({ ambientSoundEnabled: checked })} />
          </div>
        </CardContent>
      </Card>

      {/* Motivational Quotes */}
      <Card className="shadow-sm">
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <Quote className="h-5 w-5 text-primary" /> Motivational Quotes
          </CardTitle>
        </CardHeader>
        <CardContent className="space-y-4">
          <div className="flex items-center justify-between">
            <Label>Show quotes on dashboard</Label>
            <Switch checked={settings.quotesEnabled} onCheckedChange={(checked) => updateSettings({ quotesEnabled: checked })} />
          </div>
          {settings.quotesEnabled && (
            <div>
              <Label className="text-sm text-muted-foreground uppercase tracking-wider font-medium">
                Custom Quotes (one per line, leave empty for defaults)
              </Label>
              <Textarea className="mt-1 h-32 font-mono text-xs" placeholder="Enter your own quotes, one per line..." value={quotesDraft} onChange={e => updateQuotes(e.target.value)} />
            </div>
          )}
        </CardContent>
      </Card>

      <DataCard />
    </div>
  );
}
