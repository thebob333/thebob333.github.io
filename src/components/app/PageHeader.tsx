import type { ReactNode } from 'react';
import { Link, useNavigate } from 'react-router-dom';
import { ChevronLeft, Settings } from 'lucide-react';
import { Button } from '@/components/ui/button';

interface PageHeaderProps {
  title: ReactNode;
  subtitle?: ReactNode;
  eyebrow?: ReactNode;
  actions?: ReactNode;
  /** Show the Settings gear (phones only — desktop has it in the sidebar). */
  settings?: boolean;
  /** Show a back button instead (used by Settings, which has no tab). */
  back?: boolean;
}

/** The one header every page uses, so titles, spacing and the Settings entry point are consistent. */
export function PageHeader({ title, subtitle, eyebrow, actions, settings = true, back = false }: PageHeaderProps) {
  const navigate = useNavigate();
  return (
    <header className="flex items-start justify-between gap-3">
      <div className="flex min-w-0 items-start gap-1">
        {back && (
          <Button
            variant="ghost"
            size="icon"
            className="-ml-2 h-10 w-10 shrink-0"
            aria-label="Back"
            onClick={() => (window.history.length > 1 ? navigate(-1) : navigate('/'))}
          >
            <ChevronLeft className="h-5 w-5" />
          </Button>
        )}
        <div className="min-w-0">
          {eyebrow && <p className="text-xs font-medium uppercase tracking-widest text-muted-foreground">{eyebrow}</p>}
          <h1 className="truncate text-2xl font-bold tracking-tight text-foreground md:text-3xl">{title}</h1>
          {subtitle && <p className="mt-0.5 text-sm text-muted-foreground">{subtitle}</p>}
        </div>
      </div>
      <div className="flex shrink-0 items-center gap-1.5">
        {actions}
        {settings && !back && (
          <Button asChild variant="ghost" size="icon" className="h-10 w-10 text-muted-foreground md:hidden" aria-label="Settings">
            <Link to="/settings">
              <Settings className="h-5 w-5" />
            </Link>
          </Button>
        )}
      </div>
    </header>
  );
}
