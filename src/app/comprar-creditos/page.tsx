'use client';

import Link from "next/link";
import { useSearchParams } from "next/navigation";
import { useEffect, useRef, useState } from "react";

export default function ComprarCreditosPage() {
    const searchParams = useSearchParams();
    const status = searchParams.get('status')?.toLowerCase();
    const [message, setMessage] = useState<{ title: string, subtitle: string }>({
        title: 'Comprar Créditos',
        subtitle: 'Escolha o valor e conclua seu pagamento pelo Asaas.',
    });
    const [isLoading, setIsLoading] = useState(true);
    const timeoutRef = useRef<number | null>(null);

    useEffect(() => {
        if (timeoutRef.current) {
            window.clearTimeout(timeoutRef.current);
            timeoutRef.current = null;
        }

        if (status) {
            if (status === 'cancelled') {
                setMessage({
                    title: 'Pagamento cancelado',
                    subtitle: 'Você pode tentar novamente quando quiser.',
                });
            } else if (status === 'expired') {
                setMessage({
                    title: 'Pagamento expirado',
                    subtitle: 'O link de pagamento expirou. Gere um novo para continuar.',
                });
            } else {
                setMessage({
                    title: 'Comprar Créditos',
                    subtitle: 'Escolha o valor e conclua seu pagamento pelo Asaas.',
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
                        <Link href="/" className="px-4 py-2 rounded bg-yellow-500 text-black hover:bg-yellow-400 transition">Voltar ao Dashboard</Link>
                    </>
                )}
            </div>
        </div>
    );
}


