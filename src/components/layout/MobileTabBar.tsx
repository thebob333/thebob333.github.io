import { NavLink } from "@/components/NavLink";
import { useLocation } from "react-router-dom";
import { NAV_ITEMS, isNavActive } from "./nav";

const tabs = NAV_ITEMS;

export function MobileTabBar() {
  const location = useLocation();
  const isActive = (path: string) => isNavActive(location.pathname, path);

  return (
    <nav className="fixed bottom-0 left-0 right-0 z-50 bg-card/95 backdrop-blur-md border-t border-border safe-area-bottom">
      <div className="flex items-center justify-around h-14 px-1">
        {tabs.map((tab) => {
          const active = isActive(tab.url);
          return (
            <NavLink
              key={tab.url}
              to={tab.url}
              end={tab.url === "/"}
              className="flex flex-col items-center justify-center gap-0.5 flex-1 py-1 transition-colors"
              aria-current={active ? "page" : undefined}
              activeClassName=""
            >
              <div
                className={`p-1.5 rounded-xl transition-all ${
                  active
                    ? "bg-primary/10 text-primary"
                    : "text-muted-foreground"
                }`}
              >
                <tab.icon className="h-5 w-5" />
              </div>
              <span
                className={`text-[11px] font-medium leading-none ${
                  active ? "text-primary" : "text-muted-foreground"
                }`}
              >
                {tab.title}
              </span>
              {active && (
                <div className="w-1 h-1 rounded-full bg-primary" />
              )}
            </NavLink>
          );
        })}
      </div>
    </nav>
  );
}
