import { NextResponse } from "next/server";
import { PrismaClient } from "@prisma/client";

const prisma = new PrismaClient();

const escapeCsvCell = (
  cellData: string | number | null | undefined
): string => {
  if (cellData === null || cellData === undefined) {
    return '""';
  }
  const stringData = String(cellData);

  if (/[",\n\r]/.test(stringData)) {
    return `"${stringData.replace(/"/g, '""')}"`;
  }
  return `"${stringData}"`;
};

export async function GET(
  _request: Request,
  { params }: { params: Promise<{ id: string }> }
) {
  const { id: leadId } = await params;

  if (!leadId) {
    return NextResponse.json(
      { error: "ID do Lead não fornecido" },
      { status: 400 }
    );
  }

  try {
    const lead = await prisma.leads.findUnique({
      where: { id: leadId },
    });

    if (!lead) {
      return NextResponse.json(
        { error: "Lead não encontrado" },
        { status: 404 }
      );
    }

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

    const rec = lead as unknown as Record<string, unknown>;
    const revenueVal = typeof rec["revenue"] === 'string' ? (rec["revenue"] as string) : String(rec["revenue"] ?? "");
    const mktVal = typeof rec["marketing_investment"] === 'string' ? (rec["marketing_investment"] as string) : String(rec["marketing_investment"] ?? "");
    const rowData = [
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
    ];

    const csvContent = [headers.join(","), rowData.join(",")].join("\n");

    const filename = `lead_${lead.company_name.replace(
      /[^a-z0-9]/gi,
      "_"
    )}.csv`;

    return new NextResponse(csvContent, {
      status: 200,
      headers: {
        "Content-Type": "text/csv; charset=utf-8",
        "Content-Disposition": `attachment; filename="${filename}"`,
      },
    });
  } catch (error) {
    console.error("Falha ao exportar lead:", error);
    return NextResponse.json(
      { error: "Erro interno do servidor" },
      { status: 500 }
    );
  }
}
