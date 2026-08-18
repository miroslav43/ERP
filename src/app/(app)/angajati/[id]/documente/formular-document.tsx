// src/app/(app)/angajati/[id]/documente/formular-document.tsx
"use client";
import { useId, useRef, useState } from "react";
import { getBrowserSupabase } from "@/lib/supabase/browser";
import { BUCKET_DOCUMENTE, verificaDocument } from "@/lib/documents/cale";
import { linkDescarcareDocument, pregatesteIncarcareDocument, salveazaDocument } from "./actions";

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
      className="grid gap-3 rounded-lg border border-border p-4 sm:grid-cols-3"
    >
      <div className="flex flex-col gap-1">
        <label htmlFor={idTip} className="text-sm font-medium">
          Tip document
        </label>
        <select
          id={idTip}
          name="tip"
          required
          className="rounded-md border border-foreground/60 p-2"
        >
          {tipuri.map((tip) => (
            <option key={tip.id} value={tip.id}>
              {tip.denumire}
            </option>
          ))}
        </select>
      </div>
      <div className="flex flex-col gap-1">
        <label htmlFor={idTitlu} className="text-sm font-medium">
          Titlu
        </label>
        <input
          id={idTitlu}
          name="titlu"
          required
          maxLength={200}
          className="rounded-md border border-foreground/60 p-2"
        />
      </div>
      <div className="flex flex-col gap-1">
        <label htmlFor={idFisier} className="text-sm font-medium">
          Fișier (max. 20 MB)
        </label>
        <input ref={referinta} id={idFisier} type="file" required className="text-sm" />
      </div>
      <div className="flex items-center gap-4 sm:col-span-3">
        <button
          type="submit"
          disabled={stare.tip === "lucru"}
          className="rounded-md bg-primary px-4 py-2 text-sm font-medium text-primary-foreground disabled:cursor-not-allowed disabled:border-border disabled:bg-surface disabled:text-muted-foreground"
        >
          {stare.tip === "lucru" ? "Se încarcă…" : "Adaugă documentul"}
        </button>
        <p
          role="status"
          aria-live="polite"
          className={stare.tip === "eroare" ? "text-sm text-danger" : "text-sm text-foreground"}
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
        <span role="alert" className="text-sm text-danger">
          {eroare}
        </span>
      )}
      <button
        type="button"
        onClick={() => void descarca()}
        className="rounded-md border border-foreground/60 px-3 py-1.5 text-sm"
      >
        Descarcă <span className="sr-only">{numeFisier}</span>
      </button>
    </span>
  );
}
