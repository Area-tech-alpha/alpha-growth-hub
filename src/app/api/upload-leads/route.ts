// app/api/upload-leads/route.ts

import { NextRequest, NextResponse } from 'next/server';
import { createClient } from '@supabase/supabase-js';
import Papa from 'papaparse';

const supabase = createClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.SUPABASE_SERVICE_ROLE_KEY!
);

// (A tipagem CsvLeadRow e a função parseToNumber continuam as mesmas)
type CsvLeadRow = {
    Nome?: string;
    Email?: string;
    Telefone?: string;
    Empresa?: string;
    Faturamento?: string;
    Investimento?: string;
    Estado?: string;
    Cidade?: string;
    CNPJ?: string;
};
const parseToNumber = (value: string | undefined): number | null => {
    if (!value) return null;
    const cleanedValue = value.replace(/[^0-9,.-]/g, '').replace(',', '.');
    const number = parseFloat(cleanedValue);
    return isNaN(number) ? null : number;
};


export async function POST(request: NextRequest) {
    try {
        const formData = await request.formData();
        const file = formData.get('file') as File;
        const quantityToInsert = formData.get('quantity') as string; // Recebe a quantidade

        // Validação da quantidade
        const limit = parseInt(quantityToInsert, 10);
        if (isNaN(limit) || limit <= 0) {
            return NextResponse.json({ error: 'A quantidade de leads para inserir deve ser um número maior que zero.' }, { status: 400 });
        }

        if (!file) {
            return NextResponse.json({ error: 'Nenhum arquivo enviado.' }, { status: 400 });
        }

        const csvContent = await file.text();
        const parseResult = Papa.parse<CsvLeadRow>(csvContent, {
            header: true,
            skipEmptyLines: true,
        });

        const csvData = parseResult.data;

        if (!csvData || csvData.length === 0) {
            return NextResponse.json({ error: 'O arquivo CSV está vazio ou em formato inválido.' }, { status: 400 });
        }

        // --- Lógica de inserção com limite ---
        let insertedCount = 0;
        const insertedEmails: string[] = [];

        for (const csvRow of csvData) {
            // Se já atingimos o limite, paramos o loop
            if (insertedCount >= limit) {
                break;
            }

            const email = csvRow.Email;
            if (!email) continue;

            const { data: existingLead } = await supabase
                .from('leads')
                .select('email')
                .eq('email', email)
                .single();

            if (existingLead) {
                console.log(`E-mail já existe, pulando: ${email}`);
                continue;
            }

            const leadToInsert = {
                contact_name: csvRow.Nome,
                email: csvRow.Email,
                phone: csvRow.Telefone,
                company_name: csvRow.Empresa,
                revenue: parseToNumber(csvRow.Faturamento),
                marketing_investment: parseToNumber(csvRow.Investimento),
                state: csvRow.Estado,
                city: csvRow.Cidade,
                cnpj: csvRow.CNPJ
            };

            const { error: insertError } = await supabase
                .from('leads')
                .insert(leadToInsert);

            if (insertError) {
                console.error(`Erro ao inserir o lead ${email}:`, insertError.message);
                // Se um der erro, podemos pular para o próximo em vez de parar tudo
                continue;
            }

            // Sucesso! Incrementa o contador e guarda o e-mail
            insertedCount++;
            insertedEmails.push(email);
            console.log(`Inserido com sucesso (${insertedCount}/${limit}): ${email}`);
        }

        // --- Resposta final ---
        if (insertedCount === 0) {
            return NextResponse.json({
                message: 'Nenhum lead novo para adicionar. Todos os e-mails do arquivo já estão cadastrados.'
            });
        }

        return NextResponse.json({
            message: `Operação concluída. ${insertedCount} de ${limit} leads solicitados foram registrados com sucesso.`,
            emails: insertedEmails
        });

    } catch (error) {
        console.error('Erro inesperado na API:', error);
        const errorMessage = error instanceof Error ? error.message : 'Erro desconhecido';
        return NextResponse.json({ error: 'Ocorreu um erro no servidor.', details: errorMessage }, { status: 500 });
    }
}