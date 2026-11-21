import { useMemo } from 'react';
import { Lock } from 'lucide-react';
import { getAllAchievements, TIER_COLORS } from '@/lib/achievements';
import { useStore } from '@/hooks/useStore';
import { stores } from '@/lib/storage';

/** Every badge: earned ones in color with the date, the rest locked with how to get them. */
export function BadgeShelf() {
  const unlocked = useStore(stores.ACHIEVEMENTS);
  const badges = useMemo(() => {
    const at = new Map(unlocked.map(u => [u.id, u.unlockedAt]));
    return getAllAchievements()
      .map(a => ({ ...a, unlockedAt: at.get(a.id) }))
      .sort((a, b) => Number(!a.unlockedAt) - Number(!b.unlockedAt));
  }, [unlocked]);
  const count = badges.filter(b => b.unlockedAt).length;

  return (
    <section className="space-y-2">
      <div className="flex items-baseline justify-between">
        <h2 className="text-base font-semibold">Badges</h2>
        <span className="text-xs text-muted-foreground">{count} of {badges.length} earned</span>
      </div>
      <div className="grid grid-cols-2 gap-2 sm:grid-cols-3">
        {badges.map(b => (
          <div key={b.id} className={`rounded-xl border bg-card p-3 shadow-sm ${b.unlockedAt ? '' : 'opacity-60'}`}>
            <div className="flex items-center gap-2">
              <span className="text-2xl" aria-hidden>{b.unlockedAt ? b.icon : '🔒'}</span>
              <span className="h-2 w-2 rounded-full" style={{ backgroundColor: TIER_COLORS[b.tier] }} title={b.tier} />
            </div>
            <p className="mt-1 text-sm font-semibold leading-tight">{b.title}</p>
            <p className="mt-0.5 text-xs text-muted-foreground">{b.description}</p>
            <p className="mt-1 flex items-center gap-1 text-[11px] text-muted-foreground">
              {b.unlockedAt ? `Earned ${new Date(b.unlockedAt).toLocaleDateString(undefined, { month: 'short', day: 'numeric', year: 'numeric' })}` : <><Lock className="h-3 w-3" /> Locked</>}
            </p>
          </div>
        ))}
      </div>
    </section>
  );
}
