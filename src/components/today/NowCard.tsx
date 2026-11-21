import { ArrowRight, Check, Dumbbell, Flame, HandHeart, MessageCircle, PartyPopper, SkipForward } from 'lucide-react';
import type { UpNextItem } from './UpNext';

/** Vivid gradient that follows the time of day. */
function gradientFor(hour: number): string {
  if (hour >= 5 && hour < 11) return 'linear-gradient(135deg, hsl(24 100% 58%) 0%, hsl(350 92% 60%) 100%)'; // sunrise
  if (hour >= 11 && hour < 17) return 'linear-gradient(135deg, hsl(236 92% 62%) 0%, hsl(276 86% 60%) 100%)'; // daytime
  if (hour >= 17 && hour < 22) return 'linear-gradient(135deg, hsl(262 80% 52%) 0%, hsl(322 84% 56%) 100%)'; // evening
  return 'linear-gradient(135deg, hsl(234 62% 32%) 0%, hsl(262 60% 44%) 100%)'; // night
}

function kindLabel(item: UpNextItem): string {
  switch (item.kind) {
    case 'workout': return item.resume ? 'Finish your workout' : 'Training';
    case 'todo': return item.days !== null && item.days < 0 ? `To-do · ${-item.days}d late` : 'To-do';
    case 'commitment': return 'Promise';
    case 'person': return 'Reach out';
    case 'habit': return item.streak > 0 ? `Habit · ${item.streak}-day streak` : 'Habit';
  }
}

function KindIcon({ item }: { item: UpNextItem }) {
  const cls = 'h-3.5 w-3.5';
  switch (item.kind) {
    case 'workout': return <Dumbbell className={cls} />;
    case 'commitment': return <HandHeart className={cls} />;
    case 'person': return <MessageCircle className={cls} />;
    case 'habit': return <Flame className={cls} />;
    default: return <Check className={cls} />;
  }
}

function actionLabel(item: UpNextItem): string {
  switch (item.kind) {
    case 'workout': return item.resume ? 'Resume workout' : 'Start workout';
    case 'person': return 'Log it';
    default: return 'Mark done';
  }
}

/**
 * The centerpiece of Today: the single next thing to do, big and bold, with one
 * button. Below it, how much of today is done.
 */
export function NowCard({ item, done, total, onSkip, quote }: {
  item: UpNextItem | null;
  done: number;
  total: number;
  onSkip?: () => void;
  quote?: string;
}) {
  const pct = total === 0 ? 100 : Math.round((done / total) * 100);
  const act = () => {
    if (!item) return;
    if (item.kind === 'workout') item.onStart();
    else item.onToggle();
  };

  return (
    <section
      aria-label="Now"
      className="relative overflow-hidden rounded-[28px] p-6 text-white shadow-[0_12px_40px_-12px_rgb(80_60_220/0.55)]"
      style={{ background: gradientFor(new Date().getHours()) }}
    >
      {/* soft light blobs for depth */}
      <div aria-hidden className="pointer-events-none absolute -right-16 -top-20 h-56 w-56 rounded-full bg-white/15 blur-2xl" />
      <div aria-hidden className="pointer-events-none absolute -bottom-24 -left-10 h-48 w-48 rounded-full bg-black/10 blur-2xl" />

      <div className="relative">
        {item ? (
          <>
            <p className="flex items-center gap-1.5 text-footnote font-semibold uppercase tracking-wider text-white/80">
              <KindIcon item={item} /> {kindLabel(item)}
            </p>
            <h2 className="mt-2 text-[28px] font-bold leading-[1.15] tracking-tight">{item.title}</h2>
            {item.subtitle && <p className="mt-1 line-clamp-1 text-body text-white/80">{item.subtitle}</p>}

            <div className="mt-6 flex items-center gap-3">
              <button
                type="button"
                onClick={act}
                className="pressable flex h-12 flex-1 items-center justify-center gap-2 rounded-2xl bg-white text-headline text-neutral-900 shadow-sm"
              >
                {actionLabel(item)} <ArrowRight className="h-4 w-4" />
              </button>
              {onSkip && (
                <button
                  type="button"
                  onClick={onSkip}
                  aria-label="Skip for now"
                  className="pressable flex h-12 w-12 items-center justify-center rounded-2xl bg-white/20 backdrop-blur-sm"
                >
                  <SkipForward className="h-5 w-5" />
                </button>
              )}
            </div>
          </>
        ) : (
          <div className="py-2">
            <PartyPopper className="h-9 w-9" />
            <h2 className="mt-3 text-[28px] font-bold leading-tight tracking-tight">{total ? 'All done for today.' : 'A clear day.'}</h2>
            <p className="mt-1 text-body text-white/85">{quote ?? (total ? 'Rest up — you earned it.' : 'Add a goal or a to-do with the + button.')}</p>
          </div>
        )}

        {total > 0 && (
          <div className="mt-6">
            <div className="mb-1.5 flex items-baseline justify-between text-footnote font-semibold text-white/85">
              <span>{done} of {total} done today</span>
              <span className="tabular-nums">{pct}%</span>
            </div>
            <div className="h-2.5 overflow-hidden rounded-full bg-white/25">
              <div className="h-full rounded-full bg-white transition-[width] duration-700 ease-out" style={{ width: `${pct}%` }} />
            </div>
          </div>
        )}
      </div>
    </section>
  );
}
