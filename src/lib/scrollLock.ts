let lockCount = 0;
let prevOverflow: string | null = null;
let prevPaddingRight: string | null = null;

function getScrollbarWidth(): number {
  if (typeof window === 'undefined' || typeof document === 'undefined') return 0;
  return Math.max(0, window.innerWidth - document.documentElement.clientWidth);
}

/**
 * Ref-counted body scroll lock to safely support stacked modals/sheets.
 * The first lock saves existing styles; the last unlock restores them.
 */
export function lockBodyScroll(): void {
  if (typeof document === 'undefined') return;

  lockCount += 1;
  if (lockCount !== 1) return;

  prevOverflow = document.body.style.overflow;
  prevPaddingRight = document.body.style.paddingRight;

  const scrollbarWidth = getScrollbarWidth();
  if (scrollbarWidth > 0) {
    document.body.style.paddingRight = `${scrollbarWidth}px`;
  }

  document.body.style.overflow = 'hidden';
}

export function unlockBodyScroll(): void {
  if (typeof document === 'undefined') return;

  lockCount = Math.max(0, lockCount - 1);
  if (lockCount !== 0) return;

  if (prevOverflow !== null) {
    document.body.style.overflow = prevOverflow;
    prevOverflow = null;
  } else {
    document.body.style.overflow = '';
  }

  if (prevPaddingRight !== null) {
    document.body.style.paddingRight = prevPaddingRight;
    prevPaddingRight = null;
  } else {
    document.body.style.paddingRight = '';
  }
}

