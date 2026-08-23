// src/app/(app)/angajati/[id]/documente/formular-document.tsx
"use client";
import { useId, useRef, useState } from "react";
import { Buton } from "@/components/ui/buton";
import { getBrowserSupabase } from "@/lib/supabase/browser";
import { BUCKET_DOCUMENTE, verificaDocument } from "@/lib/documents/cale";
import { useRouter } from "next/navigation";
import {
  linkDescarcareDocument,
  pregatesteIncarcareDocument,
  salveazaDocument,
  stergeDocument,
} from "./actions";

type TipDocument = {
  id: string;
  denumire: string;
  confidential_implicit: boolean;
  vizibil_angajatului_implicit: boolean;
};

export function FormularDocument({
  employeeId,
  tipuri,
}: {
  employeeId: string;
  tipuri: readonly TipDocument[];
}) {
  const idTip = useId();
  const idTitlu = useId();
  const idFisier = useId();
  const referinta = useRef<HTMLInputElement>(null);
  const [stare, setStare] = useState<{
    tip: "inactiv" | "lucru" | "succes" | "eroare";
    mesaj: string;
  }>({ tip: "inactiv", mesaj: "" });

  async function trimite(formular: FormData): Promise<void> {
    const fisier = referinta.current?.files?.[0];
    const tipId = String(formular.get("tip") ?? "");
    const titlu = String(formular.get("titlu") ?? "").trim();
    if (!fisier) {
      setStare({ tip: "eroare", mesaj: "Alege un fișier." });
      return;
    }
    const problema = verificaDocument(fisier.type, fisier.size);
    if (problema !== null) {
      setStare({ tip: "eroare", mesaj: problema });
      return;
    }

    setStare({ tip: "lucru", mesaj: "Se încarcă documentul…" });
    const pregatire = await pregatesteIncarcareDocument({
      employeeId,
      numeFisier: fisier.name,
      dimensiune: fisier.size,
      mime: fisier.type,
    });
    if (!pregatire.ok) {
      setStare({ tip: "eroare", mesaj: pregatire.error.message });
      return;
    }
    const urcare = await getBrowserSupabase()
      .storage.from(BUCKET_DOCUMENTE)
      .uploadToSignedUrl(pregatire.data.cale, pregatire.data.token, fisier);
    if (urcare.error !== null) {
      setStare({ tip: "eroare", mesaj: "Încărcarea a eșuat. Verifică conexiunea." });
      return;
    }

    const tip = tipuri.find((t) => t.id === tipId);
    const rezultat = await salveazaDocument({
      employeeId,
      documentTypeId: tipId,
      titlu,
      cale: pregatire.data.cale,
      numeFisier: fisier.name,
      dimensiune: fisier.size,
      mime: fisier.type,
      confidential: tip?.confidential_implicit ?? true,
      vizibilAngajatului: tip?.vizibil_angajatului_implicit ?? true,
    });
    setStare(
      rezultat.ok
        ? { tip: "succes", mesaj: "Documentul a fost adăugat în dosar." }
        : { tip: "eroare", mesaj: rezultat.error.message },
    );
  }

  return (
    <form
      action={(formular) => void trimite(formular)}
      className="border-border rounded-panou grid gap-3 border p-4 sm:grid-cols-3"
    >
      <div className="flex flex-col gap-1">
        <label htmlFor={idTip} className="text-corp font-medium">
          Tip document
        </label>
        <select
          id={idTip}
          name="tip"
          required
          className="border-foreground/60 rounded-control border p-2"
        >
          {tipuri.map((tip) => (
            <option key={tip.id} value={tip.id}>
              {tip.denumire}
            </option>
          ))}
        </select>
      </div>
      <div className="flex flex-col gap-1">
        <label htmlFor={idTitlu} className="text-corp font-medium">
          Titlu
        </label>
        <input
          id={idTitlu}
          name="titlu"
          required
          maxLength={200}
          className="border-foreground/60 rounded-control border p-2"
        />
      </div>
      <div className="flex flex-col gap-1">
        <label htmlFor={idFisier} className="text-corp font-medium">
          Fișier (max. 20 MB)
        </label>
        <input ref={referinta} id={idFisier} type="file" required className="text-corp" />
      </div>
      <div className="flex items-center gap-4 sm:col-span-3">
        <Buton
          type="submit"
          varianta="primar"
          inCurs={stare.tip === "lucru"}
          textInCurs="Se încarcă…"
        >
          Adaugă documentul
        </Buton>
        <p
          role="status"
          aria-live="polite"
          className={stare.tip === "eroare" ? "text-danger text-corp" : "text-foreground text-corp"}
        >
          {stare.mesaj}
        </p>
      </div>
    </form>
  );
}

export function ListaDescarcare({
  documentId,
  numeFisier,
}: {
  documentId: string;
  numeFisier: string;
}) {
  const [eroare, setEroare] = useState<string | null>(null);
  async function descarca(): Promise<void> {
    const rezultat = await linkDescarcareDocument({ documentId });
    if (!rezultat.ok) {
      setEroare(rezultat.error.message);
      return;
    }
    window.open(rezultat.data.url, "_blank", "noopener,noreferrer");
  }
  return (
    <span className="flex items-center gap-2">
      {eroare !== null && (
        <span role="alert" className="text-danger text-corp">
          {eroare}
        </span>
      )}
      <Buton
        varianta="secundar"
        onClick={() => {
          void descarca();
        }}
      >
        Descarcă <span className="sr-only">{numeFisier}</span>
      </Buton>
    </span>
  );
}

export function ButonStergeDocument({
  documentId,
  poateSterge,
}: {
  documentId: string;
  poateSterge: boolean;
}) {
  const router = useRouter();
  const idMotiv = useId();
  const [deschis, setDeschis] = useState(false);
  const [motiv, setMotiv] = useState("");
  const [inCurs, setInCurs] = useState(false);
  const [eroare, setEroare] = useState<string | null>(null);

  if (!poateSterge) return null;

  async function confirma(): Promise<void> {
    setInCurs(true);
    setEroare(null);
    const rezultat = await stergeDocument({ documentId, motiv });
    setInCurs(false);
    if (!rezultat.ok) {
      setEroare(rezultat.error.message);
      return;
    }
    setDeschis(false);
    router.refresh();
  }

  if (!deschis) {
    return (
      <Buton
        varianta="distructiv"
        onClick={() => {
          setDeschis(true);
        }}
      >
        Retrage din dosar
      </Buton>
    );
  }

  return (
    <span className="flex flex-wrap items-center gap-2">
      <label htmlFor={idMotiv} className="sr-only">
        Motivul retragerii
      </label>
      <input
        id={idMotiv}
        value={motiv}
        onChange={(eveniment) => {
          setMotiv(eveniment.target.value);
        }}
        placeholder="Motivul retragerii (min. 3 caractere)"
        className="border-foreground/60 rounded-control text-corp border px-2 py-1.5"
      />
      <Buton
        varianta="distructiv"
        inCurs={inCurs}
        textInCurs="Se retrage…"
        disabled={motiv.trim().length < 3}
        onClick={() => {
          void confirma();
        }}
      >
        Confirmă
      </Buton>
      <Buton
        varianta="link"
        onClick={() => {
          setDeschis(false);
          setEroare(null);
        }}
      >
        Renunță
      </Buton>
      {eroare !== null && (
        <span role="alert" className="text-danger text-corp">
          {eroare}
        </span>
      )}
    </span>
  );
}
