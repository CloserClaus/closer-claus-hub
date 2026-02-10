import { useState, useEffect, useRef } from 'react';
import { Progress } from '@/components/ui/progress';

interface ProgressLoadingBarProps {
  isActive: boolean;
  durationMs: number;
  messages: string[];
  messageIntervalMs?: number;
  onComplete?: () => void;
}

export function ProgressLoadingBar({
  isActive,
  durationMs,
  messages,
  messageIntervalMs = 4000,
  onComplete,
}: ProgressLoadingBarProps) {
  const [progress, setProgress] = useState(0);
  const [messageIndex, setMessageIndex] = useState(0);
  const startTimeRef = useRef<number | null>(null);
  const rafRef = useRef<number | null>(null);
  const completedRef = useRef(false);

  // Progress animation
  useEffect(() => {
    if (!isActive) {
      setProgress(0);
      startTimeRef.current = null;
      completedRef.current = false;
      if (rafRef.current) cancelAnimationFrame(rafRef.current);
      return;
    }

    startTimeRef.current = Date.now();
    completedRef.current = false;

    const tick = () => {
      if (!startTimeRef.current || completedRef.current) return;
      const elapsed = Date.now() - startTimeRef.current;
      const raw = Math.min((elapsed / durationMs) * 100, 100);
      // Ease-out curve: fast start, slow finish
      const eased = raw < 90 ? raw : 90 + (raw - 90) * 0.3;
      setProgress(Math.min(eased, 99));

      if (elapsed >= durationMs && !completedRef.current) {
        completedRef.current = true;
        setProgress(100);
        onComplete?.();
        return;
      }

      rafRef.current = requestAnimationFrame(tick);
    };

    rafRef.current = requestAnimationFrame(tick);

    return () => {
      if (rafRef.current) cancelAnimationFrame(rafRef.current);
    };
  }, [isActive, durationMs, onComplete]);

  // Message rotation
  useEffect(() => {
    if (!isActive) {
      setMessageIndex(0);
      return;
    }

    const interval = setInterval(() => {
      setMessageIndex((prev) => (prev + 1) % messages.length);
    }, messageIntervalMs);

    return () => clearInterval(interval);
  }, [isActive, messages, messageIntervalMs]);

  if (!isActive) return null;

  return (
    <div className="space-y-3 w-full">
      <Progress value={progress} className="h-2" />
      <p className="text-sm text-muted-foreground text-center animate-pulse">
        {messages[messageIndex]}
      </p>
    </div>
  );
}
