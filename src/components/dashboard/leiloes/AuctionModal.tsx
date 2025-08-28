"use client";

import { useState, useEffect } from 'react';
import { Dialog, DialogContent, DialogDescription, DialogHeader, DialogTitle } from '@/components/ui/dialog';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Badge } from '@/components/ui/badge';
import { Separator } from '@/components/ui/separator';
import { Phone, Mail, Zap, AlertCircle, Building, User, Target, Megaphone, DollarSign, Coins } from 'lucide-react';
import { CountdownTimer } from '../leads/CountdownTimer';
import { Lead } from '../leads/types';
import { Bid } from './types';
import { toast } from 'sonner';

interface AuctionModalProps {
    lead: Lead;
    onClose: () => void;
    user: { id?: string; name: string };
}

export const AuctionModal = ({ lead, onClose, user }: AuctionModalProps) => {
    const [isAuctionActive, setIsAuctionActive] = useState(new Date(lead.expires_at).getTime() > Date.now());
    const [bidAmount, setBidAmount] = useState('');
    const [currentBid, setCurrentBid] = useState(lead.currentBid);
    const [bidders, setBidders] = useState(lead.bidders);
    const [bids, setBids] = useState<Bid[]>([]);
    const [isSubmitting, setIsSubmitting] = useState(false);
    const [hasWon, setHasWon] = useState(false);
    const [userCredits] = useState(1500);

    const handleExpire = () => {
        setIsAuctionActive(false);
        const lastBid = bids[0];
        if (lastBid && lastBid.userId === (user.id || 'current-user')) {
            setHasWon(true);
            toast.success("Parabéns! Você ganhou o leilão!", {
                description: "Agora você tem acesso a todas as informações do lead.",
            });
        } else {
            toast("Leilão Encerrado!", {
                description: `O leilão para "${lead.name}" foi finalizado.`,
            });
        }
    };

    useEffect(() => {
        const mockBids: Bid[] = [
            { id: '1', leadId: lead.id, userId: 'user1', userName: 'Carlos M.', amount: currentBid, timestamp: new Date(Date.now() - 120000) },
            { id: '2', leadId: lead.id, userId: 'user2', userName: 'Ana S.', amount: currentBid - 15, timestamp: new Date(Date.now() - 300000) },
            { id: '3', leadId: lead.id, userId: 'user3', userName: 'João P.', amount: currentBid - 30, timestamp: new Date(Date.now() - 480000) }
        ];
        setBids(mockBids);
    }, [lead.id, currentBid]);

    const formatCurrency = (value: number) => {
        return new Intl.NumberFormat('pt-BR', { style: 'currency', currency: 'BRL', minimumFractionDigits: 0, maximumFractionDigits: 0 }).format(value);
    };

    const handleBid = async () => {
        const amount = parseFloat(bidAmount);
        if (!amount || amount <= currentBid) {
            toast.error("Lance inválido", { description: `Seu lance deve ser maior que ${formatCurrency(currentBid)}` });
            return;
        }
        if (amount < (lead.minimumBid as number)) {
            toast.error("Lance muito baixo", { description: `O lance mínimo é ${formatCurrency(lead.minimumBid as number)}` });
            return;
        }
        if (amount > userCredits) {
            toast.error("Créditos insuficientes", { description: `Você precisa de pelo menos ${formatCurrency(amount)} em créditos.` });
            return;
        }
        setIsSubmitting(true);
        setTimeout(() => {
            const newBid: Bid = { id: Date.now().toString(), leadId: lead.id, userId: user.id || 'current-user', userName: user.name, amount: amount, timestamp: new Date() };
            setBids(prev => [newBid, ...prev]);
            setCurrentBid(amount);
            setBidders(prev => prev + 1);
            setBidAmount('');
            setIsSubmitting(false);
            toast.success("Lance realizado com sucesso!", { description: `Seu lance de ${formatCurrency(amount)} foi registrado.` });
        }, 1000);
    };

    return (
        <Dialog open={true} onOpenChange={onClose}>
            <DialogContent className="w-full max-w-[calc(100%-2rem)] sm:max-w-2xl md:max-w-4xl lg:max-w-5xl xl:max-w-6xl 2xl:max-w-7xl max-h-[90vh] overflow-y-auto bg-card text-card-foreground">
                <DialogHeader>
                    <div className="flex items-center justify-between">
                        <DialogTitle className="text-2xl font-bold text-yellow-600">{lead.name}</DialogTitle>
                        <CountdownTimer expiresAt={lead.expires_at} onExpire={handleExpire} className="text-2xl" />
                    </div>
                    <DialogDescription className="text-muted-foreground">{lead.description}</DialogDescription>
                </DialogHeader>

                <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
                    {/* Left Column - Lead Details */}
                    <div className="space-y-6">
                        <div className="space-y-4">
                            <h3 className="text-lg font-semibold">{hasWon ? 'Informações Completas do Lead' : 'Prévia do Lead'}</h3>
                            {hasWon && (
                                <div className="p-4 bg-yellow-50 border border-yellow-200 rounded-lg">
                                    <div className="flex items-center gap-2 text-yellow-800 font-semibold">
                                        <Badge className="bg-yellow-600 text-black">ACESSO LIBERADO</Badge>
                                        Você ganhou este leilão!
                                    </div>
                                </div>
                            )}
                            <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                                <div className="p-3 bg-yellow-50 dark:bg-yellow-900/20 rounded-lg border border-yellow-200 dark:border-yellow-700">
                                    <div className="flex items-center gap-2 mb-1"><DollarSign className="h-4 w-4 text-yellow-600" /><span className="text-sm text-muted-foreground">Faturamento</span></div>
                                    <div className="font-bold text-lg text-yellow-700 dark:text-yellow-400">{formatCurrency(lead.revenue)}</div>
                                </div>
                                <div className="p-3 bg-muted rounded-lg">
                                    <div className="flex items-center gap-2 mb-1"><Megaphone className="h-4 w-4 text-foreground" /><span className="text-sm text-muted-foreground">Investimento Marketing</span></div>
                                    <div className="font-bold text-lg text-foreground">{formatCurrency(lead.marketingInvestment)}</div>
                                </div>
                                <div className="p-3 bg-yellow-50 dark:bg-yellow-900/20 rounded-lg border border-yellow-200 dark:border-yellow-700">
                                    <div className="flex items-center gap-2 mb-1"><Building className="h-4 w-4 text-yellow-600" /><span className="text-sm text-muted-foreground">Nome da Empresa</span></div>
                                    <div className="font-bold text-yellow-700 dark:text-yellow-400">{hasWon ? lead.companyName : lead.maskedCompanyName}</div>
                                </div>
                                <div className="p-3 bg-muted rounded-lg">
                                    <div className="flex items-center gap-2 mb-1"><Target className="h-4 w-4 text-foreground" /><span className="text-sm text-muted-foreground">Nicho</span></div>
                                    <div className="font-bold text-foreground">{lead.niche}</div>
                                </div>
                            </div>
                            <div className={`p-4 rounded-lg ${hasWon ? 'bg-yellow-50 dark:bg-yellow-900/20 border border-yellow-200 dark:border-yellow-700' : 'bg-muted'}`}>
                                <h4 className="font-medium text-yellow-900 dark:text-yellow-200 mb-3">Informações de Contato</h4>
                                <div className="space-y-2 text-sm">
                                    <div className="flex items-center gap-2"><User className="h-4 w-4 text-yellow-600" /><span className="font-medium">{hasWon ? lead.contactName : lead.maskedContactName}</span></div>
                                    <div className="flex items-center gap-2"><Phone className="h-4 w-4 text-yellow-600" /><span className={hasWon ? 'text-yellow-700 dark:text-yellow-400' : 'text-muted-foreground'}>{hasWon ? lead.phone : lead.maskedPhone}</span></div>
                                    <div className="flex items-center gap-2"><Mail className="h-4 w-4 text-yellow-600" /><span className={hasWon ? 'text-yellow-700 dark:text-yellow-400' : 'text-muted-foreground'}>{hasWon ? lead.email : lead.maskedEmail}</span></div>
                                </div>
                            </div>
                        </div>
                    </div>

                    {/* Right Column - Bidding */}
                    <div className="space-y-6">
                        {isAuctionActive && !hasWon ? (
                            <div className="space-y-4">
                                <h3 className="text-lg font-semibold">Fazer Lance</h3>
                                <div className="p-3 bg-yellow-50 rounded-lg">
                                    <div className="flex items-center gap-2 text-yellow-700 text-sm mb-2"><Coins className="h-4 w-4" />Seus créditos: {userCredits.toLocaleString()}</div>
                                </div>
                                <div className="space-y-3">
                                    <div className="flex items-center gap-2 text-sm text-yellow-600"><AlertCircle className="h-4 w-4" />Lance mínimo: {formatCurrency(Math.max(currentBid + 1, lead.minimumBid as number))}</div>
                                    <div className="flex gap-2">
                                        <Input type="number" placeholder="Valor do lance" value={bidAmount} onChange={(e) => setBidAmount(e.target.value)} className="flex-1" min={Math.max(currentBid + 1, lead.minimumBid as number)} />
                                        <Button onClick={handleBid} disabled={isSubmitting} className="bg-gradient-to-r from-yellow-400 to-yellow-500 hover:from-yellow-500 hover:to-yellow-600 text-black"><Zap className="h-4 w-4 mr-2" />{isSubmitting ? 'Enviando...' : 'Dar Lance'}</Button>
                                    </div>
                                </div>
                            </div>
                        ) : (
                            <div className="p-6 bg-muted rounded-lg text-center">
                                <h3 className="text-lg font-semibold text-foreground mb-2">{hasWon ? 'Leilão Ganho!' : 'Leilão Encerrado'}</h3>
                                <p className="text-muted-foreground">{hasWon ? 'Parabéns! Você ganhou este leilão.' : 'Este leilão foi finalizado.'}</p>
                            </div>
                        )}
                        <Separator />
                        <div className="space-y-4">
                            <h3 className="text-lg font-semibold">Histórico de Lances</h3>
                            <div className="space-y-2 max-h-64 overflow-y-auto">
                                {bids.map((bid, index) => (
                                    <div key={bid.id} className={`p-3 rounded-lg border ${index === 0 ? 'bg-yellow-50 dark:bg-yellow-900/20 border-yellow-200 dark:border-yellow-700' : 'bg-muted border-border'}`}>
                                        <div className="flex justify-between items-center">
                                            <div className="flex items-center gap-2">
                                                <span className="font-medium">{bid.userName}</span>
                                                {index === 0 && (<Badge variant="secondary" className="bg-yellow-100 text-yellow-800 text-xs">Maior lance</Badge>)}
                                            </div>
                                            <div className="text-right">
                                                <div className="font-bold text-yellow-600">{formatCurrency(bid.amount)}</div>
                                                <div className="text-xs text-muted-foreground">{bid.timestamp.toLocaleTimeString()}</div>
                                            </div>
                                        </div>
                                    </div>
                                ))}
                            </div>
                        </div>
                    </div>
                </div>

                <div className="flex justify-end pt-4">
                    <Button variant="outline" onClick={onClose}>Fechar</Button>
                </div>
            </DialogContent>
        </Dialog>
    );
};