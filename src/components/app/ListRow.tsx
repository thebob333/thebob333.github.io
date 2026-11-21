import type { ReactNode } from 'react';
import { Check, ChevronRight } from 'lucide-react';
import { cn } from '@/lib/utils';

/** The row used inside every `.list-group`: leading visual, title/subtitle, trailing accessory. */
export function ListRow({
  leading, title, subtitle, trailing, onClick, chevron = false, muted = false, className, ariaLabel,
}: {
  leading?: ReactNode;
  title: ReactNode;
  subtitle?: ReactNode;
  trailing?: ReactNode;
  onClick?: () => void;
  chevron?: boolean;
  muted?: boolean;
  className?: string;
  ariaLabel?: string;
}) {
  const body = (
    <>
      {leading && <span className="flex shrink-0 items-center">{leading}</span>}
      <span className="min-w-0 flex-1 py-0.5">
        <span className={cn('block truncate text-[16px] font-semibold leading-snug tracking-[-0.01em]', muted && 'font-medium text-muted-foreground line-through decoration-muted-foreground/50')}>{title}</span>
        {subtitle && <span className="block truncate text-footnote text-muted-foreground">{subtitle}</span>}
      </span>
      {trailing && <span className="flex shrink-0 items-center gap-2">{trailing}</span>}
      {chevron && <ChevronRight className="h-4 w-4 shrink-0 text-muted-foreground/60" />}
    </>
  );
  const cls = cn('flex min-h-[62px] w-full items-center gap-3.5 px-4 py-2.5 text-left', onClick && 'cursor-pointer transition-colors active:bg-accent/70 focus-visible:outline-none focus-visible:bg-accent/70', className);
  // A div with button behavior (not a <button>), because rows can hold their own
  // buttons (a check circle, a ⋯ menu) and buttons can't be nested.
  return onClick
    ? (
      <div
        role="button"
        tabIndex={0}
        aria-label={ariaLabel}
        onClick={onClick}
        onKeyDown={e => {
          if (e.target !== e.currentTarget) return;
          if (e.key === 'Enter' || e.key === ' ') { e.preventDefault(); onClick(); }
        }}
        className={cls}
      >
        {body}
      </div>
    )
    : <div className={cls}>{body}</div>;
}

/** A round check in a life-area color. */
export function CheckCircle({ done, color, onToggle, label }: { done: boolean; color: string; onToggle: () => void; label: string }) {
  return (
    <button
      type="button"
      role="checkbox"
      aria-checked={done}
      aria-label={label}
      onClick={e => { e.stopPropagation(); onToggle(); }}
      className="-m-2 flex h-11 w-11 items-center justify-center rounded-full"
    >
      <span
        className="flex h-[28px] w-[28px] items-center justify-center rounded-full border-[2.5px] transition-all duration-200"
        style={done ? { backgroundColor: color, borderColor: color } : { borderColor: `color-mix(in srgb, ${color} 55%, transparent)` }}
      >
        {done && <Check className="h-4 w-4 text-white" strokeWidth={3.5} />}
      </span>
    </button>
  );
}

/** A tinted round icon (e.g. a dumbbell in green). */
export function IconBadge({ children, color }: { children: ReactNode; color: string }) {
  return (
    <span className="flex h-[30px] w-[30px] items-center justify-center rounded-full" style={{ backgroundColor: `color-mix(in srgb, ${color} 14%, transparent)`, color }}>
      {children}
    </span>
  );
}
