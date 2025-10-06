import { headers } from 'next/headers'

export default async function AdminInvestorsList() {
    const h = await headers()
    const cookieHeader = h.get('cookie') ?? ''
    const host = h.get('x-forwarded-host') ?? h.get('host') ?? 'localhost:3000'
    const protocol = h.get('x-forwarded-proto') ?? 'http'
    const baseUrl = `${protocol}://${host}`
    const res = await fetch(`${baseUrl}/api/admin/investors`, {
        cache: 'no-store',
        headers: cookieHeader ? { cookie: cookieHeader } : undefined,
    })
    if (!res.ok) {
        return <div className="text-sm text-red-600">Falha ao carregar investidores</div>
    }
    const data = await res.json() as { investors: { userId: string; total: number; name?: string | null; email?: string | null }[] }
    const formatBRL = (v: number) => v.toLocaleString('pt-BR', { style: 'currency', currency: 'BRL' })

    return (
        <div className="space-y-2">
            <h2 className="text-base font-semibold">Investidores em leads</h2>
            <ul className="divide-y rounded-md border">
                {(data.investors ?? []).map((inv, idx) => (
                    <li key={`inv-${inv.userId}-${idx}`} className="flex items-center justify-between p-3 text-sm">
                        <span className="truncate max-w-[70%]">{inv.name || inv.email || inv.userId || '—'}</span>
                        <span className="font-medium">{formatBRL(inv.total)}</span>
                    </li>
                ))}
                {(!data.investors || data.investors.length === 0) && (
                    <li className="p-3 text-sm text-muted-foreground">Sem dados</li>
                )}
            </ul>
        </div>
    )
}


