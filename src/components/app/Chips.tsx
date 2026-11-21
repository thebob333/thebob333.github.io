import { cn } from '@/lib/utils';

/** Single-select pill buttons (radio group). */
export function Chips<T extends string | number>({ options, value, onChange, label }: {
  options: { value: T; label: string; hint?: string }[];
  value: T;
  onChange: (v: T) => void;
  label: string;
}) {
  return (
    <div role="radiogroup" aria-label={label} className="flex flex-wrap gap-2">
      {options.map(o => (
        <button
          key={String(o.value)}
          type="button"
          role="radio"
          aria-checked={value === o.value}
          onClick={() => onChange(o.value)}
          title={o.hint}
          className={cn(
            'pressable h-9 rounded-full px-3.5 text-footnote font-semibold transition-colors',
            value === o.value ? 'bg-primary text-primary-foreground' : 'bg-secondary text-foreground',
          )}
        >
          {o.label}
        </button>
      ))}
    </div>
  );
}

export function FieldLabel({ children }: { children: React.ReactNode }) {
  return <p className="mb-2 text-footnote font-semibold text-muted-foreground">{children}</p>;
}
