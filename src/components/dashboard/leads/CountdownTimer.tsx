"use client";

import { useEffect, useRef, useState } from "react";

interface CountdownTimerProps {
  expiresAt: string;
  onExpire: () => void;
  className?: string;
  isHot?: boolean;
}

export const CountdownTimer = ({
  expiresAt,
  onExpire,
  className,
  isHot = false,
}: CountdownTimerProps) => {
  const computeInitial = () => {
    const diff = new Date(expiresAt).getTime() - Date.now();
    return Number.isFinite(diff) ? diff : 0;
  };
  const [timeLeft, setTimeLeft] = useState<number>(computeInitial);
  const hasEmittedExpireRef = useRef(false);

  useEffect(() => {
    hasEmittedExpireRef.current = false;

    const tick = () => {
      const target = new Date(expiresAt).getTime();
      const remaining = Number.isFinite(target) ? target - Date.now() : 0;

      if (remaining <= 0) {
        setTimeLeft(0);
        if (!hasEmittedExpireRef.current) {
          hasEmittedExpireRef.current = true;
          onExpire();
        }
        return;
      }

      setTimeLeft(remaining);
    };

    tick(); // Ensure UI updates immediately when expiresAt changes
    const intervalId = window.setInterval(tick, 1000);

    return () => window.clearInterval(intervalId);
  }, [expiresAt, onExpire]);

  const safeTimeLeft = Math.max(0, timeLeft);
  const minutes = Math.floor(safeTimeLeft / 1000 / 60);
  const seconds = Math.floor((safeTimeLeft / 1000) % 60);

  const getTimeColor = () => {
    if (isHot) return "";
    if (safeTimeLeft <= 60 * 1000) return "text-red-500 dark:text-red-400";
    if (safeTimeLeft <= 180 * 1000) return "text-yellow-600 dark:text-yellow-400";
    return "text-foreground";
  };

  return (
    <>
      <style jsx>{`
        @keyframes hot-timer-pulse {
          0%,
          100% {
            transform: scale(1);
            color: #ef4444; /* red-500 */
          }
          50% {
            transform: scale(1.25);
            color: #f87171; /* red-400 */
          }
        }
        .hot-timer-animation {
          animation: hot-timer-pulse 1s ease-in-out infinite;
        }
      `}</style>

      <div
        className={`text-lg font-bold font-mono ${getTimeColor()} ${
          isHot ? "hot-timer-animation" : ""
        } ${className}`}
      >
        {safeTimeLeft > 0
          ? `${String(minutes).padStart(2, "0")}:${String(seconds).padStart(
              2,
              "0"
            )}`
          : "Encerrado"}
      </div>
    </>
  );
};
