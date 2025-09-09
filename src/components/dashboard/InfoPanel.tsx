"use client";

import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Separator } from "@/components/ui/separator";
import { Badge } from "@/components/ui/badge";

export default function InfoPanel() {
    return (
        <div className="container mx-auto px-0 sm:px-0">
            <Card>
                <CardHeader>
                    <CardTitle className="text-2xl">Como funciona a plataforma</CardTitle>
                    <CardDescription>
                        Uma visão rápida e prática para você usar os leilões e comprar leads com segurança.
                    </CardDescription>
                </CardHeader>
                <CardContent className="space-y-6">
                    <section className="space-y-2">
                        <h3 className="text-lg font-semibold">O que é</h3>
                        <p className="text-muted-foreground">
                            Leilões de leads qualificados. Você utiliza seus créditos para dar lances e adquirir o lead. Também é
                            possível usar o &quot;Comprar já!&quot; para encerrar o leilão imediatamente.
                        </p>
                    </section>

                    <Separator />

                    <section className="space-y-2">
                        <h3 className="text-lg font-semibold">Como participar</h3>
                        <ul className="list-disc pl-5 space-y-1 text-muted-foreground">
                            <li>Adicione créditos no painel de Créditos.</li>
                            <li>Escolha um leilão e faça seu lance.</li>
                            <li>
                                Se preferir, use o <span className="font-medium">Comprar já!</span> (1,5× o lance mínimo) para ganhar na hora.
                            </li>
                        </ul>
                    </section>

                    <Separator />

                    <section className="space-y-2">
                        <h3 className="text-lg font-semibold">Regras dos leilões</h3>
                        <ul className="list-disc pl-5 space-y-1 text-muted-foreground">
                            <li>Enquanto o leilão estiver aberto, você verá lances em tempo real.</li>
                            <li>Ao usar &quot;Comprar já!&quot;, o leilão é encerrado imediatamente para todos.</li>
                            <li>O vencedor tem o valor debitado; os demais têm os holds liberados.</li>
                            <li>Anti-snipe: se houver um lance com menos de 1 minuto restante, o cronômetro volta para 1 minuto.</li>
                            <li>Se houver novo lance com menos de 30 segundos restantes, o cronômetro volta para 30 segundos.</li>
                        </ul>
                    </section>

                    <Separator />

                    <section className="space-y-2">
                        <h3 className="text-lg font-semibold">Créditos e holds</h3>
                        <ul className="list-disc pl-5 space-y-1 text-muted-foreground">
                            <li>Seu saldo considera créditos em hold (reservados por lances ativos).</li>
                            <li>Perdeu o leilão? O hold é liberado automaticamente.</li>
                            <li>Ganhou? O valor é debitado do seu saldo.</li>
                        </ul>
                    </section>

                    <Separator />

                    <section className="space-y-2">
                        <h3 className="text-lg font-semibold">Recebimento do lead</h3>
                        <ul className="list-disc pl-5 space-y-1 text-muted-foreground">
                            <li>O lead aparece em &quot;Meus Leads&quot; em tempo real após a vitória.</li>
                            <li>Você pode exportar todos os leads em CSV quando quiser.</li>
                        </ul>
                    </section>

                    <Separator />

                    <section className="space-y-2">
                        <h3 className="text-lg font-semibold">Pagamentos e segurança</h3>
                        <ul className="list-disc pl-5 space-y-1 text-muted-foreground">
                            <li>Processamos webhooks de pagamento com segurança e idempotência.</li>
                            <li>Em caso de falha, você verá o status e nada é confirmado indevidamente.</li>
                        </ul>
                    </section>

                    <section className="space-y-2">
                        <h3 className="text-lg font-semibold flex items-center gap-2">Dicas rápidas <Badge variant="secondary">Recomendado</Badge></h3>
                        <ul className="list-disc pl-5 space-y-1 text-muted-foreground">
                            <li>Use filtros para encontrar leads por região e faixa de faturamento.</li>
                            <li>Acompanhe seu saldo de créditos e histórico de compras.</li>
                            <li>Prefira &quot;Comprar já!&quot; quando quiser garantir o lead imediatamente.</li>
                        </ul>
                    </section>

                    <Separator />

                    <section className="space-y-2">
                        <h3 className="text-lg font-semibold">Precisa de ajuda?</h3>
                        <p className="text-muted-foreground">
                            Entre em contato com o suporte. Estamos aqui para ajudar.
                        </p>
                    </section>
                </CardContent>
            </Card>
        </div>
    );
}


