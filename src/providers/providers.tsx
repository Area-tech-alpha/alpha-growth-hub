"use client";

import { ThemeProvider } from "./theme-provider";
import { SessionProvider } from 'next-auth/react';
import SessionAutoSignOut from './SessionAutoSignOut';

export const Providers = ({ children }: { children: React.ReactNode }) => {

    return (
        <SessionProvider>
            <ThemeProvider attribute="class" defaultTheme="dark">
                <SessionAutoSignOut />
                {children}
            </ThemeProvider>
        </SessionProvider>
    );
};