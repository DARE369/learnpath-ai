import { useEffect, useState } from "react";

/**
 * Shared responsive breakpoints for the learner app. Matches the ui-v2 shell
 * (AppShellV2) and the .dc.html mockups exactly:
 *   isMobile  : width < 720   (phone)
 *   isTablet  : 720 – 1079    (tablet)
 *   desktop   : >= 1080
 *
 * SSR-safe: starts at a desktop width so the server render matches the most
 * common case, then corrects on mount.
 */
export function useViewport() {
  const [width, setWidth] = useState(1280);
  useEffect(() => {
    const onResize = () => setWidth(window.innerWidth);
    onResize();
    window.addEventListener("resize", onResize);
    return () => window.removeEventListener("resize", onResize);
  }, []);
  return {
    width,
    isMobile: width < 720,
    isTablet: width >= 720 && width < 1080,
  };
}
