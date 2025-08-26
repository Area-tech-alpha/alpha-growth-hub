'use client';

import { signIn, signOut, useSession } from 'next-auth/react';
import React from 'react';
import Image from 'next/image';

const GoogleIcon = () => (
    <svg width="20" height="20" viewBox="0 0 24 24" fill="none" xmlns="http://www.w3.org/2000/svg">
        <path d="M22.56 12.25C22.56 11.45 22.48 10.65 22.34 9.87H12.24V14.48H18.04C17.73 16.01 16.85 17.32 15.48 18.24V21.09H19.5C21.46 19.13 22.56 15.99 22.56 12.25Z" fill="#4285F4" />
        <path d="M12.24 23.99C15.41 23.99 18.04 22.92 19.5 21.09L15.48 18.24C14.46 18.94 13.43 19.34 12.24 19.34C9.93 19.34 7.96 17.89 7.24 15.85H3.06V18.79C4.75 22.09 8.22 23.99 12.24 23.99Z" fill="#34A853" />
        <path d="M7.24 15.85C7 15.25 6.83 14.62 6.83 13.99C6.83 13.36 7 12.73 7.24 12.13V9.19H3.06C2.25 10.83 1.73 12.56 1.73 13.99C1.73 15.42 2.25 17.15 3.06 18.79L7.24 15.85Z" fill="#FBBC05" />
        <path d="M12.24 8.64C13.55 8.64 14.63 9.12 15.52 9.95L19.58 6.01C18.04 4.57 15.41 3.5 12.24 3.5C8.22 3.5 4.75 5.9 3.06 9.19L7.24 12.13C7.96 10.09 9.93 8.64 12.24 8.64Z" fill="#EA4335" />
    </svg>
);

export default function AuthButtons() {
    const { data: session, status } = useSession();
    const [isRedirecting, setIsRedirecting] = React.useState(false);

    if (status === 'loading') {
        return <p className="text-sm text-muted-foreground">Carregando...</p>;
    }

    if (session) {
        return (
            <div className="flex items-center gap-3">
                {session.user?.image && (
                    <Image
                        src={session.user.image}
                        alt={session.user.name || "User avatar"}
                        width={40}
                        height={40}
                        className="rounded-full"
                    />
                )}
                <div>
                    <p className="text-sm font-medium">Logado como {session.user?.name}</p>
                    <button
                        onClick={async () => { setIsRedirecting(true); await signOut({ callbackUrl: '/login' }); }}
                        className="text-xs text-muted-foreground hover:underline disabled:opacity-50"
                        disabled={isRedirecting}
                    >
                        {isRedirecting ? 'Saindo…' : 'Sair'}
                    </button>
                </div>
            </div>
        );
    }

    return (
        <button
            onClick={async () => { setIsRedirecting(true); await signIn('google', { callbackUrl: '/' }); }}
            className="
        px-4 py-2 border flex items-center justify-center gap-3 
        border-slate-200 rounded-lg 
        text-slate-700 
        hover:border-slate-400 
        hover:text-slate-900 
        hover:shadow transition duration-150
        bg-white disabled:opacity-50
      "
            disabled={isRedirecting}
        >
            <GoogleIcon />
            <span className="font-semibold">{isRedirecting ? 'Redirecionando…' : 'Entrar com o Google'}</span>
        </button>
    );
}
