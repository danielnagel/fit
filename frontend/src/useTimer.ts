import { useEffect, useRef, useState } from 'react';

export type TimerAnchor = { phase_key: string; duration_seconds: number; started_at: string };

// Ermittelt die seit dem Anker verstrichene Zeit, sofern er zur aktuellen Phase passt.
// Dient nur der ungefaehren Wiederherstellung nach Reload/Geraetewechsel, nicht der Sekundengenauigkeit.
export function anchorElapsedSeconds(anchor: TimerAnchor | undefined, phaseKey: string): number | null {
  if (!anchor || anchor.phase_key !== phaseKey) return null;
  return Math.max(0, Math.floor((Date.now() - new Date(anchor.started_at).getTime()) / 1000));
}

export function useCountdown(seconds: number, onComplete?: () => void) {
  const [remaining, setRemaining] = useState(seconds);
  const [running, setRunning] = useState(true);
  const onCompleteRef = useRef(onComplete);
  onCompleteRef.current = onComplete;
  const firedRef = useRef(false);

  useEffect(() => {
    setRemaining(seconds);
    setRunning(true);
    firedRef.current = false;
  }, [seconds]);

  useEffect(() => {
    if (!running || remaining <= 0) return;
    const id = setInterval(() => setRemaining((r) => Math.max(0, r - 1)), 1000);
    return () => clearInterval(id);
  }, [running, remaining <= 0]);

  useEffect(() => {
    if (remaining > 0 || firedRef.current) return;
    firedRef.current = true;
    setRunning(false);
    onCompleteRef.current?.();
  }, [remaining]);

  return {
    remaining,
    running,
    start: () => setRunning(true),
    pause: () => setRunning(false),
    skip: () => setRemaining(0),
  };
}

export function useStopwatch(initialElapsed = 0) {
  const [elapsed, setElapsed] = useState(initialElapsed);
  const [running, setRunning] = useState(false);

  useEffect(() => {
    if (!running) return;
    const id = setInterval(() => setElapsed((e) => e + 1), 1000);
    return () => clearInterval(id);
  }, [running]);

  return {
    elapsed,
    running,
    start: (fromElapsed = 0) => {
      setElapsed(fromElapsed);
      setRunning(true);
    },
    stop: () => setRunning(false),
  };
}

export function formatMmSs(totalSeconds: number): string {
  const m = Math.floor(totalSeconds / 60);
  const s = totalSeconds % 60;
  return `${m}:${String(s).padStart(2, '0')}`;
}
