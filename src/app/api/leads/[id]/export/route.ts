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
      "Nome da Empresa",
      "Nome do Contato",
      "Telefone",
      "Email",
      "Estado",
      "Cidade",
      "Nicho",
      "Faturamento Anual (R$)",
      "Investimento em Marketing (R$)",
      "CNPJ",

    ];

    const rowData = [
      escapeCsvCell(lead.company_name),
      escapeCsvCell(lead.contact_name),
      escapeCsvCell(lead.phone),
      escapeCsvCell(lead.email),
      escapeCsvCell(lead.state),
      escapeCsvCell(lead.city),
      escapeCsvCell(typeof lead.revenue === 'string' ? lead.revenue : String(lead.revenue)),
      escapeCsvCell(typeof lead.marketing_investment === 'string' ? lead.marketing_investment : String(lead.marketing_investment)),
      escapeCsvCell(lead.cnpj),
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
