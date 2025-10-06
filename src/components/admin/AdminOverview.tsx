import StatsCards from '@/components/dashboard/leiloes/statsCards'

type Ranked = { userId: string | null; count: number; name?: string | null; email?: string | null }

export default function AdminOverview({
    enteredCount,
    soldCount,
    topBuyers,
    topBidders,
}: {
    enteredCount: number
    soldCount: number
    topBuyers: Ranked[]
    topBidders: Ranked[]
}) {
    return (
        <div className="space-y-6">
            <StatsCards
                items={[
                    { title: 'Leads que entraram', icon: <span className="text-yellow-600">⬤</span>, contentTitle: String(enteredCount), contentDescription: 'Total de leads que entraram' },
                    { title: 'Leads vendidos', icon: <span className="text-yellow-600">⬤</span>, contentTitle: String(soldCount), contentDescription: 'Total de leads vendidos' },
                ]}
            />

            <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                <div className="space-y-2">
                    <h2 className="text-base font-semibold">Top compradores</h2>
                    <ul className="divide-y rounded-md border">
                        {(topBuyers ?? []).map((b, idx) => (
                            <li key={`buyer-${b.userId}-${idx}`} className="flex items-center justify-between p-3 text-sm">
                                <span className="truncate max-w-[70%]">{b.name || b.email || b.userId || '—'}</span>
                                <span className="font-medium">{b.count}</span>
                            </li>
                        ))}
                        {(!topBuyers || topBuyers.length === 0) && (
                            <li className="p-3 text-sm text-muted-foreground">Sem dados</li>
                        )}
                    </ul>
                </div>
                <div className="space-y-2">
                    <h2 className="text-base font-semibold">Top lances</h2>
                    <ul className="divide-y rounded-md border">
                        {(topBidders ?? []).map((b, idx) => (
                            <li key={`bidder-${b.userId}-${idx}`} className="flex items-center justify-between p-3 text-sm">
                                <span className="truncate max-w-[70%]">{b.name || b.email || b.userId || '—'}</span>
                                <span className="font-medium">{b.count}</span>
                            </li>
                        ))}
                        {(!topBidders || topBidders.length === 0) && (
                            <li className="p-3 text-sm text-muted-foreground">Sem dados</li>
                        )}
                    </ul>
                </div>
            </div>
        </div>
    )
}


