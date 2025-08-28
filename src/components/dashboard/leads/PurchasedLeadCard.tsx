
import { Phone, Mail, Building, DollarSign, Megaphone, Target, Clock, MapPin } from 'lucide-react';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Lead } from './types';

interface PurchasedLeadCardProps {
    lead: Lead;
    purchaseDate: Date;
    purchasePrice: number;
}

export const PurchasedLeadCard = ({ lead, purchaseDate, purchasePrice }: PurchasedLeadCardProps) => {
    const formatCurrency = (value: number) => {
        return new Intl.NumberFormat('pt-BR', {
            style: 'currency',
            currency: 'BRL',
            minimumFractionDigits: 0,
            maximumFractionDigits: 0,
        }).format(value);
    };

    const formatDate = (date: Date) => {
        return new Intl.DateTimeFormat('pt-BR', {
            day: '2-digit',
            month: '2-digit',
            year: 'numeric',
            hour: '2-digit',
            minute: '2-digit',
        }).format(date);
    };

    return (
        <Card className="hover:shadow-lg transition-all duration-200 border border-border bg-card text-card-foreground">
            <CardHeader className="pb-2">
                <div className="flex justify-between items-start">
                    <div className="flex-1">
                        <CardTitle className="text-lg font-bold text-yellow-600 mb-1">
                            {lead.name}
                        </CardTitle>
                        <div className="flex items-center gap-2 text-sm text-muted-foreground mb-1">
                            <MapPin className="h-4 w-4" />
                            {lead.location}
                        </div>
                    </div>
                    <div className="text-right">
                        <div className="text-sm text-muted-foreground">Comprado por</div>
                        <div className="text-lg font-bold text-yellow-600">{formatCurrency(purchasePrice)}</div>
                    </div>
                </div>

                <div className="flex items-center gap-2 mt-1">
                    <Badge variant="secondary">{lead.channel}</Badge>
                    <div className="ml-auto text-xs text-muted-foreground">
                        <Clock className="h-3 w-3 inline mr-1" />
                        {formatDate(purchaseDate)}
                    </div>
                </div>
            </CardHeader>

            <CardContent className="space-y-3">
                <div className="space-y-2.5 p-3 bg-yellow-50 dark:bg-transparent rounded-lg border border-yellow-200 dark:border-yellow-700">
                    <h4 className="font-semibold text-yellow-900 dark:text-yellow-200 text-sm mb-2 flex items-center gap-2">
                        <Badge className="bg-yellow-600 text-black dark:text-yellow-50">COMPRADO</Badge>
                        Informações Completas do Lead
                    </h4>

                    <div className="grid grid-cols-1 md:grid-cols-2 gap-3 text-sm">
                        <div className="flex items-center gap-3 p-2 bg-white dark:bg-background rounded border border-border">
                            <DollarSign className="h-4 w-4 text-yellow-600 flex-shrink-0" />
                            <div>
                                <div className="text-muted-foreground text-xs">Faturamento</div>
                                <div className="font-semibold text-yellow-700 dark:text-yellow-400">{formatCurrency(lead.revenue)}</div>
                            </div>
                        </div>

                        <div className="flex items-center gap-3 p-2 bg-white dark:bg-background rounded border border-border">
                            <Megaphone className="h-4 w-4 text-foreground flex-shrink-0" />
                            <div>
                                <div className="text-muted-foreground text-xs">Invest. Marketing</div>
                                <div className="font-semibold text-foreground">{formatCurrency(lead.marketingInvestment)}</div>
                            </div>
                        </div>

                        <div className="flex items-center gap-3 p-2 bg-white dark:bg-background rounded border border-border">
                            <Building className="h-4 w-4 text-yellow-600 flex-shrink-0" />
                            <div>
                                <div className="text-muted-foreground text-xs">Empresa</div>
                                <div className="font-semibold text-yellow-700 dark:text-yellow-400">{lead.companyName}</div>
                            </div>
                        </div>

                        <div className="flex items-center gap-3 p-2 bg-white dark:bg-background rounded border border-border">
                            <Target className="h-4 w-4 text-foreground flex-shrink-0" />
                            <div>
                                <div className="text-muted-foreground text-xs">Nicho</div>
                                <div className="font-semibold text-foreground break-words">{lead.niche}</div>
                            </div>
                        </div>
                    </div>

                    <div className="pt-2 border-t border-yellow-200">
                        <h5 className="font-semibold text-yellow-900 dark:text-yellow-200 text-sm mb-2">Dados de Contato</h5>
                        <div className="grid grid-cols-1 gap-2.5">
                            <div className="flex items-center gap-3 p-2.5 bg-white dark:bg-background rounded border border-yellow-300 dark:border-yellow-700/60">
                                <div className="text-yellow-600 font-medium text-sm">Nome:</div>
                                <div className="font-semibold text-foreground break-words">{lead.contactName}</div>
                            </div>

                            <div className="flex items-center gap-3 p-2.5 bg-white dark:bg-background rounded border border-yellow-300 dark:border-yellow-700/60">
                                <Phone className="h-4 w-4 text-yellow-600 flex-shrink-0" />
                                <div className="font-semibold text-foreground break-all">{lead.phone}</div>
                            </div>

                            <div className="flex items-center gap-3 p-2.5 bg-white dark:bg-background rounded border border-yellow-300 dark:border-yellow-700/60">
                                <Mail className="h-4 w-4 text-yellow-600 flex-shrink-0" />
                                <div className="font-semibold text-foreground break-all [overflow-wrap:anywhere]">{lead.email}</div>
                            </div>
                        </div>
                    </div>
                </div>

                <p className="text-sm text-muted-foreground">
                    {lead.description}
                </p>


            </CardContent>
        </Card>
    );
};
