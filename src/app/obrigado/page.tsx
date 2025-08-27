"use client";

import Link from "next/link";
import { useSearchParams } from "next/navigation";
import { useEffect, useRef, useState } from "react";

export default function ObrigadoPage() {
    const searchParams = useSearchParams();
    const status = searchParams.get('status')?.toLowerCase();

    const [message, setMessage] = useState<{ title: string; subtitle: string }>({
        title: 'Obrigado',
        subtitle: 'Recebemos seu retorno.',
    });
    const [isLoading, setIsLoading] = useState(true);
    const timeoutRef = useRef<number | null>(null);

    useEffect(() => {
        if (timeoutRef.current) {
            window.clearTimeout(timeoutRef.current);
            timeoutRef.current = null;
        }

        if (status) {
            if (status === 'success') {
                setMessage({
                    title: 'Pagamento confirmado!',
                    subtitle: 'Seus créditos foram adicionados. Você já pode usar a plataforma.',
                });
            } else {
                setMessage({
                    title: 'Obrigado',
                    subtitle: 'Recebemos seu retorno.',
                });
            }
            setIsLoading(false);
            return;
        }

        timeoutRef.current = window.setTimeout(() => {
            setIsLoading(false);
        }, 600);

        return () => {
            if (timeoutRef.current) {
                window.clearTimeout(timeoutRef.current);
            }
        };
    }, [status]);

    return (
        <div className="min-h-screen flex flex-col items-center justify-center bg-black relative overflow-hidden">
            <div className="absolute inset-0 z-0" style={{
                background: 'radial-gradient(circle at 50% 35%, rgba(255, 200, 0, 0.18) 0%, rgba(0,0,0,0.95) 70%)'
            }} />
            <div className="relative z-10 flex flex-col items-center w-full max-w-md text-center">
                {isLoading ? (
                    <p className="text-gray-400">Carregando...</p>
                ) : (
                    <>
                        <h1 className="text-2xl md:text-3xl font-semibold text-white mb-2">{message.title}</h1>
                        <p className="text-gray-300 mb-6">{message.subtitle}</p>
                        <Link href="/" className="px-4 py-2 rounded bg-yellow-500 text-black hover:bg-yellow-400 transition">Ir para o Dashboard</Link>
                    </>
                )}
            </div>
        </div>
    );
}


