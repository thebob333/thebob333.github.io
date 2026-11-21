
interface ProgressRingProps {
  value: number; // 0-100
  size?: number;
  strokeWidth?: number;
  className?: string;
  label?: string;
  showPercent?: boolean;
}

export function ProgressRing({ value, size = 64, strokeWidth = 5, className = '', label, showPercent = true }: ProgressRingProps) {
  const radius = (size - strokeWidth) / 2;
  const circumference = 2 * Math.PI * radius;
  const offset = circumference - (Math.min(value, 100) / 100) * circumference;

  // One calm accent; turns green when complete.
  const color = value >= 100 ? 'hsl(var(--success))' : 'hsl(var(--primary))';

  return (
    <div className={`relative inline-flex items-center justify-center ${className}`} style={{ width: size, height: size }}>
      <svg width={size} height={size} className="-rotate-90">
        <circle
          cx={size / 2}
          cy={size / 2}
          r={radius}
          fill="none"
          stroke="hsl(var(--primary) / 0.12)"
          strokeWidth={strokeWidth}
        />
        <circle
          cx={size / 2}
          cy={size / 2}
          r={radius}
          fill="none"
          stroke={color}
          strokeWidth={strokeWidth}
          strokeLinecap="round"
          strokeDasharray={circumference}
          strokeDashoffset={offset}
          style={{
            ['--ring-circ' as string]: circumference,
            animation: 'ring-fill 1s cubic-bezier(0.16,1,0.3,1) 0.15s backwards',
            transition: 'stroke-dashoffset 0.6s cubic-bezier(0.16,1,0.3,1)',
          }}
        />
      </svg>
      <div className="absolute inset-0 flex flex-col items-center justify-center">
        {showPercent && (
          <span className="text-[11px] font-bold tabular-nums" style={{ color }}>
            {Math.round(value)}%
          </span>
        )}
        {label && <span className="text-[11px] text-muted-foreground leading-tight">{label}</span>}
      </div>
    </div>
  );
}
