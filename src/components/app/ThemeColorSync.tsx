import { useEffect } from 'react';
import { useTheme } from 'next-themes';

const COLORS = { light: '#F5F2EB', dark: '#12151C' };

/** Keeps the browser / iPhone status-bar color in step with light or dark mode. */
export function ThemeColorSync() {
  const { resolvedTheme } = useTheme();
  useEffect(() => {
    const color = resolvedTheme === 'dark' ? COLORS.dark : COLORS.light;
    document.querySelectorAll('meta[name="theme-color"]').forEach(m => m.setAttribute('content', color));
  }, [resolvedTheme]);
  return null;
}
