"use client";

import React from "react";
import { FiShoppingBag } from "react-icons/fi";

import { LeadForAuction } from "@/lib/custom-types";

interface MeusLeadsPanelProps {
  initialPurchasedLeads: LeadForAuction[];
}

export default function MeusLeadsPanel({
  initialPurchasedLeads,
}: MeusLeadsPanelProps) {
  const purchasedLeads = initialPurchasedLeads || [];

  return (
    <>
      <div className="flex items-center justify-between mb-6">
        <div>
          <h2 className="text-2xl font-bold text-foreground">
            Meus Leads Comprados
          </h2>
          <p className="text-muted-foreground">
            Leads que você adquiriu nos leilões com informações completas
          </p>
        </div>
        <div className="text-right">
          <div className="text-2xl font-bold text-yellow-600">
            {purchasedLeads.length || 0}
          </div>
          <div className="text-sm text-muted-foreground">leads comprados</div>
        </div>
      </div>

      {purchasedLeads.length > 0 ? (
        <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
          {purchasedLeads.map((lead) => (
            <div
              key={lead.id}
              className="p-4 border rounded-lg bg-card text-card-foreground"
            >
              <h3 className="font-semibold text-lg">{lead.companyName}</h3>
              <p className="text-sm text-muted-foreground mb-2">
                {lead.segment}
              </p>
              <div className="border-t pt-2 mt-2 text-sm">
                <p>
                  <strong>Contato:</strong> {lead.contactName}
                </p>
                <p>
                  <strong>Email:</strong> {lead.email}
                </p>
                <p>
                  <strong>Telefone:</strong> {lead.phone}
                </p>
              </div>
            </div>
          ))}
        </div>
      ) : (
        <div className="text-center py-12 border-2 border-dashed rounded-lg">
          <FiShoppingBag className="h-16 w-16 text-muted-foreground/50 mx-auto mb-4" />
          <div className="text-muted-foreground text-lg mb-2">
            Nenhum lead comprado ainda
          </div>
          <p className="text-muted-foreground">
            Participe dos leilões para adquirir leads qualificados
          </p>
        </div>
      )}
    </>
  );
}
