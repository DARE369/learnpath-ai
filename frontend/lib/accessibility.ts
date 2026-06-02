/**
 * Accessibility utilities and WCAG 2.1 AA compliance helpers (Packet 6.3)
 */

/**
 * Color contrast checker (WCAG AA standard)
 * AA: 4.5:1 for normal text, 3:1 for large text
 */
export function getContrastRatio(rgb1: [number, number, number], rgb2: [number, number, number]): number {
  const getLuminance = (r: number, g: number, b: number): number => {
    const [rs, gs, bs] = [r, g, b].map(x => {
      x = x / 255;
      return x <= 0.03928 ? x / 12.92 : Math.pow((x + 0.055) / 1.055, 2.4);
    });
    return 0.2126 * rs + 0.7152 * gs + 0.0722 * bs;
  };

  const l1 = getLuminance(...rgb1);
  const l2 = getLuminance(...rgb2);
  const lighter = Math.max(l1, l2);
  const darker = Math.min(l1, l2);

  return (lighter + 0.05) / (darker + 0.05);
}

/**
 * Check if color pair meets WCAG AA standard
 */
export function meetsWCAGAA(rgb1: [number, number, number], rgb2: [number, number, number], isLargeText = false): boolean {
  const ratio = getContrastRatio(rgb1, rgb2);
  return isLargeText ? ratio >= 3 : ratio >= 4.5;
}

/**
 * Convert hex color to RGB
 */
export function hexToRgb(hex: string): [number, number, number] | null {
  const result = /^#?([a-f\d]{2})([a-f\d]{2})([a-f\d]{2})$/i.exec(hex);
  return result ? [parseInt(result[1], 16), parseInt(result[2], 16), parseInt(result[3], 16)] : null;
}

/**
 * Check WCAG color contrast compliance
 */
export function checkColorContrast(foreground: string, background: string, isLargeText = false): {
  ratio: number;
  passes: boolean;
  standard: string;
} {
  const fg = hexToRgb(foreground);
  const bg = hexToRgb(background);

  if (!fg || !bg) {
    return { ratio: 0, passes: false, standard: "Invalid color" };
  }

  const ratio = getContrastRatio(fg, bg);
  const standard = isLargeText ? "3:1 (Large Text)" : "4.5:1 (Normal Text)";
  const passes = meetsWCAGAA(fg, bg, isLargeText);

  return { ratio: parseFloat(ratio.toFixed(2)), passes, standard };
}

/**
 * Skip links for keyboard navigation
 */
export function addSkipLinks() {
  const skipLink = document.createElement("a");
  skipLink.href = "#main-content";
  skipLink.className = "skip-link";
  skipLink.textContent = "Skip to main content";
  skipLink.setAttribute("role", "navigation");
  document.body.insertBefore(skipLink, document.body.firstChild);

  // Style (should be offscreen by default, visible on focus)
  const style = document.createElement("style");
  style.textContent = `
    .skip-link {
      position: absolute;
      left: -9999px;
      z-index: 999;
    }
    .skip-link:focus {
      left: 50%;
      transform: translateX(-50%);
      top: 10px;
      background: #000;
      color: #fff;
      padding: 8px 16px;
      border-radius: 4px;
    }
  `;
  document.head.appendChild(style);
}

/**
 * Announce content updates to screen readers
 */
export function announceToScreenReader(message: string, priority: "polite" | "assertive" = "polite") {
  const announcement = document.createElement("div");
  announcement.setAttribute("role", "status");
  announcement.setAttribute("aria-live", priority);
  announcement.setAttribute("aria-atomic", "true");
  announcement.className = "sr-only";
  announcement.textContent = message;
  document.body.appendChild(announcement);

  setTimeout(() => announcement.remove(), 1000);
}

/**
 * Check if motion preference is reduced
 */
export function prefersReducedMotion(): boolean {
  return window.matchMedia("(prefers-reduced-motion: reduce)").matches;
}

/**
 * Disable animations if user prefers reduced motion
 */
