// src/components/forms/incarcare-avatar.tsx
"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";

import { AvatarAngajat } from "@/components/data/avatar-angajat";
import { Callout } from "@/components/ui/callout";
import { IncarcareFisier } from "@/components/ui/incarcare-fisier";
import {
  BUCKET_AVATARE,
  LIMITA_AVATAR_BYTES,
  MIME_AVATAR_ACCEPTATE,
  verificaAvatar,
} from "@/lib/avatar/cale";
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

/** `image/png,image/jpeg,image/webp` — aceeași listă pe care o verifică serverul. */
const ACCEPT = MIME_AVATAR_ACCEPTATE.join(",");

/**
 * Widget de auto-încărcare, refolosit atât pe profilul propriu cât și, cu alte
 * acțiuni la `pregateste`/`salveaza`, din fișa unui angajat (admin, pe seama
 * colegului). Fluxul e identic — doar cine are voie diferă, iar asta se
 * decide server-side, în acțiunile primite ca props.
 *
 * ── DE CE `<IncarcareFisier>` ȘI NU `<input type="file">` GOL ─────────────
 * Câmpul nativ nestilizat desena butonul „Choose file” cu textul și fontul
 * sistemului de operare — singurul control din produs care nu vorbea românește
 * și nu semăna cu restul. Mai important, nu arăta NIMIC despre ce s-a ales: nici
 * numele fișierului, nici mărimea, iar odată ales un fișier greșit singura
 * ieșire era să redeschizi dialogul sistemului. Aici există numele, mărimea și
 * un buton de scoatere.
 *
 * Restricțiile se citesc ÎNAINTE de alegere (WCAG 3.3.2), din aceleași
 * constante pe care le verifică serverul — `LIMITA_AVATAR_BYTES` și
 * `MIME_AVATAR_ACCEPTATE` din `lib/avatar/cale.ts`. Două numere scrise separat
 * ar fi divergent în prima lună, iar omul ar fi citit „până în 2 MB” de la un
 * ecran care respinge la 1.
 *
 * ── DE CE `key={generatie}` ───────────────────────────────────────────────
 * Câmpul își ține propria stare („ce fișier e ales”), fiindcă inputul nativ
 * rămâne sursa adevărului și pentru un formular clasic. Aici încărcarea se face
 * imediat, deci după reușită fișierul ales nu mai are ce reprezenta — a plecat.
 * Incrementarea cheii îl remontează gol, fără ca primitiva să aibă nevoie de o
 * mână imperativă (`ref` + `useImperativeHandle`) pe care n-o cere nimeni
 * altcineva.
 */
export function IncarcareAvatar({
  urlInitial,
  nume,
  pregateste,
  salveaza,
}: ProprietatiIncarcareAvatar) {
  const router = useRouter();
  const [generatie, setGeneratie] = useState(0);
  const [stare, setStare] = useState<{ tip: "inactiv" | "lucru" | "eroare"; mesaj: string }>({
    tip: "inactiv",
    mesaj: "",
  });

  async function incarca(fisier: File): Promise<void> {
    // A doua verificare, deși `<IncarcareFisier>` a filtrat deja mărimea și
    // tipul: `verificaAvatar` e funcția pe care o rulează ȘI serverul, deci ea
    // decide. Prinde și cazul pe care primitiva nu-l cunoaște — fișierul de
    // zero octeți, care trece de `accept` și de limita de mărime.
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

    setStare({ tip: "inactiv", mesaj: "" });
    setGeneratie((g) => g + 1);
    router.refresh();
  }

  return (
    <div className="flex flex-wrap items-start gap-4">
      <AvatarAngajat url={urlInitial} nume={nume} marime="lg" />
      <div className="flex min-w-56 flex-1 flex-col gap-2">
        <IncarcareFisier
          key={generatie}
          nume="avatar"
          eticheta="Schimbă fotografia"
          accept={ACCEPT}
          maxOcteti={LIMITA_AVATAR_BYTES}
          mesajPreaMare="Fotografia depășește 2 MB. Alege una mai mică."
          mesajTipRespins="Acceptăm doar imagini JPG, PNG sau WEBP."
          restrictii="JPG, PNG sau WEBP, până în 2 MB. Se încarcă imediat ce ai ales."
          textAlegere="Alege fotografia"
          etichetaScoate="Renunță la fotografia aleasă"
          laSchimbare={(fisier) => {
            if (fisier === null) {
              setStare({ tip: "inactiv", mesaj: "" });
              return;
            }
            void incarca(fisier);
          }}
        />

        {stare.tip === "eroare" ? (
          <Callout fel="eroare">{stare.mesaj}</Callout>
        ) : stare.tip === "lucru" ? (
          <p role="status" className="text-muted-foreground text-corp">
            {stare.mesaj}
          </p>
        ) : null}
      </div>
    </div>
  );
}
