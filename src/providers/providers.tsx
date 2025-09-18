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

export const Providers = ({ children }: { children: React.ReactNode }) => {

    return (
        <SessionProvider>
            <ThemeProvider attribute="class" defaultTheme="dark">
                <SupabaseAuthBridge />
                <SessionAutoSignOut />
                {children}
            </ThemeProvider>
        </SessionProvider>
    );
};