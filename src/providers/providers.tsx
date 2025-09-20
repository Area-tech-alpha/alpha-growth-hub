"use client";

import { ThemeProvider } from "./theme-provider";
import { SessionProvider } from 'next-auth/react';
import SessionAutoSignOut from './SessionAutoSignOut';
import { useEffect } from 'react';
import { createClient } from '@/utils/supabase/client';
import { useSession } from 'next-auth/react';

function SupabaseAuthBridge() {
    const { data: session } = useSession();
    useEffect(() => {
        const go = async () => {
            try {
                const supabase = createClient();
                const { data: authData } = await supabase.auth.getUser();
                const hasSupabase = Boolean(authData?.user?.id);
                const idToken = (session as unknown as { supabaseIdToken?: string })?.supabaseIdToken;
                const provider = (session as unknown as { supabaseProvider?: string })?.supabaseProvider as 'google' | undefined;
                if (!hasSupabase && idToken && provider) {
                    await supabase.auth.signInWithIdToken({ provider, token: idToken });
                }
            } catch { }
        };
        go();
    }, [session]);
    return null;
}

function GlobalSessionLoadingOverlay() {
    const { status } = useSession();
    if (status !== 'loading') return null;
    return (
        <div className="fixed inset-0 z-[1000] flex items-center justify-center bg-background/80 backdrop-blur-sm">
            <div className="flex flex-col items-center gap-3 p-6 rounded-xl border bg-card shadow-lg w-[90%] max-w-sm text-center">
                <div className="h-10 w-10 animate-spin rounded-full border-2 border-yellow-500 border-t-transparent" aria-label="Carregando" />
                <div className="text-base font-semibold">Carregando leilões…</div>
                <div className="text-sm text-muted-foreground">Preparando sua experiência em tempo real</div>
            </div>
        </div>
    );
}

export const Providers = ({ children }: { children: React.ReactNode }) => {

    return (
        <SessionProvider>
            <ThemeProvider attribute="class" defaultTheme="dark">
                <SupabaseAuthBridge />
                <GlobalSessionLoadingOverlay />
                <SessionAutoSignOut />
                {children}
            </ThemeProvider>
        </SessionProvider>
    );
};