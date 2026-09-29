import { act, renderHook } from '@testing-library/react';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { anchorElapsedSeconds, formatMmSs, useCountdown, useStopwatch } from '../src/useTimer';

describe('anchorElapsedSeconds', () => {
  beforeEach(() => {
    vi.useFakeTimers();
    vi.setSystemTime(new Date('2026-01-01T00:01:00Z'));
  });
  afterEach(() => vi.useRealTimers());

  it('returns null when there is no anchor', () => {
    expect(anchorElapsedSeconds(undefined, 'work')).toBeNull();
  });

  it('returns null when the anchor is for a different phase', () => {
    const anchor = { phase_key: 'rest', duration_seconds: 30, started_at: '2026-01-01T00:00:00Z' };
    expect(anchorElapsedSeconds(anchor, 'work')).toBeNull();
  });

  it('returns the elapsed seconds since the anchor for a matching phase', () => {
    const anchor = { phase_key: 'work', duration_seconds: 30, started_at: '2026-01-01T00:00:00Z' };
    expect(anchorElapsedSeconds(anchor, 'work')).toBe(60);
  });
});

describe('useCountdown', () => {
  beforeEach(() => vi.useFakeTimers());
  afterEach(() => vi.useRealTimers());

  it('counts down every second and stays at zero once finished', () => {
    const { result } = renderHook(() => useCountdown(3));
    expect(result.current.remaining).toBe(3);

    act(() => vi.advanceTimersByTime(1000));
    expect(result.current.remaining).toBe(2);

    act(() => vi.advanceTimersByTime(5000));
    expect(result.current.remaining).toBe(0);
  });

  it('calls onComplete exactly once when reaching zero', () => {
    const onComplete = vi.fn();
    renderHook(() => useCountdown(1, onComplete));

    act(() => vi.advanceTimersByTime(1000));
    expect(onComplete).toHaveBeenCalledTimes(1);

    act(() => vi.advanceTimersByTime(5000));
    expect(onComplete).toHaveBeenCalledTimes(1);
  });

  it('pause stops the countdown and start resumes it', () => {
    const { result } = renderHook(() => useCountdown(5));

    act(() => result.current.pause());
    act(() => vi.advanceTimersByTime(3000));
    expect(result.current.remaining).toBe(5);

    act(() => result.current.start());
    act(() => vi.advanceTimersByTime(2000));
    expect(result.current.remaining).toBe(3);
  });

  it('skip jumps straight to zero', () => {
    const { result } = renderHook(() => useCountdown(10));
    act(() => result.current.skip());
    expect(result.current.remaining).toBe(0);
  });
});

describe('useStopwatch', () => {
  beforeEach(() => vi.useFakeTimers());
  afterEach(() => vi.useRealTimers());

  it('does not tick until started', () => {
    const { result } = renderHook(() => useStopwatch());
    act(() => vi.advanceTimersByTime(3000));
    expect(result.current.elapsed).toBe(0);
  });

  it('ticks once per second while running, and stop halts it', () => {
    const { result } = renderHook(() => useStopwatch());

    act(() => result.current.start());
    act(() => vi.advanceTimersByTime(2000));
    expect(result.current.elapsed).toBe(2);

    act(() => result.current.stop());
    act(() => vi.advanceTimersByTime(2000));
    expect(result.current.elapsed).toBe(2);
  });

  it('start accepts a resume offset', () => {
    const { result } = renderHook(() => useStopwatch());
    act(() => result.current.start(30));
    expect(result.current.elapsed).toBe(30);
  });
});

describe('formatMmSs', () => {
  it('formats seconds as mm:ss with zero-padded seconds', () => {
    expect(formatMmSs(0)).toBe('0:00');
    expect(formatMmSs(59)).toBe('0:59');
    expect(formatMmSs(60)).toBe('1:00');
    expect(formatMmSs(125)).toBe('2:05');
  });
});
