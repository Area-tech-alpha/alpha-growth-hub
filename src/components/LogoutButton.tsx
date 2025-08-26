"use client";

import { signOut } from "next-auth/react";
import { useState } from "react";
import { Button } from "./ui/button";
import { LuLogOut } from "react-icons/lu";

export default function LogoutButton({ mobile = false }: { mobile?: boolean }) {
    const [isLoading, setIsLoading] = useState(false);
    return (
        <div className={mobile ? "" : "hidden sm:flex"}>
            <Button
                variant="outline"
                size="sm"
                onClick={async () => { setIsLoading(true); await signOut({ callbackUrl: '/login' }); }}
                className="text-muted-foreground hover:text-foreground disabled:opacity-50"
                disabled={isLoading}
            >
                <LuLogOut className="h-4 w-4 mr-2" />
                {isLoading ? "Saindo…" : "Sair"}
            </Button>
        </div>
    );
}