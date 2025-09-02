"use client";

import { useState, useEffect } from "react";

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
  const expirationTime = new Date(expiresAt).getTime();
  const [timeLeft, setTimeLeft] = useState(expirationTime - Date.now());

  useEffect(() => {
    const interval = setInterval(() => {
      const remaining = expirationTime - Date.now();
      if (remaining <= 1000) {
        clearInterval(interval);
        setTimeLeft(0);
        onExpire();
      } else {
        setTimeLeft(remaining);
      }
    }, 1000);

    return () => clearInterval(interval);
  }, [expiresAt, onExpire, expirationTime]);

  const minutes = Math.floor(timeLeft / 1000 / 60);
  const seconds = Math.floor((timeLeft / 1000) % 60);

  const getTimeColor = () => {
    if (isHot) return "";
    if (timeLeft <= 60 * 1000) return "text-red-500 dark:text-red-400";
    if (timeLeft <= 180 * 1000) return "text-yellow-600 dark:text-yellow-400";
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
        {timeLeft > 0
          ? `${String(minutes).padStart(2, "0")}:${String(seconds).padStart(
              2,
              "0"
            )}`
          : "Encerrado"}
      </div>
    </>
  );
};
