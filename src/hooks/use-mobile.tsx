import * as React from "react";

const MOBILE_BREAKPOINT = 768;
const QUERY = `(max-width: ${MOBILE_BREAKPOINT - 1}px)`;

const getMatch = () => (typeof window !== "undefined" && window.matchMedia ? window.matchMedia(QUERY).matches : false);

/** Read synchronously on first render so phones don't render the desktop layout first (and remount). */
export function useIsMobile() {
  const [isMobile, setIsMobile] = React.useState<boolean>(getMatch);

  React.useEffect(() => {
    const mql = window.matchMedia(QUERY);
    const onChange = () => setIsMobile(mql.matches);
    mql.addEventListener("change", onChange);
    onChange();
    return () => mql.removeEventListener("change", onChange);
  }, []);

  return isMobile;
}
