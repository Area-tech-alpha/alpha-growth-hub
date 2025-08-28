"use client";

import { useState, useEffect } from 'react';

interface CountdownTimerProps {
    expiresAt: string;
    onExpire: () => void;
    className?: string;
}

export const CountdownTimer = ({ expiresAt, onExpire, className }: CountdownTimerProps) => {
    const expirationTime = new Date(expiresAt).getTime();
    const [timeLeft, setTimeLeft] = useState(expirationTime - Date.now());

    useEffect(() => {
        const interval = setInterval(() => {
            const remaining = expirationTime - Date.now();
            if (remaining <= 1000) { // Deixa uma pequena margem
                clearInterval(interval);
                setTimeLeft(0);
                onExpire();
            } else {
                setTimeLeft(remaining);
            }
        }, 1000);

        return () => clearInterval(interval);
    }, [expiresAt, onExpire, expirationTime]);

    const minutes = Math.floor((timeLeft / 1000) / 60);
    const seconds = Math.floor((timeLeft / 1000) % 60);

    const getTimeColor = () => {
        if (timeLeft <= 60 * 1000) return 'text-red-500 dark:text-red-400';
        if (timeLeft <= 180 * 1000) return 'text-yellow-600 dark:text-yellow-400';
        return 'text-foreground';
    };

    return (
        <div className={`text-lg font-bold font-mono ${getTimeColor()} ${className}`}>
            {timeLeft > 0 ? `${String(minutes).padStart(2, '0')}:${String(seconds).padStart(2, '0')}` : 'Encerrado'}
        </div>
    );
};
