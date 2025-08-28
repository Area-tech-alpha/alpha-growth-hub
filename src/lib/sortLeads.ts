import { Lead } from "@/components/dashboard/leads/types";

export function sortLeads(leads: Lead[]): Lead[] {
    return leads.sort((a, b) => {
        if (a.status === 'hot' && b.status !== 'hot') {
            return -1;
        }
        if (b.status === 'hot' && a.status !== 'hot') {
            return 1;
        }

        const dateA = a.created_at ? new Date(a.created_at as string).getTime() : 0;
        const dateB = b.created_at ? new Date(b.created_at as string).getTime() : 0;
        return dateB - dateA;
    });
}
