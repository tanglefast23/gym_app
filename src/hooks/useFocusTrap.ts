import { useEffect, useRef, type RefObject } from 'react';

const FOCUSABLE_SELECTOR =
  'a[href], button:not([disabled]), textarea:not([disabled]), input:not([disabled]), select:not([disabled]), [tabindex]:not([tabindex="-1"])';

/**
 * Traps keyboard focus within a container while active.
 *
 * - Moves focus into the container on mount.
 * - Wraps Tab / Shift+Tab at the boundaries.
 * - Calls `onEscape` when the Escape key is pressed.
 * - Restores focus to the previously focused element on unmount.
 */
export function useFocusTrap(
  containerRef: RefObject<HTMLElement | null>,
  isActive: boolean,
  onEscape: () => void,
): void {
  const previousFocusRef = useRef<HTMLElement | null>(null);

  useEffect(() => {
    if (!isActive) return;

    // Save currently focused element so we can restore it later.
    previousFocusRef.current = document.activeElement as HTMLElement | null;

    // Delay initial focus to allow the portal to mount and animate.
    const rafId = requestAnimationFrame(() => {
      const container = containerRef.current;
      if (!container) return;

      const focusable = container.querySelectorAll<HTMLElement>(FOCUSABLE_SELECTOR);
      if (focusable.length > 0) {
        focusable[0].focus();
      } else {
        container.focus();
      }
    });

    function handleKeyDown(e: KeyboardEvent): void {
      if (e.key === 'Escape') {
        e.stopPropagation();
        onEscape();
        return;
      }

      if (e.key !== 'Tab') return;

      const container = containerRef.current;
      if (!container) return;

      const focusable = container.querySelectorAll<HTMLElement>(FOCUSABLE_SELECTOR);
      if (focusable.length === 0) return;

      const first = focusable[0];
      const last = focusable[focusable.length - 1];

      if (e.shiftKey) {
        if (document.activeElement === first) {
          e.preventDefault();
          last.focus();
        }
      } else {
        if (document.activeElement === last) {
          e.preventDefault();
          first.focus();
        }
      }
    }

    document.addEventListener('keydown', handleKeyDown, true);

    return () => {
      cancelAnimationFrame(rafId);
      document.removeEventListener('keydown', handleKeyDown, true);

      // Restore focus.
      previousFocusRef.current?.focus();
    };
  }, [isActive, containerRef, onEscape]);
}
