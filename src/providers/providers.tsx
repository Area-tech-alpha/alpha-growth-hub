"use client";

import { ThemeProvider } from "./theme-provider";
import { SessionProvider } from 'next-auth/react';

export const Providers = ({ children }: { children: React.ReactNode }) => {

    return (
        <SessionProvider>
            <ThemeProvider attribute="class" defaultTheme="dark">
                {children}
            </ThemeProvider>
        </SessionProvider>
    );
};