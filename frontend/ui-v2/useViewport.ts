import { useEffect, useLayoutEffect, useState } from "react";

/**
 * Shared responsive breakpoints for the learner app. Matches the ui-v2 shell
 * (AppShellV2) and the .dc.html mockups exactly:
 *   isMobile  : width < 720   (phone)
 *   isTablet  : 720 – 1079    (tablet)
 *   desktop   : >= 1080
 *
 * SSR-safe AND flash-free: the server (and the very first client render) can't
 * know the real width, so it starts desktop-width to match SSR — but on the
 * client we correct SYNCHRONOUSLY before the browser paints (useLayoutEffect),
 * so a phone never shows the desktop sidebar for even one frame. Previously the
 * correction ran in a post-paint useEffect, which flashed the desktop layout on
 * mobile until a later render/refresh happened to catch up.
 */

// useLayoutEffect warns on the server; fall back to useEffect there (never runs).
const useIsomorphicLayoutEffect = typeof window !== "undefined" ? useLayoutEffect : useEffect;

export function useViewport() {
  const [width, setWidth] = useState(1280);

  useIsomorphicLayoutEffect(() => {
    const onResize = () => setWidth(window.innerWidth);
    onResize(); // reads real width before first paint on the client
    window.addEventListener("resize", onResize);
    return () => window.removeEventListener("resize", onResize);
  }, []);

  return {
    width,
    isMobile: width < 720,
    isTablet: width >= 720 && width < 1080,
  };
}
