"use client";

// import { useEffect, useState } from "react";
// import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog";
// import { Button } from "@/components/ui/button";
// import Terms from "./Terms";

export function TermsGate({ children }: { children: React.ReactNode }) {
    // const [open, setOpen] = useState(false);
    // const [loading, setLoading] = useState(true);
    // const [accepting, setAccepting] = useState(false);

    // useEffect(() => {
    //     const check = async () => {
    //         try {
    //             const res = await fetch('/api/users/terms/status', { cache: 'no-store' });
    //             if (!res.ok) throw new Error('fail');
    //             const json = await res.json();
    //             setOpen(!json?.accepted);
    //         } catch {
    //             setOpen(true);
    //         } finally {
    //             setLoading(false);
    //         }
    //     };
    //     check();
    // }, []);

    // const accept = async () => {
    //     setAccepting(true);
    //     try {
    //         const res = await fetch('/api/users/terms/accept', { method: 'POST' });
    //         if (!res.ok) throw new Error('fail');
    //         setOpen(false);
    //     } catch {
    //         // noop; you can add toast
    //     } finally {
    //         setAccepting(false);
    //     }
    // };

    return (
        <>
            {children}
        </>
        // <>
        //     {children}
        //     {!loading && (
        //         <Dialog open={open} onOpenChange={() => { /* locked */ }}>
        //             <DialogContent className="max-w-3xl">
        //                 <DialogHeader>
        //                     <DialogTitle>Termos de Uso e Privacidade</DialogTitle>
        //                 </DialogHeader>
        //                 <div className="prose max-h-[60vh] overflow-y-auto text-sm">
        //                     <Terms />
        //                 </div>
        //                 <div className="flex justify-end gap-2 pt-4">
        //                     <Button onClick={accept} disabled={accepting} className="bg-yellow-500 hover:bg-yellow-600 text-black font-semibold">
        //                         {accepting ? 'Salvando...' : 'Concordo com os termos'}
        //                     </Button>
        //                 </div>
        //             </DialogContent>
        //         </Dialog>
        //     )}
        // </>
    );
}


