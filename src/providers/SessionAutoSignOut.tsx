"use client";

import { useEffect, useRef } from 'react';
import { signOut, useSession } from 'next-auth/react';

const LOGIN_PATH = '/login';

export default function SessionAutoSignOut() {
    const { data: session, status } = useSession();
    const timerRef = useRef<number | null>(null);

    useEffect(() => {
        if (timerRef.current) {
            window.clearTimeout(timerRef.current);
            timerRef.current = null;
        }

        if (status !== 'authenticated' || !session?.expires) {
            return;
        }

        const expiryTime = new Date(session.expires).getTime();
        const msUntilExpiry = expiryTime - Date.now();

        if (msUntilExpiry <= 0) {
            signOut({ callbackUrl: LOGIN_PATH });
            return;
        }

        timerRef.current = window.setTimeout(() => {
            signOut({ callbackUrl: LOGIN_PATH });
        }, msUntilExpiry);

        return () => {
            if (timerRef.current) {
                window.clearTimeout(timerRef.current);
            }
        };
    }, [session?.expires, status]);

    return null;
}


