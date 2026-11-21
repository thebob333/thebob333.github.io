import type { ReactNode } from 'react';
import { Link, useNavigate } from 'react-router-dom';
import { ChevronLeft, Settings } from 'lucide-react';

interface PageHeaderProps {
  title: ReactNode;
  subtitle?: ReactNode;
  eyebrow?: ReactNode;
  actions?: ReactNode;
  /** Show the Settings button (phones only — desktop has it in the sidebar). */
  settings?: boolean;
  /** Show a back button (used by detail screens and Settings). */
  back?: boolean | string;
}

/** Large-title header used by every screen. */
export function PageHeader({ title, subtitle, eyebrow, actions, settings = true, back = false }: PageHeaderProps) {
  const navigate = useNavigate();
  const goBack = () => {
    if (typeof back === 'string') navigate(back);
    else if (window.history.length > 1) navigate(-1);
    else navigate('/');
  };
  return (
    <header className="pt-1">
      {back && (
        <button type="button" onClick={goBack} className="-ml-2 mb-1 flex h-9 items-center gap-0.5 rounded-lg pr-2 text-body font-medium text-primary">
          <ChevronLeft className="h-5 w-5" /> Back
        </button>
      )}
      <div className="flex items-end justify-between gap-3">
        <div className="min-w-0">
          {eyebrow && <p className="text-footnote font-semibold uppercase tracking-wide text-muted-foreground">{eyebrow}</p>}
          <h1 className="truncate text-large-title text-foreground">{title}</h1>
        </div>
        <div className="mb-1 flex shrink-0 items-center gap-2">
          {actions}
          {settings && !back && (
            <Link
              to="/settings"
              aria-label="Settings"
              className="flex h-9 w-9 items-center justify-center rounded-full bg-secondary text-muted-foreground transition-colors hover:text-foreground md:hidden"
            >
              <Settings className="h-[18px] w-[18px]" />
            </Link>
          )}
        </div>
      </div>
      {subtitle && <p className="mt-1 text-body text-muted-foreground">{subtitle}</p>}
    </header>
  );
}

/** Round icon button for header actions (e.g. "+"). */
export function HeaderButton({ label, onClick, children, primary = false }: { label: string; onClick: () => void; children: ReactNode; primary?: boolean }) {
  return (
    <button
      type="button"
      aria-label={label}
      onClick={onClick}
      className={`flex h-9 w-9 items-center justify-center rounded-full transition-colors ${primary ? 'bg-primary text-primary-foreground' : 'bg-secondary text-foreground hover:bg-accent'}`}
    >
      {children}
    </button>
  );
}
