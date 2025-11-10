"use client";

import { useCallback, useEffect, useState } from "react";
import Image from "next/image";
import {
  Dialog,
  DialogClose,
  DialogContent,
  DialogTitle,
} from "@/components/ui/dialog";
import { XIcon } from "lucide-react";

const PROMO_IMAGE =
  "https://nfwfolrcpaxqwgkzzfok.supabase.co/storage/v1/object/public/Images/BlackNovemberAlpha.png";

export default function StartupPromoDialog() {
  const [open, setOpen] = useState(false);

  const dismiss = useCallback(() => {
    setOpen(false);
  }, []);

  useEffect(() => {
    setOpen(true);
  }, []);

  const handleOpenChange = useCallback(
    (nextOpen: boolean) => {
      if (!nextOpen) {
        dismiss();
      }
    },
    [dismiss],
  );

  if (!open) return null;

  return (
    <Dialog open={open} onOpenChange={handleOpenChange}>
      <DialogContent
        showCloseButton={false}
        className="w-full border-none bg-transparent p-0 shadow-none"
      >
        <DialogTitle className="sr-only">Black November Assessoria Alpha</DialogTitle>
        <div className="relative mx-auto aspect-square w-[min(92vw,_92vh)] max-w-[720px] max-h-[720px]">
          <Image
            src={PROMO_IMAGE}
            alt="Promoção Black November Assessoria Alpha"
            fill
            sizes="(max-width: 720px) 92vw, 720px"
            className="object-contain"
            priority
          />
          <DialogClose
            aria-label="Fechar aviso"
            className="absolute right-4 top-4 inline-flex size-11 items-center justify-center rounded-full text-white transition hover:scale-110 focus-visible:outline focus-visible:outline-offset-2 focus-visible:outline-white/70"
            onClick={dismiss}
          >
            <XIcon className="size-5 drop-shadow-[0_6px_18px_rgba(0,0,0,0.85)]" />
          </DialogClose>
        </div>
      </DialogContent>
    </Dialog>
  );
}
