import { NextResponse } from "next/server";

export async function GET(request: Request) {
  console.log("A ROTA /api/profile/user FOI ACESSADA COM SUCESSO!");

  return NextResponse.json({
    message: "API está funcionando!",
    timestamp: new Date().toISOString(),
  });
}
