import { useState } from 'react';
import { Award, ChevronRight, Gem, Medal as MedalIcon, Trophy } from 'lucide-react';
import { Dialog, DialogContent, DialogDescription, DialogHeader, DialogTitle } from '@/components/app/ResponsiveDialog';
import { AREAS } from '@/lib/arete/tree';
import { monthName, type Badge, type Medal, type Profile } from '@/lib/arete/progress';
import { rarityOf } from '@/lib/arete/engine';
import { parseDateKey } from '@/lib/dates';
import { cn } from '@/lib/utils';
import { Radar } from './Radar';

const MEDAL_STYLE: Record<Medal, { label: string; color: string; bg: string }> = {
  bronze: { label: 'Bronze', color: '#c98b55', bg: 'rgba(201,139,85,0.16)' },
  silver: { label: 'Silver', color: '#aeb8c8', bg: 'rgba(174,184,200,0.18)' },
  gold: { label: 'Gold', color: '#f0b03c', bg: 'rgba(240,176,60,0.16)' },
  diamond: { label: 'Diamond', color: '#7fd9f0', bg: 'rgba(127,217,240,0.16)' },
};
const day = (k: string) => parseDateKey(k).toLocaleDateString(undefined, { month: 'short', day: 'numeric' });

export function MedalBadge({ badge, onClick }: { badge: Badge; onClick?: () => void }) {
  const m = badge.medal ? MEDAL_STYLE[badge.medal] : null;
  const Icon = badge.medal === 'diamond' ? Gem : badge.medal === 'gold' ? Trophy : badge.medal ? MedalIcon : Award;
  const pct = Math.min(100, Math.round((badge.progress / Math.max(1, badge.target)) * 100));
  const hue = badge.area ? AREAS.find(a => a.id === badge.area)!.hue : null;
  return (
    <button type="button" onClick={onClick} disabled={!onClick} className="pressable flex w-full items-center gap-3 px-4 py-3 text-left disabled:cursor-default">
      <span className="flex h-10 w-10 shrink-0 items-center justify-center rounded-full" style={{ background: m?.bg ?? 'hsl(var(--secondary))', color: m?.color ?? 'hsl(var(--muted-foreground))' }}>
        <Icon className="h-5 w-5" />
      </span>
      <span className="min-w-0 flex-1">
        <span className="flex items-center gap-1.5">
          {hue && <span className="h-2 w-2 shrink-0 rounded-full" style={{ background: `hsl(${hue})` }} />}
          <span className="truncate text-body font-semibold">{badge.name}</span>
          {m && <span className="shrink-0 text-[11px] font-bold" style={{ color: m.color }}>{m.label}</span>}
        </span>
        <span className="mt-1 flex items-center gap-2">
          <span className="h-1.5 flex-1 overflow-hidden rounded-full bg-secondary"><span className="block h-full rounded-full bg-primary" style={{ width: `${pct}%` }} /></span>
          <span className="shrink-0 text-[11px] tabular-nums text-muted-foreground">{badge.progress}/{badge.target}</span>
        </span>
        <span className="block truncate text-footnote text-muted-foreground">{badge.medal === 'diamond' || (badge.progress >= badge.target && badge.medal) ? `Won ${badge.at ? day(badge.at) : ''}` : `Next: ${badge.detail}`}</span>
      </span>
      {onClick && <ChevronRight className="h-4 w-4 shrink-0 text-muted-foreground" />}
    </button>
  );
}

/**
 * Your character sheet: class, the six areas as a radar, where your XP came
 * from, medals, personal bests and everything you've claimed.
 */
