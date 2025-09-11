"use client";

import Terms from "@/components/Terms";
import Link from "next/link";
import { Button } from "@/components/ui/button";
import { ArrowLeft, ArrowUp } from "lucide-react";

const TermosDeUsoPage = () => {
    return (
        <>
            <div className="max-w-4xl mx-auto mb-6 mt-6 ml-6">
                <Link href="/">
                    <Button variant="outline" className="flex items-center gap-2">
                        <ArrowLeft className="h-4 w-4" />
                        Voltar à Home
                    </Button>
                </Link>
            </div>
            <Terms />
            <div className="max-w-4xl mx-auto mt-6 flex justify-center mb-6">
                <Button
                    variant="outline"
                    className="flex items-center gap-2"
                    onClick={() => window.scrollTo({ top: 0, behavior: 'smooth' })}
                >
                    <ArrowUp className="h-4 w-4" />
                    Voltar ao Topo
                </Button>
            </div>
        </>
    );
};

export default TermosDeUsoPage;