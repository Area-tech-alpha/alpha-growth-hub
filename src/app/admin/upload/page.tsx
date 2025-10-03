// app/admin/upload/page.tsx
"use client";

import { useState, FormEvent } from 'react';
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label"; // Importar Label para acessibilidade
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Alert, AlertDescription, AlertTitle } from "@/components/ui/alert";
import { FileUp, Loader2, Terminal } from "lucide-react";

export default function UploadPage() {
    const [file, setFile] = useState<File | null>(null);
    const [quantity, setQuantity] = useState<number>(1); // Estado para a quantidade
    const [message, setMessage] = useState<string>('');
    const [isLoading, setIsLoading] = useState<boolean>(false);
    const [isError, setIsError] = useState<boolean>(false);

    const handleFileChange = (e: React.ChangeEvent<HTMLInputElement>) => {
        if (e.target.files) setFile(e.target.files[0]);
    };

    const handleSubmit = async (e: FormEvent) => {
        e.preventDefault();
        if (!file) {
            setMessage('Por favor, selecione um arquivo CSV.');
            setIsError(true);
            return;
        }
        if (quantity <= 0) {
            setMessage('A quantidade deve ser maior que zero.');
            setIsError(true);
            return;
        }

        setIsLoading(true);
        setMessage('');
        setIsError(false);

        const formData = new FormData();
        formData.append('file', file);
        formData.append('quantity', quantity.toString()); // Envia a quantidade para a API

        try {
            const response = await fetch('/api/upload-leads', {
                method: 'POST',
                body: formData,
            });

            const result = await response.json();

            if (!response.ok) {
                throw new Error(result.details || result.error || 'Ocorreu um erro no servidor.');
            }

            setMessage(result.message);

        } catch (error) {
            const errorMessage = error instanceof Error ? error.message : 'Erro desconhecido';
            setMessage(`Falha no upload: ${errorMessage}`);
            setIsError(true);
        } finally {
            setIsLoading(false);
        }
    };

    return (
        <div className="flex min-h-screen items-center justify-center bg-gray-50 dark:bg-gray-900 p-4">
            <Card className="w-full max-w-lg">
                <CardHeader>
                    <CardTitle className="text-2xl">Importar Leads</CardTitle>
                    <CardDescription>
                        Selecione um arquivo .CSV e defina quantos novos leads você deseja registrar.
                    </CardDescription>
                </CardHeader>
                <CardContent>
                    <form onSubmit={handleSubmit} className="space-y-4">
                        <div className="grid w-full items-center gap-1.5">
                            <Label htmlFor="csv-file">Arquivo CSV</Label>
                            <Input
                                id="csv-file"
                                type="file"
                                accept=".csv"
                                onChange={handleFileChange}
                                disabled={isLoading}
                            />
                        </div>

                        <div className="grid w-full items-center gap-1.5">
                            <Label htmlFor="quantity">Quantidade de Leads a Inserir</Label>
                            <Input
                                id="quantity"
                                type="number"
                                value={quantity}
                                onChange={(e) => setQuantity(Number(e.target.value))}
                                min="1"
                                disabled={isLoading}
                            />
                        </div>

                        <Button type="submit" disabled={isLoading} className="w-full">
                            {isLoading ? (
                                <><Loader2 className="mr-2 h-4 w-4 animate-spin" /> Processando...</>
                            ) : (
                                <><FileUp className="mr-2 h-4 w-4" /> Enviar e Registrar</>
                            )}
                        </Button>
                    </form>

                    {message && (
                        <Alert variant={isError ? "destructive" : "default"} className="mt-4">
                            <Terminal className="h-4 w-4" />
                            <AlertTitle>{isError ? "Erro!" : "Resultado"}</AlertTitle>
                            <AlertDescription>
                                {message}
                            </AlertDescription>
                        </Alert>
                    )}
                </CardContent>
            </Card>
        </div>
    );
}