'use client';

import React, { useState, useEffect } from 'react';
import { createClient } from '@supabase/supabase-js';

// Crie uma instância do cliente Supabase fora do componente
const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL!;
const supabaseAnonKey = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!;
const supabase = createClient(supabaseUrl, supabaseAnonKey);

// Interface para definir a estrutura de um Lead
interface Lead {
    id: string;
    name: string;
    details: string;
    expires_at: string; // O Supabase envia timestamps como strings ISO
}

// Componente de contagem regressiva
const CountdownTimer = ({ expiresAt, onExpire }: { expiresAt: string; onExpire: () => void }) => {
    const expirationTime = new Date(expiresAt).getTime();
    const [timeLeft, setTimeLeft] = useState(expirationTime - Date.now());

    useEffect(() => {
        const interval = setInterval(() => {
            const remaining = expirationTime - Date.now();
            if (remaining <= 0) {
                clearInterval(interval);
                setTimeLeft(0);
                onExpire(); // Notifica o componente pai que o tempo acabou
            } else {
                setTimeLeft(remaining);
            }
        }, 1000);

        return () => clearInterval(interval);
    }, [expiresAt, onExpire, expirationTime]);

    const minutes = Math.floor((timeLeft / 1000) / 60);
    const seconds = Math.floor((timeLeft / 1000) % 60);

    return (
        <span className="font-mono bg-blue-500 text-white px-2 py-1 rounded text-sm">
            {String(minutes).padStart(2, '0')}:{String(seconds).padStart(2, '0')}
        </span>
    );
};


export default function RealtimeLeads() {
    const [activeLeads, setActiveLeads] = useState<Lead[]>([]);

    useEffect(() => {
        // Função para buscar leads que ainda não expiraram ao carregar a página
        const fetchInitialLeads = async () => {
            const { data, error } = await supabase
                .from('leads')
                .select('*')
                .gt('expires_at', new Date().toISOString()); // gt = greater than

            if (error) {
                console.error("Erro ao buscar leads iniciais:", error);
            } else if (data) {
                setActiveLeads(data);
            }
        };

        fetchInitialLeads();

        // Configura a inscrição para ouvir novos leads
        const channel = supabase.channel('realtime-leads');

        channel
            .on('postgres_changes', {
                event: 'INSERT',
                schema: 'public',
                table: 'leads'
            }, (payload) => {
                console.log('Novo lead recebido!', payload.new);
                // Adiciona o novo lead à lista de leads ativos
                setActiveLeads(prevLeads => [...prevLeads, payload.new as Lead]);
            })
            .subscribe();

        // Limpeza: remove a inscrição quando o componente é desmontado
        return () => {
            supabase.removeChannel(channel);
        };
    }, []);

    // Função para remover um lead da UI quando seu tempo expira
    const handleExpire = (leadId: string) => {
        setActiveLeads(prevLeads => prevLeads.filter(lead => lead.id !== leadId));
    };

    return (
        <div className="p-4 border rounded-lg space-y-4 max-w-2xl mx-auto">
            <h2 className="text-2xl font-bold text-center">Leads Disponíveis</h2>
            {activeLeads.length === 0 ? (
                <p className="text-muted-foreground text-center py-8">Nenhum lead disponível no momento...</p>
            ) : (
                <ul className="space-y-3">
                    {activeLeads.map(lead => (
                        <li key={lead.id} className="p-4 bg-card border rounded-md shadow-sm">
                            <div className="flex justify-between items-start">
                                <div>
                                    <h3 className="font-bold text-lg">{lead.name}</h3>
                                    <p className="text-muted-foreground">{lead.details}</p>
                                </div>
                                <CountdownTimer
                                    expiresAt={lead.expires_at}
                                    onExpire={() => handleExpire(lead.id)}
                                />
                            </div>
                        </li>
                    ))}
                </ul>
            )}
        </div>
    );
}
