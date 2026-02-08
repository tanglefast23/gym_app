'use client';

import { useRef, useCallback, useEffect, useState } from 'react';

/** Message types sent from main thread to the timer worker */
interface TimerWorkerStartMessage {
  type: 'START';
  endTime: number;
}

interface TimerWorkerStopMessage {
  type: 'STOP';
}

interface TimerWorkerAdjustMessage {
  type: 'ADJUST';
  adjustMs: number;
}

type TimerWorkerOutgoing =
  | TimerWorkerStartMessage
  | TimerWorkerStopMessage
  | TimerWorkerAdjustMessage;

/** Message types received from the timer worker */
interface TimerWorkerTickMessage {
  type: 'TICK';
  remaining: number;
}

interface TimerWorkerCompleteMessage {
  type: 'COMPLETE';
}

type TimerWorkerIncoming = TimerWorkerTickMessage | TimerWorkerCompleteMessage;

interface UseTimerOptions {
  onComplete: () => void;
  onTick?: (remainingMs: number) => void;
}

interface UseTimerReturn {
  /** Remaining time in milliseconds */
  remainingMs: number;
  /** Whether the timer is currently running */
  isRunning: boolean;
  /** Start the timer with a duration in seconds */
  start: (durationSec: number) => void;
  /** Stop the timer */
  stop: () => void;
  /** Skip the timer (immediately complete) */
  skip: () => void;
  /** Adjust the timer by seconds (+10, -10, etc.) */
  adjust: (seconds: number) => void;
}

/**
 * Creates and returns a lazily-initialized Web Worker for timer countdown logic.
 * Uses absolute timestamps so backgrounded tabs recover correctly.
 */
function createTimerWorker(): Worker {
  return new Worker(
    new URL('../workers/timer.worker.ts', import.meta.url)
  );
}

/**
 * React hook that wraps a Web Worker-based countdown timer with
 * visibility recovery for mobile/backgrounded tabs.
 */
export function useTimer(options: UseTimerOptions): UseTimerReturn {
  const { onComplete, onTick } = options;

  const [remainingMs, setRemainingMs] = useState(0);
  const [isRunning, setIsRunning] = useState(false);

  const workerRef = useRef<Worker | null>(null);
  const endTimeRef = useRef<number>(0);
  const onCompleteRef = useRef(onComplete);
  const onTickRef = useRef(onTick);

  // Keep callback refs current without re-creating effects
  useEffect(() => {
    onCompleteRef.current = onComplete;
  }, [onComplete]);

  useEffect(() => {
    onTickRef.current = onTick;
  }, [onTick]);

  /** Lazily initialize the worker and wire up message handling */
  const getWorker = useCallback((): Worker => {
    if (workerRef.current) {
      return workerRef.current;
    }

    const worker = createTimerWorker();

    worker.addEventListener(
      'message',
      (event: MessageEvent<TimerWorkerIncoming>) => {
        const msg = event.data;

        switch (msg.type) {
          case 'TICK':
            setRemainingMs(msg.remaining);
            onTickRef.current?.(msg.remaining);
            break;

          case 'COMPLETE':
            setRemainingMs(0);
            setIsRunning(false);
            endTimeRef.current = 0;
            onCompleteRef.current();
            break;
        }
      }
    );

    workerRef.current = worker;
    return worker;
  }, []);

  /** Send a typed message to the worker */
  const postToWorker = useCallback(
    (message: TimerWorkerOutgoing): void => {
      const worker = getWorker();
      worker.postMessage(message);
    },
    [getWorker]
  );

  const start = useCallback(
    (durationSec: number): void => {
      const endTime = Date.now() + durationSec * 1000;
      endTimeRef.current = endTime;
      setRemainingMs(durationSec * 1000);
      setIsRunning(true);
      postToWorker({ type: 'START', endTime });
    },
    [postToWorker]
  );

  const stop = useCallback((): void => {
    postToWorker({ type: 'STOP' });
    setIsRunning(false);
    endTimeRef.current = 0;
  }, [postToWorker]);

  const skip = useCallback((): void => {
    if (workerRef.current) {
      workerRef.current.postMessage({ type: 'STOP' } satisfies TimerWorkerOutgoing);
    }
    setRemainingMs(0);
    setIsRunning(false);
    endTimeRef.current = 0;
    onCompleteRef.current();
  }, []);

  const adjust = useCallback(
    (seconds: number): void => {
      const adjustMs = seconds * 1000;
      endTimeRef.current += adjustMs;
      postToWorker({ type: 'ADJUST', adjustMs });
    },
    [postToWorker]
  );

  // Visibility recovery: detect when the tab comes back to the foreground
  // and reconcile timer state (the worker may have been throttled by the OS)
  useEffect(() => {
    function handleVisibility(): void {
      if (
        document.visibilityState === 'visible' &&
        endTimeRef.current > 0
      ) {
        const remaining = endTimeRef.current - Date.now();

        if (remaining <= 0) {
          // Timer expired while the tab was backgrounded
          workerRef.current?.postMessage({
            type: 'STOP',
          } satisfies TimerWorkerOutgoing);
          setRemainingMs(0);
          setIsRunning(false);
          endTimeRef.current = 0;
          onCompleteRef.current();
        } else {
          // Recalculate in case the worker was throttled
          setRemainingMs(remaining);
        }
      }
    }

    document.addEventListener('visibilitychange', handleVisibility);
    return () => {
      document.removeEventListener('visibilitychange', handleVisibility);
    };
  }, []);

  // Cleanup: terminate worker on unmount
  useEffect(() => {
    return () => {
      if (workerRef.current) {
        workerRef.current.terminate();
        workerRef.current = null;
      }
    };
  }, []);

  return {
    remainingMs,
    isRunning,
    start,
    stop,
    skip,
    adjust,
  };
}
