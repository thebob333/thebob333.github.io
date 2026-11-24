import { Sun, CalendarDays, Target, Dumbbell, Settings, Orbit } from "lucide-react";

/** One source of truth for navigation labels, so tabs, sidebar and headers always match. */
export const NAV_ITEMS = [
  { title: "Today", url: "/", icon: Sun },
  { title: "Plan", url: "/plan", icon: CalendarDays },
  { title: "Goals", url: "/goals", icon: Target },
  { title: "Gym", url: "/gym", icon: Dumbbell },
  { title: "Arete", url: "/arete", icon: Orbit },
] as const;

export const SETTINGS_ITEM = { title: "Settings", url: "/settings", icon: Settings } as const;

export function isNavActive(pathname: string, url: string) {
  return url === "/" ? pathname === "/" : pathname === url || pathname.startsWith(`${url}/`);
}
