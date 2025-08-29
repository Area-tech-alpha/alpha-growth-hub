// src/app/api/leads/purchased/route.ts

import { NextResponse } from 'next/server';
import { createClient } from '@/utils/supabase/server';

export async function GET(request: Request) {
  try {
    const supabase = await createClient();

    const { data: { user } } = await supabase.auth.getUser();
    if (!user) {
      return NextResponse.json({ error: 'Não autorizado' }, { status: 401 });
    }

    const { data: purchasedLeads, error } = await supabase
      .from('leads')
      .select('*')
      .eq('owner_id', user.id);

    if (error) throw error;

    // Mapeia para o formato esperado pelo frontend
    const responseData = purchasedLeads.map(lead => ({
      // A data e o preço da compra precisariam de uma lógica mais complexa
      // envolvendo a busca pelo lance vencedor. Por enquanto, usamos placeholders.
      purchaseDate: lead.updated_at, 
      purchasePrice: lead.minimum_value, 
      lead: {
        id: lead.id,
        name: `Lead: ${lead.segment}`,
        companyName: lead.company_name, // Dados completos
        contactName: lead.contact_name, // Dados completos
        phone: lead.phone,
        email: lead.email,
        revenue: lead.revenue,
        marketingInvestment: lead.marketing_investment,
        location: lead.location,
        segment: lead.segment,
      }
    }));

    return NextResponse.json(responseData);

  } catch (error) {
    const errorMessage = error instanceof Error ? error.message : 'Erro interno do servidor';
    console.error("Erro em /api/leads/purchased:", errorMessage);
    return NextResponse.json({ error: errorMessage }, { status: 500 });
  }
}