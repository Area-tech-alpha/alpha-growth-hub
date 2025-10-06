import StatsCards from '@/components/dashboard/leiloes/statsCards'
import { headers } from 'next/headers'

export default async function AdminFinance() {
    const h = await headers()
    const cookieHeader = h.get('cookie') ?? ''
    const host = h.get('x-forwarded-host') ?? h.get('host') ?? 'localhost:3000'
    const protocol = h.get('x-forwarded-proto') ?? 'http'
    const baseUrl = `${protocol}://${host}`
    const res = await fetch(`${baseUrl}/api/admin/finance`, {
        cache: 'no-store',
        headers: cookieHeader ? { cookie: cookieHeader } : undefined,
    })
    if (!res.ok) {
        return <div className="text-sm text-red-600">Falha ao carregar dados financeiros</div>
    }
    const data = await res.json() as { total: number; pix: number; card: number; held: number }

    const formatBRL = (v: number) => v.toLocaleString('pt-BR', { style: 'currency', currency: 'BRL' })

    return (
        <div className="space-y-6">
            <StatsCards
                items={[
                    { title: 'Total recebido', icon: <span className="text-green-600">⬤</span>, contentTitle: formatBRL(data.total), contentDescription: 'Soma de amount_paid' },
                    { title: 'Recebido via PIX', icon: <span className="text-green-600">⬤</span>, contentTitle: formatBRL(data.pix), contentDescription: 'Com asaas_payment_id' },
                    { title: 'Recebido via Crédito', icon: <span className="text-green-600">⬤</span>, contentTitle: formatBRL(data.card), contentDescription: 'Com infinitepay_payment_id' },
                ]}
            />

            <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                <div className="space-y-2">
                    <h2 className="text-base font-semibold">Saldo parado na plataforma</h2>
                    <div className="rounded-md border p-4 text-2xl font-bold text-yellow-600">{formatBRL(data.held)}</div>
                </div>
            </div>
        </div>
    )
}


