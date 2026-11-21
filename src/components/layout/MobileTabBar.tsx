import { NavLink } from "@/components/NavLink";
import { useLocation } from "react-router-dom";
import { cn } from "@/lib/utils";
import { NAV_ITEMS, isNavActive } from "./nav";

/** Translucent iOS-style tab bar: icon + label, the active tab tinted with the accent. */
export function MobileTabBar() {
  const { pathname } = useLocation();
  return (
    <nav
      aria-label="Main"
      className="fixed inset-x-0 bottom-0 z-50 border-t border-border/60 bg-background/80 backdrop-blur-xl backdrop-saturate-150 safe-area-bottom"
    >
      <div className="mx-auto flex h-[3.25rem] max-w-lg items-stretch">
        {NAV_ITEMS.map(tab => {
          const active = isNavActive(pathname, tab.url);
          return (
            <NavLink
              key={tab.url}
              to={tab.url}
              end={tab.url === "/"}
              aria-current={active ? "page" : undefined}
              className={cn(
                "flex flex-1 flex-col items-center justify-center gap-0.5 transition-colors",
                active ? "text-primary" : "text-muted-foreground",
              )}
              activeClassName=""
            >
              <tab.icon className="h-[22px] w-[22px]" strokeWidth={active ? 2.25 : 1.75} />
              <span className={cn("text-[11px] leading-none", active ? "font-semibold" : "font-medium")}>{tab.title}</span>
            </NavLink>
          );
        })}
      </div>
    </nav>
  );
}
