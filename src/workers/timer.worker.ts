/// <reference lib="webworker" />

// Message types from main thread -> worker
interface TimerStartMessage {
  type: 'START';
  endTime: number; // Date.now() + durationMs
}

interface TimerStopMessage {
  type: 'STOP';
}

interface TimerAdjustMessage {
  type: 'ADJUST';
  adjustMs: number; // +10000 or -10000
}

type IncomingMessage = TimerStartMessage | TimerStopMessage | TimerAdjustMessage;

// Message types from worker -> main thread
interface TimerTickMessage {
  type: 'TICK';
  remaining: number; // milliseconds remaining
}

interface TimerCompleteMessage {
  type: 'COMPLETE';
}

type OutgoingMessage = TimerTickMessage | TimerCompleteMessage;

let intervalId: ReturnType<typeof setInterval> | null = null;
let endTime = 0;

function stop(): void {
  if (intervalId !== null) {
    clearInterval(intervalId);
    intervalId = null;
  }
}

function tick(): void {
  const remaining = endTime - Date.now();
  if (remaining <= 0) {
    stop();
    self.postMessage({ type: 'COMPLETE' } satisfies OutgoingMessage);
    return;
  }
  self.postMessage({ type: 'TICK', remaining } satisfies OutgoingMessage);
}

self.addEventListener('message', (event: MessageEvent<IncomingMessage>) => {
  const msg = event.data;

  switch (msg.type) {
    case 'START':
      stop();
      endTime = msg.endTime;
      tick(); // immediate first tick
      intervalId = setInterval(tick, 100); // 100ms granularity
      break;

    case 'STOP':
      stop();
      break;

    case 'ADJUST':
      endTime += msg.adjustMs;
      tick(); // immediate re-tick to reflect change
      break;
  }
});
