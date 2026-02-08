'use client';

import { useEffect, useRef, useCallback, useSyncExternalStore } from 'react';
import { createPortal } from 'react-dom';
import { Button } from './Button';
import { lockBodyScroll, unlockBodyScroll } from '@/lib/scrollLock';

interface ConfirmDialogProps {
  isOpen: boolean;
  onClose: () => void;
  onConfirm: () => void;
  title: string;
  description?: string;
  confirmText?: string;
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
  variant = 'default',
}: ConfirmDialogProps) => {
  const isBrowser = useSyncExternalStore(subscribe, getSnapshot, getServerSnapshot);
  const overlayRef = useRef<HTMLDivElement>(null);
  const panelRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    if (isOpen) {
      lockBodyScroll();
      const raf = requestAnimationFrame(() => {
        overlayRef.current?.classList.replace('bg-black/0', 'bg-black/60');
        panelRef.current?.classList.remove('scale-95', 'opacity-0');
        panelRef.current?.classList.add('scale-100', 'opacity-100');
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
      role="dialog"
      aria-modal="true"
      aria-label={title}
    >
      <div
        ref={panelRef}
        className="w-full max-w-sm rounded-2xl bg-elevated p-6 shadow-xl transition-all duration-200 scale-95 opacity-0"
        onClick={handleDialogClick}
      >
        <h2 className="text-lg font-semibold text-text-primary">
          {title}
        </h2>

        {description ? (
          <p className="mt-2 text-sm text-text-secondary">
            {description}
          </p>
        ) : null}

        <div className="mt-6 flex gap-3">
          <Button
            variant="secondary"
            onClick={onClose}
            fullWidth
          >
            Cancel
          </Button>
          <Button
            variant={variant === 'danger' ? 'danger' : 'primary'}
            onClick={handleConfirm}
            fullWidth
          >
            {confirmText}
          </Button>
        </div>
      </div>
    </div>,
    document.body,
  );
};
