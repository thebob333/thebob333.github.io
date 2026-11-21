import { useMemo, useState } from 'react';
import { getAllAchievements, TIER_COLORS } from '@/lib/achievements';
import { useStore } from '@/hooks/useStore';
import { stores } from '@/lib/storage';

/** Every badge: earned ones in color with the date, the rest locked with how to get them. */
export function BadgeShelf() {
  const unlocked = useStore(stores.ACHIEVEMENTS);
  const [showLocked, setShowLocked] = useState(false);
  const badges = useMemo(() => {
    const at = new Map(unlocked.map(u => [u.id, u.unlockedAt]));
    return getAllAchievements().map(a => ({ ...a, unlockedAt: at.get(a.id) }));
  }, [unlocked]);
  const earned = badges.filter(b => b.unlockedAt);
  const locked = badges.filter(b => !b.unlockedAt);
  const shown = showLocked ? [...earned, ...locked] : earned;

  return (
    <section className="space-y-2">
      <div className="flex items-baseline justify-between">
        <h2 className="section-label">Badges</h2>
        <span className="pr-1 text-footnote text-muted-foreground">{earned.length} of {badges.length}</span>
      </div>
      {earned.length === 0 && !showLocked && (
        <p className="px-1 text-footnote text-muted-foreground">Your first badge comes with your first logged workout.</p>
      )}
      {shown.length > 0 && (
        <div className="grid grid-cols-3 gap-2">
          {shown.map(b => (
            <div key={b.id} className={`surface flex flex-col items-center px-2 py-3 text-center ${b.unlockedAt ? '' : 'opacity-55'}`}>
              <span className="relative text-[30px] leading-none" aria-hidden>
                {b.unlockedAt ? b.icon : '🔒'}
                {b.unlockedAt && <span className="absolute -right-1 -top-0.5 h-2.5 w-2.5 rounded-full ring-2 ring-card" style={{ backgroundColor: TIER_COLORS[b.tier] }} />}
              </span>
              <p className="mt-2 text-footnote font-semibold leading-tight">{b.title}</p>
              <p className="mt-0.5 text-[11px] leading-snug text-muted-foreground">
                {b.unlockedAt ? new Date(b.unlockedAt).toLocaleDateString(undefined, { month: 'short', day: 'numeric' }) : b.description}
              </p>
            </div>
          ))}
        </div>
      )}
      {locked.length > 0 && (
        <button type="button" onClick={() => setShowLocked(v => !v)} className="w-full py-2 text-body font-semibold text-primary">
          {showLocked ? 'Hide locked badges' : `See ${locked.length} more to earn`}
        </button>
      )}
    </section>
  );
}
