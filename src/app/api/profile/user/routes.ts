import { NextResponse } from "next/server";
import { createClient } from "@/utils/supabase/server";

export async function GET(request: Request) {
  try {
    const supabase = await createClient();

    const {
      data: { user },
      error: authError,
    } = await supabase.auth.getUser();

    if (authError || !user) {
      return NextResponse.json({ error: "Não autorizado" }, { status: 401 });
    }

    const { data: userProfile, error: profileError } = await supabase
      .from("users")
      .select("credit_balance")
      .eq("id", user.id)
      .single();

    if (profileError) {
      console.error("Perfil não encontrado no banco:", profileError.message);
      return NextResponse.json(
        { error: "Perfil de usuário não encontrado." },
        { status: 404 }
      );
    }
    const responseData = {
      id: user.id,
      name: user.user_metadata.name || user.email,
      email: user.email,
      creditBalance: userProfile.credit_balance,
    };

    return NextResponse.json(responseData);
  } catch (error) {
    const errorMessage =
      error instanceof Error ? error.message : "Erro interno do servidor";
    console.error("Erro em /api/user/profile:", errorMessage);
    return NextResponse.json({ error: errorMessage }, { status: 500 });
  }
}
