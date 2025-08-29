import { NextResponse } from "next/server";
import { createClient } from "@/utils/supabase/server";

export async function GET(request: Request) {
  try {
    const supabase = await createClient();

    const {
      data: { user },
    } = await supabase.auth.getUser();
    if (!user) {
      return NextResponse.json({ error: "Não autorizado" }, { status: 401 });
    }

    const { data: purchasedLeads, error } = await supabase
      .from("leads")
      .select("*")
      .eq("owner_id", user.id);

    if (error) throw error;

    const responseData = purchasedLeads.map((lead) => ({
      purchaseDate: lead.updated_at,
      purchasePrice: lead.minimum_value,
      lead: {
        id: lead.id,
        name: `Lead: ${lead.segment}`,
        companyName: lead.company_name,
        contactName: lead.contact_name,
        phone: lead.phone,
        email: lead.email,
        revenue: lead.revenue,
        marketingInvestment: lead.marketing_investment,
        location: lead.location,
        segment: lead.segment,
      },
    }));

    return NextResponse.json(responseData);
  } catch (error) {
    const errorMessage =
      error instanceof Error ? error.message : "Erro interno do servidor";
    console.error("Erro em /api/leads/purchased:", errorMessage);
    return NextResponse.json({ error: errorMessage }, { status: 500 });
  }
}