export function applySafeAnimations(element: HTMLElement, animationClass: string) {
  if (!prefersReducedMotion()) {
    element.classList.add(animationClass);
  }
}

/**
 * Check if dark mode is preferred
 */
export function prefersDarkMode(): boolean {
  return window.matchMedia("(prefers-color-scheme: dark)").matches;
}

/**
 * Focus management utilities
 */
export function manageFocus(options: {
  trap?: HTMLElement;
  initialFocus?: HTMLElement;
  returnFocus?: boolean;
}) {
  let previouslyFocused: HTMLElement | null = null;

  return {
    start() {
      if (options.returnFocus) {
        previouslyFocused = document.activeElement as HTMLElement;
      }

      if (options.initialFocus) {
        options.initialFocus.focus();
      }
    },

    restore() {
      if (previouslyFocused) {
        previouslyFocused.focus();
      }
    },

    trap(event: KeyboardEvent) {
      if (!options.trap) return;

      const focusableElements = options.trap.querySelectorAll(
        "button, [href], input, select, textarea, [tabindex]:not([tabindex=\"-1\"])"
      );

      const firstElement = focusableElements[0] as HTMLElement;
      const lastElement = focusableElements[focusableElements.length - 1] as HTMLElement;

      if (event.key === "Tab") {
        if (event.shiftKey) {
          if (document.activeElement === firstElement) {
            event.preventDefault();
            lastElement.focus();
          }
        } else {
          if (document.activeElement === lastElement) {
            event.preventDefault();
            firstElement.focus();
          }
        }
      }
    },
  };
}

/**
 * ARIA label helpers
 */
export const ARIA_LABELS = {
  close: "Close dialog",
  menu: "Open menu",
  search: "Search",
  submit: "Submit form",
  loading: "Loading content...",
  error: "Error",
  success: "Success",
};

/**
 * Keyboard shortcut handler
 */
export function setupKeyboardShortcuts(shortcuts: Record<string, () => void>) {
  document.addEventListener("keydown", (event) => {
    // J = next video, K = previous, Space = play/pause
    const key = event.key.toLowerCase();

    if (key === "j") shortcuts["next"]?.();
    if (key === "k") shortcuts["previous"]?.();
    if (key === " " && (event.target === document.body || (event.target as HTMLElement).tagName === "BUTTON")) {
      shortcuts["play-pause"]?.();
    }
  });
}

/**
 * Test helper: Check if element is keyboard accessible
 */
export function isKeyboardAccessible(element: HTMLElement): boolean {
  const tabindex = element.getAttribute("tabindex");
  const isButton = element.tagName === "BUTTON";
  const isLink = element.tagName === "A";
  const isInput = ["INPUT", "TEXTAREA", "SELECT"].includes(element.tagName);

  return isButton || isLink || isInput || (tabindex !== null && parseInt(tabindex) >= 0);
}

/**
 * Test helper: Check if element has accessible label
 */
export function hasAccessibleLabel(element: HTMLElement): boolean {
  const ariaLabel = element.getAttribute("aria-label");
  const ariaLabelledBy = element.getAttribute("aria-labelledby");
  const label = document.querySelector(`label[for="${element.id}"]`);
  const innerText = element.textContent?.trim();

  return !!(ariaLabel || ariaLabelledBy || label || innerText);
}

/**
 * CSS class for screen reader only content
 */
export const srOnlyClass = `sr-only`;

/**
 * Insert SR-only styles if not present
 */
export function ensureSROnlyStyles() {
  if (document.querySelector("style[data-sr-only]")) return;

  const style = document.createElement("style");
  style.setAttribute("data-sr-only", "true");
  style.textContent = `
    .sr-only {
      position: absolute;
      width: 1px;
      height: 1px;
      padding: 0;
      margin: -1px;
      overflow: hidden;
      clip: rect(0, 0, 0, 0);
      white-space: nowrap;
      border-width: 0;
    }
  `;
  document.head.appendChild(style);
}
