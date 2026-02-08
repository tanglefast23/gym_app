'use client';

import { type ReactNode, useEffect, useRef, useCallback, useSyncExternalStore } from 'react';
import { createPortal } from 'react-dom';
import { lockBodyScroll, unlockBodyScroll } from '@/lib/scrollLock';

interface BottomSheetProps {
  isOpen: boolean;
  onClose: () => void;
  title?: string;
  children: ReactNode;
}

/**
 * Subscribe to nothing -- we only need this to read a snapshot
 * that tells us whether we're in the browser (SSR guard).
 */
const subscribe = () => () => {};
const getSnapshot = () => true;
const getServerSnapshot = () => false;

export const BottomSheet = ({
  isOpen,
  onClose,
  title,
  children,
}: BottomSheetProps) => {
  const isBrowser = useSyncExternalStore(subscribe, getSnapshot, getServerSnapshot);
  const backdropRef = useRef<HTMLDivElement>(null);
  const sheetRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    if (isOpen) {
      lockBodyScroll();
      // Delay to trigger CSS transition after mount
      const raf = requestAnimationFrame(() => {
        backdropRef.current?.classList.replace('bg-black/0', 'bg-black/60');
        sheetRef.current?.classList.replace('translate-y-full', 'translate-y-0');
      });
      return () => {
        cancelAnimationFrame(raf);
        unlockBodyScroll();
      };
    }
  }, [isOpen]);

  const handleBackdropClick = useCallback(() => {
    onClose();
  }, [onClose]);

  const handleSheetClick = useCallback(
    (e: React.MouseEvent) => {
      e.stopPropagation();
    },
    [],
  );

  if (!isBrowser || !isOpen) {
    return null;
  }

  return createPortal(
    <div
      ref={backdropRef}
      className="fixed inset-0 z-50 bg-black/0 transition-colors duration-300"
      onClick={handleBackdropClick}
      data-sfx="sheetClose"
      role="dialog"
      aria-modal="true"
      aria-label={title ?? 'Bottom sheet'}
    >
      <div
        ref={sheetRef}
        className={[
          'fixed bottom-0 left-0 right-0',
          'rounded-t-[24px] bg-elevated',
          'pb-[env(safe-area-inset-bottom)]',
          'transition-transform duration-300 ease-out',
          'max-h-[85vh] overflow-y-auto',
          'translate-y-full',
        ].join(' ')}
        onClick={handleSheetClick}
      >
        {/* Drag handle */}
        <div className="flex justify-center pt-4 pb-5">
          <div className="h-1.5 w-10 rounded-full bg-[#2A2A2E]" />
        </div>

        {/* Title */}
        {title ? (
          <h2 className="px-5 pb-4 text-lg font-semibold text-text-primary">
            {title}
          </h2>
        ) : null}

        {/* Content */}
        <div className="px-5 pb-5">{children}</div>
      </div>
    </div>,
    document.body,
  );
};
