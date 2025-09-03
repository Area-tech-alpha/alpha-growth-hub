// app/obrigado/page.tsx
"use client";

import Link from "next/link";
import { useSearchParams } from "next/navigation";
import { Suspense, useEffect, useState } from "react";
import useSWR from 'swr';

// Função auxiliar para o SWR fazer as requisições
const fetcher = (url: string) => fetch(url).then(res => res.json());

function ObrigadoContent() {
    const searchParams = useSearchParams();
    // Pegamos o checkoutId, que é nosso identificador único da transação
    const checkoutId = searchParams.get('checkoutId');

    const [uiState, setUiState] = useState<{ title: string; subtitle: string; loading: boolean }>({
        title: 'Verificando seu pagamento...',
        subtitle: 'Por favor, aguarde um instante.',
        loading: true,
    });

    // SWR vai chamar nossa API a cada 3 segundos para verificar o status
    const { data, error } = useSWR(
        checkoutId ? `/api/check-status?checkoutId=${checkoutId}` : null,
        fetcher,
        {
            refreshInterval: 3000, // 3 segundos
            revalidateOnFocus: false,
            revalidateOnReconnect: false,
        }
    );

    useEffect(() => {
        // Estado de erro na API
        if (error) {
            setUiState({
                title: 'Ocorreu um problema',
                subtitle: 'Não foi possível verificar o status do seu pagamento. Por favor, contate o suporte.',
                loading: false,
            });
            return;
        }

        // A API retornou que o processamento foi concluído com sucesso
        if (data?.status === 'SUCCESS') {
            setUiState({
                title: 'Pagamento confirmado! 🎉',
                subtitle: 'Seus créditos foram adicionados com sucesso. Você já pode usar a plataforma.',
                loading: false,
            });
        }
        // A API retornou que o pagamento ainda está pendente de processamento no nosso sistema
        else if (data?.status === 'PENDING') {
            setUiState({
                title: 'Pagamento aprovado!',
                subtitle: 'Estamos processando seus créditos. Esta página será atualizada automaticamente.',
                loading: true, // Mantém o visual de "carregando"
            });
        }

    }, [data, error]);

    // O SWR ainda está na primeira requisição (isLoading não está disponível diretamente no SWR v2, então usamos nosso próprio estado)
    if (!data && !error && uiState.loading) {
        return (
            <div className="flex flex-col items-center text-center">
                <svg className="animate-spin h-8 w-8 text-yellow-500 mb-4" xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24">
                    <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4"></circle>
                    <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z"></path>
                </svg>
                <h1 className="text-2xl md:text-3xl font-semibold text-white mb-2">{uiState.title}</h1>
                <p className="text-gray-300 mb-6">{uiState.subtitle}</p>
            </div>
        );
    }

    // Renderização final (Sucesso ou Erro)
    return (
        <>
            <h1 className="text-2xl md:text-3xl font-semibold text-white mb-2">{uiState.title}</h1>
            <p className="text-gray-300 mb-6">{uiState.subtitle}</p>
            <Link href="/" className="px-4 py-2 rounded bg-yellow-500 text-black hover:bg-yellow-400 transition">
                Ir para o Dashboard
            </Link>
        </>
    );
}

// Componente principal da página, com Suspense para carregar os parâmetros da URL
export default function ObrigadoPage() {
    return (
        <div className="min-h-screen flex flex-col items-center justify-center bg-black relative overflow-hidden">
            <div className="absolute inset-0 z-0" style={{
                background: 'radial-gradient(circle at 50% 35%, rgba(255, 200, 0, 0.18) 0%, rgba(0,0,0,0.95) 70%)'
            }} />
            <div className="relative z-10 flex flex-col items-center w-full max-w-md text-center">
                <Suspense fallback={<p className="text-gray-400">Carregando...</p>}>
                    <ObrigadoContent />
                </Suspense>
            </div>
        </div>
    );
}