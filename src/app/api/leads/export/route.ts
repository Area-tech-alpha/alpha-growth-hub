import { NextResponse } from "next/server";
import { getServerSession } from "next-auth/next";
import { authOptions } from "../../../../../auth";
import { prisma } from "@/lib/prisma";

const escapeCsvCell = (
    cellData: string | number | null | undefined
): string => {
    if (cellData === null || cellData === undefined) {
        return "\"\"";
    }
    const stringData = String(cellData);
    if (/[",\n\r]/.test(stringData)) {
        return `"${stringData.replace(/"/g, '""')}"`;
    }
    return `"${stringData}"`;
};

export async function GET() {
    try {
        const session = await getServerSession(authOptions);
        const userId = session?.user?.id;
        if (!userId) {
            return NextResponse.json({ error: "Não autenticado" }, { status: 401 });
        }

        const leads = await prisma.leads.findMany({
            where: { owner_id: userId },
            orderBy: { updated_at: "desc" },
        });

        const headers = [
            "Nome",
            "Descrição",
            "Canal",
            "Faturamento",
            "Investimento em Marketing",
            "Nome da Empresa",
            "Nome do Contato",
            "CNPJ",
            "Estado",
            "Cidade",
            "Telefone",
            "Email",
            "Documento (URL)",
            "Contrato (URL)",
        ];

        const rows = leads.map((lead) => {
            const rec = lead as unknown as Record<string, unknown>;
            const revenueVal = typeof rec["revenue"] === "string" ? (rec["revenue"] as string) : String(rec["revenue"] ?? "");
            const mktVal = typeof rec["marketing_investment"] === "string" ? (rec["marketing_investment"] as string) : String(rec["marketing_investment"] ?? "");
            return [
                escapeCsvCell((rec["name"] as string) ?? null),
                escapeCsvCell((rec["description"] as string) ?? null),
                escapeCsvCell((rec["channel"] as string) ?? null),
                escapeCsvCell(revenueVal),
                escapeCsvCell(mktVal),
                escapeCsvCell((rec["company_name"] as string) ?? null),
                escapeCsvCell((rec["contact_name"] as string) ?? null),
                escapeCsvCell((rec["cnpj"] as string) ?? null),
                escapeCsvCell((rec["state"] as string) ?? null),
                escapeCsvCell((rec["city"] as string) ?? null),
                escapeCsvCell((rec["phone"] as string) ?? null),
                escapeCsvCell((rec["email"] as string) ?? null),
                escapeCsvCell((rec["document_url"] as string) ?? null),
                escapeCsvCell((rec["contract_url"] as string) ?? null),
            ].join(",");
        });

        const csvContent = [headers.join(","), ...rows].join("\n");
        const filename = `meus_leads_${new Date().toISOString().slice(0, 10)}.csv`;

        return new NextResponse(`\uFEFF${csvContent}`, {
            status: 200,
            headers: {
                "Content-Type": "text/csv; charset=utf-8",
                "Content-Disposition": `attachment; filename="${filename}"`,
            },
        });
    } catch (error) {
        console.error("Falha ao exportar todos os leads:", error);
        return NextResponse.json({ error: "Erro interno do servidor" }, { status: 500 });
    }
}