export function CharacterSheet({ open, profile, onClose, onOpenStation }: {
  open: boolean;
  profile: Profile;
  onClose: () => void;
  onOpenStation: (id: string) => void;
}) {
  const [tab, setTab] = useState<'medals' | 'bests' | 'timeline'>('medals');
  const { summary, character, xp, badges, bests, timeline } = profile;
  const won = badges.filter(b => b.medal).sort((a, b) => (b.at ?? '').localeCompare(a.at ?? ''));
  const next = badges.filter(b => b.medal !== 'diamond' && b.progress < b.target).sort((a, b) => b.progress / b.target - a.progress / a.target).slice(0, 6);
  const go = (id: string) => { onClose(); onOpenStation(id); };
  const tabBtn = (id: typeof tab, label: string) => (
    <button type="button" aria-pressed={tab === id} onClick={() => setTab(id)}
      className={cn('h-9 flex-1 rounded-full text-footnote font-semibold', tab === id ? 'bg-card shadow-sm' : 'text-muted-foreground')}>{label}</button>
  );

  return (
    <Dialog open={open} onOpenChange={o => !o && onClose()}>
      <DialogContent className="max-w-lg">
        <DialogHeader>
          <DialogTitle className="text-title">{character.title}</DialogTitle>
          <DialogDescription>Level {summary.level} · {summary.xp.toLocaleString()} XP · {summary.claimed.toLocaleString()} of {summary.total.toLocaleString()} stations</DialogDescription>
        </DialogHeader>
        <div className="-mx-1 max-h-[70vh] space-y-4 overflow-y-auto px-1 pb-1">
          <div className="flex flex-col items-center">
            <Radar radar={character.radar} size={260} />
            <p className="mt-1 text-center text-footnote text-muted-foreground">{character.why}</p>
          </div>

          <div className="grid grid-cols-4 gap-2 text-center">
            {([['Stations', xp.stations], ['Season', xp.season], ['Quests', xp.quests], ['Medals', xp.badges]] as const).map(([l, v]) => (
              <div key={l} className="rounded-xl bg-secondary/70 px-1 py-2">
                <p className="text-body font-bold tabular-nums">{v.toLocaleString()}</p>
                <p className="text-[11px] text-muted-foreground">{l} XP</p>
              </div>
            ))}
          </div>

          <div className="flex gap-1 rounded-full bg-secondary p-1">
            {tabBtn('medals', `Medals · ${won.length}`)}
            {tabBtn('bests', `Bests · ${bests.length}`)}
            {tabBtn('timeline', 'Timeline')}
          </div>

          {tab === 'medals' && (
            <div className="space-y-3">
              {next.length > 0 && (
                <div>
                  <p className="mb-1.5 text-footnote font-semibold text-muted-foreground">Closest next</p>
                  <div className="list-group">{next.map(b => <MedalBadge key={b.id} badge={b} />)}</div>
                </div>
              )}
              {won.length > 0 ? (
                <div>
                  <p className="mb-1.5 text-footnote font-semibold text-muted-foreground">Won</p>
                  <div className="list-group">{won.map(b => <MedalBadge key={b.id} badge={b} />)}</div>
                </div>
              ) : <p className="text-footnote text-muted-foreground">Medals come from finishing parts of lines, exploring disciplines and areas, rare stations, interchanges and seasons.</p>}
            </div>
          )}

          {tab === 'bests' && (bests.length ? (
            <div className="list-group">
              {bests.map(b => (
                <button key={b.ladder} type="button" onClick={() => go(b.node.id)} className="flex w-full items-center gap-3 px-4 py-3 text-left">
                  <span className="h-8 w-1.5 shrink-0 rounded-full" style={{ background: `hsl(${AREAS.find(a => a.id === b.area)!.hue})` }} />
                  <span className="min-w-0 flex-1">
                    <span className="block text-footnote font-semibold text-muted-foreground">{b.name}</span>
                    <span className="block truncate text-body font-semibold">{b.result ?? b.node.short ?? b.node.title}</span>
                  </span>
                  <span className="shrink-0 text-right text-[11px] text-muted-foreground">{rarityOf(b.node.tier).name}<br />{day(b.at)}</span>
                </button>
              ))}
            </div>
          ) : <p className="text-footnote text-muted-foreground">Your best on every line you've started shows up here.</p>)}

          {tab === 'timeline' && (timeline.length ? (
            <div className="space-y-3">
              {timeline.map(m => (
                <div key={m.month}>
                  <p className="mb-1.5 text-footnote font-semibold text-muted-foreground">{monthName(m.month)} · {m.items.length}</p>
                  <div className="list-group">
                    {m.items.map(it => (
                      <button key={it.node.id} type="button" onClick={() => go(it.node.id)} className="flex w-full items-center gap-3 px-4 py-2.5 text-left">
                        <span className="w-12 shrink-0 text-[11px] tabular-nums text-muted-foreground">{day(it.at)}</span>
                        <span className="min-w-0 flex-1 truncate text-body">{it.node.title}{it.result ? <span className="text-muted-foreground"> · {it.result}</span> : null}</span>
                        <span className="h-2 w-2 shrink-0 rounded-full" style={{ background: `hsl(${AREAS.find(a => a.id === it.node.area)!.hue})` }} />
                      </button>
                    ))}
                  </div>
                </div>
              ))}
            </div>
          ) : <p className="text-footnote text-muted-foreground">Everything you claim yourself lands here, month by month.</p>)}
        </div>
      </DialogContent>
    </Dialog>
  );
}
