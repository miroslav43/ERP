// src/components/forms/incarcare-avatar.tsx
"use client";

import { useId, useRef, useState } from "react";
import { useRouter } from "next/navigation";

import { AvatarAngajat } from "@/components/data/avatar-angajat";
import { BUCKET_AVATARE, verificaAvatar } from "@/lib/avatar/cale";
import { getBrowserSupabase } from "@/lib/supabase/browser";
import type { ActionResult } from "@/lib/actions/types";

interface ProprietatiIncarcareAvatar {
  readonly urlInitial: string | null;
  readonly nume: string;
  /** Pas 1/2: doar creează URL-ul semnat — bytes-urile urcă direct din browser. */
  readonly pregateste: (input: {
    numeFisier: string;
    dimensiune: number;
    mime: string;
  }) => Promise<ActionResult<{ cale: string; token: string }>>;
  /** Pas 2/2: fișierul e deja în Storage, doar reține calea. */
  readonly salveaza: (input: { cale: string }) => Promise<ActionResult<unknown>>;
}

/**
 * Widget de auto-încărcare, refolosit atât pe profilul propriu cât și, cu alte
 * acțiuni la `pregateste`/`salveaza`, din fișa unui angajat (admin, pe seama
 * colegului). Fluxul e identic — doar cine are voie diferă, iar asta se
 * decide server-side, în acțiunile primite ca props.
 */
export function IncarcareAvatar({ urlInitial, nume, pregateste, salveaza }: ProprietatiIncarcareAvatar) {
  const router = useRouter();
  const idFisier = useId();
  const referinta = useRef<HTMLInputElement>(null);
  const [stare, setStare] = useState<{ tip: "inactiv" | "lucru" | "eroare"; mesaj: string }>({
    tip: "inactiv",
    mesaj: "",
  });

  async function incarca(): Promise<void> {
    const fisier = referinta.current?.files?.[0];
    if (fisier === undefined) return;
    const problema = verificaAvatar(fisier.type, fisier.size);
    if (problema !== null) {
      setStare({ tip: "eroare", mesaj: problema });
      return;
    }

    setStare({ tip: "lucru", mesaj: "Se încarcă fotografia…" });
    const pregatire = await pregateste({
      numeFisier: fisier.name,
      dimensiune: fisier.size,
      mime: fisier.type,
    });
    if (!pregatire.ok) {
      setStare({ tip: "eroare", mesaj: pregatire.error.message });
      return;
    }

    const urcare = await getBrowserSupabase()
      .storage.from(BUCKET_AVATARE)
      .uploadToSignedUrl(pregatire.data.cale, pregatire.data.token, fisier);
    if (urcare.error !== null) {
      setStare({ tip: "eroare", mesaj: "Încărcarea a eșuat. Verifică conexiunea." });
      return;
    }

    const salvat = await salveaza({ cale: pregatire.data.cale });
    if (!salvat.ok) {
      setStare({ tip: "eroare", mesaj: salvat.error.message });
      return;
    }

    if (referinta.current !== null) referinta.current.value = "";
    setStare({ tip: "inactiv", mesaj: "" });
    router.refresh();
  }

  return (
    <div className="flex flex-wrap items-center gap-4">
      <AvatarAngajat url={urlInitial} nume={nume} marime="lg" />
      <div className="flex flex-col gap-1">
        <label htmlFor={idFisier} className="text-sm font-medium">
          Schimbă fotografia
        </label>
        <input
          ref={referinta}
          id={idFisier}
          type="file"
          accept="image/png,image/jpeg,image/webp"
          onChange={() => void incarca()}
          disabled={stare.tip === "lucru"}
          className="text-sm"
        />
        <p className="text-muted-foreground text-xs">JPG, PNG sau WEBP, până în 2 MB.</p>
        {stare.tip === "eroare" ? (
          <p role="alert" className="text-danger text-sm">
            {stare.mesaj}
          </p>
        ) : stare.tip === "lucru" ? (
          <p role="status" className="text-muted-foreground text-sm">
            {stare.mesaj}
          </p>
        ) : null}
      </div>
    </div>
  );
}
