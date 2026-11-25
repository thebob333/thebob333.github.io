import { useEffect, useMemo, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { Check, ChevronRight, Loader2, Lock, Pin, PinOff, Plus, Sparkles, Target, Telescope, Trash2, X } from 'lucide-react';
import { Dialog, DialogContent, DialogDescription, DialogHeader, DialogTitle } from '@/components/app/ResponsiveDialog';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { PasteFallback } from '@/components/ai/PasteFallback';
import { areteActions, areteBodyweight, useArete } from '@/hooks/useArete';
import { useStore } from '@/hooks/useStore';
import { stores } from '@/lib/storage';
import { todayKey, parseDateKey } from '@/lib/dates';
import { calculateGoalProgress } from '@/types/goals';
import { AREAS, LADDER_BY_ID } from '@/lib/arete/tree';
import { stationFacts } from '@/lib/arete/progress';
import { ancestorsOf, customNode, discoveredToNodes, ladderHits, rarityOf, statusOf, xpFor, RARITY } from '@/lib/arete/engine';
import { useAiKey } from '@/lib/ai/device';
import { askJSON, AiError } from '@/lib/ai/client';
import { AreteDiscovery, parsePasted, schemaText } from '@/lib/ai/schemas';
import { ARETE_DISCOVER_TASK, ARETE_SYSTEM, pastePrompt } from '@/lib/ai/prompts';
import type { AreteNode } from '@/types/arete';
import { cn } from '@/lib/utils';

type Mode = 'view' | 'claim' | 'discover' | 'custom';
const day = (k: string) => parseDateKey(k).toLocaleDateString(undefined, { month: 'short', day: 'numeric', year: 'numeric' });
const pill = 'pressable flex h-11 items-center justify-center gap-1.5 rounded-xl bg-secondary px-3 text-footnote font-semibold';

/** Remove a discovered node and anything in the same batch that was built on it. */
function dropWithChain(list: AreteNode[], id: string): AreteNode[] {
  const gone = new Set([id]);
  for (let grew = true; grew;) {
    grew = false;
    for (const x of list) if (!gone.has(x.id) && gone.has(x.requires[0])) { gone.add(x.id); grew = true; }
  }
  return list.filter(x => !gone.has(x.id));
}

/** One node of the tree: what it takes, claim it, chase it, or grow the tree beyond it. */
export function NodeSheet({ nodeId, onClose, onSelect, onGoFor, onUnlocked }: {
  nodeId: string | null;
  onClose: () => void;
  /** Jump to another node (and fly the map there). */
  onSelect: (id: string) => void;
  /** "Go for this": open Day Zero for the node. */
  onGoFor: (node: AreteNode) => void;
  onUnlocked: (ids: string[]) => void;
}) {
  const navigate = useNavigate();
  const { state, graph, vis } = useArete();
  const goals = useStore(stores.GOALS);
  const hasKey = !!useAiKey();
  const [mode, setMode] = useState<Mode>('view');
  const [result, setResult] = useState('');
  const [date, setDate] = useState(todayKey());
  const [found, setFound] = useState<AreteNode[] | null>(null);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [custom, setCustom] = useState({ title: '', detail: '', tier: 0 });

  const node = nodeId ? graph.byId.get(nodeId) : undefined;
  useEffect(() => {
    setMode('view'); setResult(''); setDate(todayKey()); setFound(null); setError(null); setBusy(false);
    setCustom({ title: '', detail: '', tier: node?.tier ?? 0 });
    // Reset whenever a different node opens.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [nodeId]);

  const info = node?.ladder ? LADDER_BY_ID.get(node.ladder) : undefined;
  const facts = useMemo(() => (node ? stationFacts(graph, state, node) : null), [graph, state, node]);
  const hits = useMemo(() => (node && result.trim() ? ladderHits(graph, node, result, areteBodyweight()) : null), [graph, node, result]);
  if (!node) return null;

  const status = statusOf(node, state);
  const claim = state.claims[node.id];
  const rarity = rarityOf(node.tier);
  const area = AREAS.find(a => a.id === node.area)!;
  const pinned = state.pinned.includes(node.id);
  const unmet = node.requires.filter(r => !state.claims[r]).map(r => graph.byId.get(r)!);
  const stepsBefore = ancestorsOf(graph, node.id).filter(a => !state.claims[a]).length;
  const beyond = (graph.dependents.get(node.id) ?? []).map(id => graph.byId.get(id)!);
  const beyondSeen = beyond.filter(n => vis.get(n.id) !== 'fog');
  const goal = goals.find(g => g.id === state.goalLinks[node.id]);
  const goalDone = goal && (goal.status === 'achieved' || calculateGoalProgress(goal) === 100);

  const doClaim = () => {
    const text = result.trim();
    let ids: string[];
    if (info && text) {
      if (!hits) { setError(info.kind === 'time' ? 'Type a time like 7:42.' : 'Type a number.'); return; }
      if (!hits.top) { setError("That doesn't reach the first rung of this ladder yet."); return; }
      ids = areteActions.claimLadder(info.id, text, date);
      if (hits.top.id !== node.id) onSelect(hits.top.id); // show how far you got
    } else {
      ids = areteActions.claim(node.id, date, text || undefined);
    }
    onUnlocked(ids);
    setMode('view'); setResult(''); setError(null);
  };

  const context = () => {
    const path = ancestorsOf(graph, node.id).map(a => graph.byId.get(a)!).sort((a, b) => a.tier - b.tier).map(a => a.title);
    return [
      `Area: ${area.name} (${area.blurb}). Discipline: ${node.branch}.`,
      `The node: "${node.title}"${node.detail ? ` — ${node.detail}` : ''} (difficulty ${node.tier}/10).`,
      path.length ? `What comes before it, easiest first: ${path.join(' → ')}.` : 'It is a starting point of its discipline.',
      beyond.length ? `Already beyond it (do not repeat): ${beyond.map(b => b.title).join('; ')}.` : 'Nothing lies beyond it yet.',
    ].join('\n');
  };
  const accept = (reply: AreteDiscovery) => {
    const nodes = discoveredToNodes(graph, node, reply.nodes, () => crypto.randomUUID());
    if (!nodes.length) throw new Error('Nothing new came back. Try again.');
    setFound(nodes);
  };
  const discover = async () => {
    setMode('discover'); setError(null); setFound(null);
    if (!hasKey) return;
    setBusy(true);
    try {
      accept(await askJSON({ system: ARETE_SYSTEM, messages: [{ role: 'user', content: `${context()}\n\n${ARETE_DISCOVER_TASK}` }], schema: AreteDiscovery, effort: 'medium', maxTokens: 6000 }));
    } catch (e) {
      setError(e instanceof AiError || e instanceof Error ? e.message : 'Something went wrong. Try again.');
    } finally { setBusy(false); }
  };
  const addFound = () => {
    if (!found?.length) return;
    areteActions.grow(found);
    setMode('view'); setFound(null);
    onSelect(found[0].id);
  };
  const addCustom = () => {
    if (!custom.title.trim()) return;
    const n = customNode(node, custom.title, custom.detail, custom.tier, () => crypto.randomUUID());
    areteActions.grow([n]);
    setMode('view');
    onSelect(n.id);
  };

  return (
    <Dialog open onOpenChange={o => { if (!o && !busy) onClose(); }}>
      <DialogContent className="max-w-md">
        <DialogHeader>
          <div className="mb-1 flex flex-wrap items-center gap-1.5 text-[11px] font-semibold">
            <span className="rounded-full px-2 py-0.5 text-white" style={{ background: rarity.ring }}>{rarity.name}</span>
            <span className="rounded-full bg-secondary px-2 py-0.5 tabular-nums">+{xpFor(node.tier)} XP</span>
            <span className="rounded-full px-2 py-0.5" style={{ color: `hsl(${area.hue})`, background: `hsl(${area.hue} / 0.12)` }}>{area.name} · {node.branch}</span>
            {node.source !== 'core' && <span className="rounded-full bg-secondary px-2 py-0.5 text-muted-foreground">{node.source === 'ai' ? 'Discovered' : 'Yours'}</span>}
          </div>
          <DialogTitle className="text-title">{node.title}</DialogTitle>
          {node.detail && <DialogDescription>{node.detail}</DialogDescription>}
        </DialogHeader>

        <div className="-mx-1 max-h-[62vh] space-y-4 overflow-y-auto px-1 pb-1">
          {error && <p className="rounded-xl bg-destructive/10 px-3 py-2 text-footnote text-destructive">{error}</p>}

          {mode === 'view' && (
            <>
              {/* Where it stands */}
              {status === 'claimed' ? (
                <div className="flex items-start gap-2.5 rounded-2xl bg-success/10 p-3">
                  <Check className="mt-0.5 h-4 w-4 shrink-0 text-success" strokeWidth={3} />
                  <div className="min-w-0 flex-1">
                    <p className="text-body font-semibold text-success">Unlocked{claim.result ? ` · ${claim.result}` : ''}</p>
                    <p className="text-footnote text-muted-foreground">{claim.implied ? 'Counted because you did something beyond it.' : day(claim.at)}</p>
                  </div>
                  {claim.implied && <button type="button" className="h-8 shrink-0 rounded-full bg-card px-3 text-footnote font-semibold" onClick={() => setMode('claim')}>Add my result</button>}
                </div>
              ) : status === 'open' ? (
                <p className="rounded-2xl bg-primary/10 p-3 text-footnote"><b className="text-primary">Within reach.</b> Nothing stands between you and this one.</p>
              ) : (
                <div className="rounded-2xl bg-secondary/70 p-3">
                  <p className="flex items-center gap-1.5 text-footnote font-semibold text-muted-foreground"><Lock className="h-3.5 w-3.5" /> Comes after</p>
                  {unmet.map(r => (
                    <button key={r.id} type="button" onClick={() => onSelect(r.id)} className="mt-1 flex w-full items-center gap-2 text-left text-body font-medium">
                      <span className="min-w-0 flex-1 truncate">{r.title}</span><ChevronRight className="h-4 w-4 shrink-0 text-muted-foreground" />
                    </button>
                  ))}
                  {stepsBefore > unmet.length && <p className="mt-1 text-footnote text-muted-foreground">{stepsBefore} steps away in all. Already done it? Claim it and they all unlock.</p>}
                </div>
              )}

              {goal && (
                <button type="button" onClick={() => navigate(`/goals/${goal.id}`)} className="pressable surface flex w-full items-center gap-3 p-3 text-left">
                  <Target className="h-5 w-5 shrink-0 text-primary" />
                  <span className="min-w-0 flex-1">
                    <span className="block truncate text-body font-semibold">{goal.title}</span>
                    <span className="block text-footnote text-muted-foreground">{goalDone ? (status === 'claimed' ? 'Goal finished' : 'Goal finished — claim your node') : `Your goal for this · ${calculateGoalProgress(goal)}% done`}</span>
                  </span>
                  <ChevronRight className="h-4 w-4 shrink-0 text-muted-foreground" />
                </button>
              )}

              {status !== 'claimed' && (
                <div className="space-y-2">
                  <Button className="h-12 w-full rounded-xl text-body font-semibold" onClick={() => setMode('claim')}><Check className="mr-2 h-4 w-4" strokeWidth={3} /> I did this</Button>
                  <div className="grid grid-cols-2 gap-2">
                    <button type="button" className={pill} onClick={() => areteActions.togglePin(node.id)}>
                      {pinned ? <><PinOff className="h-4 w-4" /> Stop chasing</> : <><Pin className="h-4 w-4" /> Chase this</>}
                    </button>
                    {!goal && <button type="button" className={pill} onClick={() => onGoFor(node)}><Sparkles className="h-4 w-4 text-primary" /> Go for this</button>}
                  </div>
                  {!goal && <p className="text-footnote text-muted-foreground">"Go for this" has Day Zero plan it as a goal. "Chase this" just marks it on your map.</p>}
                </div>
              )}

              {/* About this station */}
              <div className="space-y-2.5 rounded-2xl bg-secondary/50 p-3">
                <div className="grid grid-cols-2 gap-3">
                  <div><p className="text-[11px] font-semibold uppercase tracking-wide text-muted-foreground">How rare</p><p className="text-footnote font-medium">{facts.rarity}</p></div>
                  <div><p className="text-[11px] font-semibold uppercase tracking-wide text-muted-foreground">From scratch</p><p className="text-footnote font-medium">{facts.time}</p></div>
                </div>
                {facts.line && (
                  <p className="text-footnote">
                    <span className="text-muted-foreground">{facts.line.name} line:</span> stop {facts.line.index} of {facts.line.length}
                    {facts.line.best ? <> · <span className="text-muted-foreground">your best</span> <b>{facts.line.best.result ?? facts.line.best.title}</b></> : ''}
                  </p>
                )}
                {facts.interchange.length > 0 && (
                  <div>
                    <p className="text-footnote"><b>Interchange.</b> <span className="text-muted-foreground">It also needs progress on other lines:</span></p>
                    {facts.interchange.map(r => (
                      <button key={r.id} type="button" onClick={() => onSelect(r.id)} className="mt-1 flex w-full items-center gap-2 text-left text-footnote">
                        <span className={cn('flex h-4 w-4 shrink-0 items-center justify-center rounded-full', state.claims[r.id] ? 'bg-success text-white' : 'border border-muted-foreground/50')}>{state.claims[r.id] && <Check className="h-3 w-3" strokeWidth={3} />}</span>
                        <span className="min-w-0 flex-1 truncate">{r.title}</span>
                        <span className="shrink-0 text-[11px] text-muted-foreground">{AREAS.find(a => a.id === r.area)!.name} · {r.branch}</span>
                      </button>
                    ))}
                  </div>
                )}
                {facts.guide && (
                  <div className="space-y-1 text-footnote">
                    <p><span className="font-semibold">How people get there:</span> {facts.guide.how}</p>
                    <p><span className="font-semibold">What usually stops them:</span> {facts.guide.stops}</p>
                  </div>
                )}
                {facts.feeds.length > 0 && (
                  <div>
                    <p className="text-footnote text-muted-foreground">Counts toward {facts.feeds.length === 1 ? 'an interchange' : `${facts.feeds.length} interchanges`}:</p>
                    {facts.feeds.slice(0, 4).map(f => (
                      <button key={f.id} type="button" onClick={() => onSelect(f.id)} className="mt-1 flex w-full items-center gap-2 text-left text-footnote font-medium">
                        <span className="h-2.5 w-4 shrink-0 rounded-full border-2 border-foreground/60" />
                        <span className="min-w-0 flex-1 truncate">{f.title}</span><ChevronRight className="h-3.5 w-3.5 shrink-0 text-muted-foreground" />
                      </button>
                    ))}
                  </div>
                )}
                {facts.neighbours.length > 0 && (
                  <div className="flex flex-wrap gap-1.5">
                    <span className="text-[11px] font-semibold uppercase tracking-wide text-muted-foreground">Nearby</span>
                    {facts.neighbours.map(x => (
                      <button key={x.id} type="button" onClick={() => onSelect(x.id)} className="max-w-full truncate rounded-full bg-card px-2.5 py-1 text-[12px] font-medium">{x.title}</button>
                    ))}
                  </div>
                )}
                <p className="text-[11px] text-muted-foreground">Rarity and time are rough estimates for the general population.</p>
              </div>

              {/* What lies beyond */}
              <div>
                <p className="mb-1.5 text-footnote font-semibold text-muted-foreground">Beyond this</p>
                {beyondSeen.length > 0 ? (
                  <div className="list-group">
                    {beyondSeen.slice(0, 6).map(n => (
                      <button key={n.id} type="button" onClick={() => onSelect(n.id)} className="flex w-full items-center gap-2.5 px-4 py-2.5 text-left">
                        <span className="h-2.5 w-2.5 shrink-0 rounded-full" style={{ background: state.claims[n.id] ? `hsl(${area.hue})` : 'transparent', boxShadow: `inset 0 0 0 1.5px hsl(${area.hue})` }} />
                        <span className="min-w-0 flex-1 truncate text-body">{n.title}</span>
                        <span className={cn('shrink-0 text-[11px] font-semibold', rarityOf(n.tier).tone.replace('text-white/70', 'text-muted-foreground'))}>{rarityOf(n.tier).name}</span>
                      </button>
                    ))}
                  </div>
                ) : (
                  <p className="text-footnote text-muted-foreground">{beyond.length ? `${beyond.length} more ${beyond.length === 1 ? 'node waits' : 'nodes wait'} in the fog. Unlock this to reveal ${beyond.length === 1 ? 'it' : 'them'}.` : (info?.extend ? 'This line never ends: reach this stop and the next one appears.' : 'The edge of the map. Nothing has been charted past here yet.')}</p>
                )}
                {beyond.length > beyondSeen.length && beyondSeen.length > 0 && <p className="mt-1 text-footnote text-muted-foreground">+ {beyond.length - beyondSeen.length} more in the fog</p>}
                <div className="mt-2 grid grid-cols-2 gap-2">
                  <button type="button" className={pill} onClick={discover}><Telescope className="h-4 w-4 text-primary" /> Discover more</button>
                  <button type="button" className={pill} onClick={() => setMode('custom')}><Plus className="h-4 w-4" /> Add my own</button>
                </div>
              </div>

              <div className="flex flex-wrap gap-x-4 gap-y-1">
                {status === 'claimed' && !claim.implied && (
                  <button type="button" className="text-footnote font-medium text-muted-foreground underline underline-offset-2" onClick={() => areteActions.unclaim(node.id)}>Remove my claim</button>
                )}
                {status === 'claimed' && <button type="button" className="text-footnote font-medium text-muted-foreground underline underline-offset-2" onClick={() => setMode('claim')}>Change result or date</button>}
                {node.source !== 'core' && (
                  <button type="button" className="flex items-center gap-1 text-footnote font-medium text-destructive" onClick={() => { areteActions.remove(node.id); onClose(); }}><Trash2 className="h-3.5 w-3.5" /> Delete this node</button>
                )}
              </div>
            </>
          )}

          {mode === 'claim' && (
            <form className="space-y-3" onSubmit={e => { e.preventDefault(); doClaim(); }}>
              <label className="block">
                <span className="mb-1 block text-footnote font-semibold text-muted-foreground">{info ? 'Your best (optional)' : 'Your result (optional)'}</span>
                <Input autoFocus value={result} onChange={e => { setResult(e.target.value); setError(null); }} className="h-12 rounded-xl text-body"
                  placeholder={info?.hint ? `e.g. ${info.hint}` : 'e.g. a time, a number, where it happened'} inputMode={info?.kind === 'time' ? 'text' : undefined} />
              </label>
              {info?.kind === 'bwx' && <p className="text-footnote text-muted-foreground">Type the weight in lb. It's compared with your bodyweight from Settings ({areteBodyweight()} lb).</p>}
              {info && hits && (
                <p className={cn('rounded-xl px-3 py-2 text-footnote', hits.reached ? 'bg-success/10 text-success' : 'bg-warning/10')}>
                  {!hits.top ? "That doesn't reach the first rung yet."
                    : hits.reached ? `That unlocks everything up to "${hits.top.title}".`
                      : `That reaches "${hits.top.title}" — not this one yet. Claiming will unlock up to there.`}
                </p>
              )}
              <label className="block">
                <span className="mb-1 block text-footnote font-semibold text-muted-foreground">When</span>
                <Input type="date" value={date} max={todayKey()} onChange={e => setDate(e.target.value || todayKey())} className="h-11 rounded-xl" />
              </label>
              {status === 'locked' && !(info && hits && !hits.reached) && (
                <p className="text-footnote text-muted-foreground">This also unlocks the {stepsBefore} step{stepsBefore === 1 ? '' : 's'} before it.</p>
              )}
              <div className="flex gap-2">
                <Button type="button" variant="secondary" className="h-12 rounded-xl px-4" onClick={() => { setMode('view'); setError(null); }}>Back</Button>
                <Button type="submit" className="h-12 flex-1 rounded-xl text-body font-semibold">{status === 'claimed' ? 'Save' : 'Claim it'}</Button>
              </div>
            </form>
          )}

          {mode === 'discover' && (
            <div className="space-y-3">
              {busy && (
                <div className="flex flex-col items-center py-8 text-center">
                  <Loader2 className="h-7 w-7 animate-spin text-primary" />
                  <p className="mt-3 text-body font-medium">Charting what lies beyond…</p>
                </div>
              )}
              {!busy && !found && !hasKey && (
                <PasteFallback prompt={() => pastePrompt(ARETE_DISCOVER_TASK, context(), schemaText(AreteDiscovery), ARETE_SYSTEM)}
                  onReply={text => { try { accept(parsePasted(AreteDiscovery, text)); setError(null); } catch (e) { setError((e as Error).message); } }} />
              )}
              {!busy && !found && hasKey && error && <Button className="h-11 w-full rounded-xl" onClick={discover}>Try again</Button>}
              {found && (
                <>
                  <p className="text-footnote text-muted-foreground">New territory. Remove any you don't want, then add the rest to your map for good.</p>
                  <div className="list-group">
                    {found.map(n => (
                      <div key={n.id} className="flex items-start gap-2.5 px-4 py-2.5">
                        <div className="min-w-0 flex-1">
                          <p className="text-body font-medium">{n.title}</p>
                          <p className="text-footnote text-muted-foreground">
                            <span className={cn('font-semibold', rarityOf(n.tier).tone.replace('text-white/70', 'text-muted-foreground'))}>{rarityOf(n.tier).name}</span>
                            {n.requires[0] !== node.id && <> · after "{found.find(f => f.id === n.requires[0])?.title}"</>}
                            {n.detail ? ` · ${n.detail}` : ''}
                          </p>
                        </div>
                        <button type="button" aria-label={`Remove ${n.title}`} className="-mr-2 flex h-8 w-8 shrink-0 items-center justify-center text-muted-foreground"
                          onClick={() => setFound(f => dropWithChain(f ?? [], n.id))}>
                          <X className="h-4 w-4" />
                        </button>
                      </div>
                    ))}
                  </div>
                </>
              )}
              <div className="flex gap-2">
                <Button variant="secondary" className="h-12 rounded-xl px-4" disabled={busy} onClick={() => { setMode('view'); setError(null); }}>Back</Button>
                {found && <Button className="h-12 flex-1 rounded-xl text-body font-semibold" disabled={!found.length} onClick={addFound}>Add {found.length} to my map</Button>}
              </div>
            </div>
          )}

          {mode === 'custom' && (
            <form className="space-y-3" onSubmit={e => { e.preventDefault(); addCustom(); }}>
              <Input autoFocus value={custom.title} onChange={e => setCustom(c => ({ ...c, title: e.target.value }))} placeholder="e.g. Run my hometown 10K in under 50:00" className="h-12 rounded-xl text-body" />
              <Input value={custom.detail} onChange={e => setCustom(c => ({ ...c, detail: e.target.value }))} placeholder="What counts? (optional)" className="h-11 rounded-xl" />
              <div>
                <p className="mb-2 text-footnote font-semibold text-muted-foreground">How rare is it?</p>
                <div className="flex flex-wrap gap-1.5">
                  {RARITY.filter((_, i) => (RARITY[i + 1]?.min ?? 11) - 1 >= node.tier).map(r => {
                    const tier = Math.max(node.tier, r.min);
                    const on = rarityOf(custom.tier).name === r.name;
                    return (
                      <button key={r.name} type="button" aria-pressed={on} onClick={() => setCustom(c => ({ ...c, tier }))}
                        className={cn('pressable h-9 rounded-full px-3 text-footnote font-semibold', on ? 'text-white' : 'bg-secondary')} style={on ? { background: r.ring } : undefined}>
                        {r.name}
                      </button>
                    );
                  })}
                </div>
                <p className="mt-1.5 text-footnote text-muted-foreground">It hangs off "{node.title}", so it can't be easier than that.</p>
              </div>
              <div className="flex gap-2">
                <Button type="button" variant="secondary" className="h-12 rounded-xl px-4" onClick={() => setMode('view')}>Back</Button>
                <Button type="submit" disabled={!custom.title.trim()} className="h-12 flex-1 rounded-xl text-body font-semibold">Add to my map</Button>
              </div>
            </form>
          )}
        </div>
      </DialogContent>
    </Dialog>
  );
}
