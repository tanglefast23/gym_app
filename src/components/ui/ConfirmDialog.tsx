'use client';

import { useEffect, useRef, useCallback, useSyncExternalStore } from 'react';
import { createPortal } from 'react-dom';
import { Button } from './Button';
import { lockBodyScroll, unlockBodyScroll } from '@/lib/scrollLock';
import { useFocusTrap } from '@/hooks';

interface ConfirmDialogProps {
  isOpen: boolean;
  onClose: () => void;
  onConfirm: () => void;
  title: string;
  description?: string;
  confirmText?: string;
  confirmDisabled?: boolean;
  variant?: 'danger' | 'default';
}

const subscribe = () => () => {};
const getSnapshot = () => true;
const getServerSnapshot = () => false;

export const ConfirmDialog = ({
  isOpen,
  onClose,
  onConfirm,
  title,
  description,
  confirmText = 'Confirm',
  confirmDisabled = false,
  variant = 'default',
}: ConfirmDialogProps) => {
  const isBrowser = useSyncExternalStore(subscribe, getSnapshot, getServerSnapshot);
  const overlayRef = useRef<HTMLDivElement>(null);
  const panelRef = useRef<HTMLDivElement>(null);
  const confirmBtnRef = useRef<HTMLButtonElement>(null);

  useFocusTrap(panelRef, isOpen && isBrowser, onClose);

  // Auto-focus the confirm button when the dialog opens.
  // Runs after useFocusTrap's requestAnimationFrame initial focus,
  // so we use a nested rAF to override and land on the primary action.
  useEffect(() => {
    if (!isOpen || !isBrowser) return;

    let innerRaf: number;
    const outerRaf = requestAnimationFrame(() => {
      innerRaf = requestAnimationFrame(() => {
        confirmBtnRef.current?.focus();
      });
    });
    return () => {
      cancelAnimationFrame(outerRaf);
      cancelAnimationFrame(innerRaf);
    };
  }, [isOpen, isBrowser]);

  useEffect(() => {
    if (isOpen) {
      lockBodyScroll();
      const raf = requestAnimationFrame(() => {
        overlayRef.current?.classList.replace('bg-black/0', 'bg-black/60');
        panelRef.current?.classList.remove('opacity-0');
        panelRef.current?.classList.add('animate-scale-in');
      });
      return () => {
        cancelAnimationFrame(raf);
        unlockBodyScroll();
      };
    }
  }, [isOpen]);

  const handleOverlayClick = useCallback(() => {
    onClose();
  }, [onClose]);

  const handleDialogClick = useCallback(
    (e: React.MouseEvent) => {
      e.stopPropagation();
    },
    [],
  );

  const handleConfirm = useCallback(() => {
    onConfirm();
    onClose();
  }, [onConfirm, onClose]);

  if (!isBrowser || !isOpen) {
    return null;
  }

  return createPortal(
    <div
      ref={overlayRef}
      className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/0 transition-colors duration-200"
      onClick={handleOverlayClick}
      data-sfx="cancel"
      role="dialog"
      aria-modal="true"
      aria-label={title}
    >
      <div
        ref={panelRef}
        className="w-full max-w-sm rounded-2xl bg-elevated p-6 shadow-xl opacity-0"
        onClick={handleDialogClick}
      >
        <h2 className="text-lg font-semibold text-text-primary">
          {title}
        </h2>

        {description ? (
          <p className="mt-2 whitespace-pre-line text-sm text-text-secondary">
            {description}
          </p>
        ) : null}

        <div className="mt-6 flex gap-3">
          <Button
            variant="secondary"
            onClick={onClose}
            fullWidth
            data-sfx="cancel"
          >
            Cancel
          </Button>
          <Button
            ref={confirmBtnRef}
            variant={variant === 'danger' ? 'danger' : 'primary'}
            onClick={handleConfirm}
            fullWidth
            disabled={confirmDisabled}
            data-sfx={variant === 'danger' ? 'danger' : 'confirm'}
          >
            {confirmText}
          </Button>
        </div>
      </div>
    </div>,
    document.body,
  );
};
