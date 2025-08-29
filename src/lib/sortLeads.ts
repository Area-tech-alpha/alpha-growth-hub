import type { Lead } from "@prisma/client";

export function sortLeads(leads: Lead[]): Lead[] {
  return leads.sort((a, b) => {
    if (a.status === "hot" && b.status !== "hot") {
      return -1;
    }
    if (b.status === "hot" && a.status !== "hot") {
      return 1;
    }

    const dateA = a.createdAt ? a.createdAt.getTime() : 0;
    const dateB = b.createdAt ? b.createdAt.getTime() : 0;

    return dateB - dateA;
  });
}
