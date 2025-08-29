// src/providers/providers.tsx (ou o caminho correto do seu arquivo)

"use client";

// --- ADIÇÕES PARA O REACT QUERY ---
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { useState } from "react";
// --- FIM DAS ADIÇÕES ---

import { ThemeProvider } from "./theme-provider";
import { SessionProvider } from 'next-auth/react';
import SessionAutoSignOut from './SessionAutoSignOut';

export const Providers = ({ children }: { children: React.ReactNode }) => {
    // Instância do QueryClient (necessária para o provider)
    const [queryClient] = useState(() => new QueryClient());

    return (
        // Envolve todos os outros providers com o QueryClientProvider
        <QueryClientProvider client={queryClient}>
            <SessionProvider>
                <ThemeProvider attribute="class" defaultTheme="dark">
                    <SessionAutoSignOut />
                    {children}
                </ThemeProvider>
            </SessionProvider>
        </QueryClientProvider>
    );
};