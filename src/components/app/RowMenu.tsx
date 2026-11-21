import type { LucideIcon } from 'lucide-react';
import { MoreHorizontal } from 'lucide-react';
import {
  DropdownMenu, DropdownMenuContent, DropdownMenuItem, DropdownMenuSeparator, DropdownMenuTrigger,
} from '@/components/ui/dropdown-menu';
import { cn } from '@/lib/utils';

export interface RowMenuItem {
  label: string;
  icon?: LucideIcon;
  onSelect: () => void;
  destructive?: boolean;
  disabled?: boolean;
  /** Draw a divider above this item. */
  separated?: boolean;
}

/**
 * A visible "⋯" button with a menu of actions — replaces controls that only
 * appeared on mouse hover (invisible on a phone). 40px tap target.
 */
export function RowMenu({ items, label = 'More actions', className }: { items: RowMenuItem[]; label?: string; className?: string }) {
  return (
    <DropdownMenu modal={false}>
      <DropdownMenuTrigger asChild>
        <button
          type="button"
          aria-label={label}
          onClick={e => e.stopPropagation()}
          onPointerDown={e => e.stopPropagation()}
          className={cn('flex h-10 w-10 shrink-0 items-center justify-center rounded-lg text-muted-foreground hover:bg-accent focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring md:h-8 md:w-8', className)}
        >
          <MoreHorizontal className="h-5 w-5" />
        </button>
      </DropdownMenuTrigger>
      <DropdownMenuContent align="end" className="min-w-[11rem]" onClick={e => e.stopPropagation()}>
        {items.map((item, i) => (
          <div key={item.label}>
            {item.separated && i > 0 && <DropdownMenuSeparator />}
            <DropdownMenuItem
              disabled={item.disabled}
              onSelect={() => item.onSelect()}
              className={cn('h-10 gap-2 text-sm', item.destructive && 'text-destructive focus:text-destructive')}
            >
              {item.icon && <item.icon className="h-4 w-4" />}
              {item.label}
            </DropdownMenuItem>
          </div>
        ))}
      </DropdownMenuContent>
    </DropdownMenu>
  );
}
