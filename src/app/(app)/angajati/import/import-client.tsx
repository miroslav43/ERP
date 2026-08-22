// src/app/(app)/angajati/import/import-client.tsx
"use client";
import { useId, useRef, useState } from "react";
import { getBrowserSupabase } from "@/lib/supabase/browser";
import { BUCKET_DOCUMENTE } from "@/lib/documents/cale";
import { LIMITA_FISIER_BYTES, verificaFisierImport } from "@/lib/import/excel";
import { EmptyState } from "@/components/feedback/empty-state";
import { StareEroare } from "@/components/feedback/stare-eroare";
import { SkeletonTable } from "@/components/data/skeleton-table";
import type { ActionResult } from "@/lib/actions/types";
import type { AngajatValidat } from "@/domain/import/validare";
import { CheckCircle2 } from "lucide-react";
import {
  analizeazaImportAngajati as analizeazaImportAngajatiBruta,
  aplicaImportAngajati as aplicaImportAngajatiBruta,
  pregatesteIncarcareaImportului as pregatesteIncarcareaImportuluiBruta,
} from "./actions";

type EroareRand = { rand: number; camp: string; mesaj: string };
type ColoanaRecunoscuta = { coloana: string; camp: string };

// `createAction` (./actions) nu-și poate infera tipul datelor din corpul
// handler-ului, așa că fixăm aici, explicit, forma reală întoarsă de fiecare acțiune.
type Pregatire = { batchId: string; cale: string; token: string };
type Previzualizare = {
  batchId: string;
  numeFoaie: string;
  totalRanduri: number;
  trunchiat: boolean;
  coloaneRecunoscute: ColoanaRecunoscuta[];
  coloaneIgnorate: string[];
  numarValide: number;
  esantion: AngajatValidat[];
  invalide: EroareRand[];
  dimensiuneLot: number;
};
type Aplicare = {
  procesate: number;
  reusite: number;
  esuate: { rand: number; marca: string; mesaj: string }[];
  urmator: number;
  total: number;
  gata: boolean;
};

const pregatesteIncarcareaImportului = pregatesteIncarcareaImportuluiBruta as unknown as (input: {
  numeFisier: string;
  dimensiune: number;
}) => Promise<ActionResult<Pregatire>>;
const analizeazaImportAngajati = analizeazaImportAngajatiBruta as unknown as (input: {
  batchId: string;
  cale: string;
}) => Promise<ActionResult<Previzualizare>>;
const aplicaImportAngajati = aplicaImportAngajatiBruta as unknown as (input: {
  batchId: string;
  offset: number;
}) => Promise<ActionResult<Aplicare>>;

type Pas = "incarcare" | "analiza" | "previzualizare" | "aplicare" | "gata";

export function ImportAngajatiClient() {
  const idFisier = useId();
  const referintaFisier = useRef<HTMLInputElement>(null);
  const [pas, setPas] = useState<Pas>("incarcare");
  const [eroare, setEroare] = useState<string | null>(null);
  const [previzualizare, setPrevizualizare] = useState<Previzualizare | null>(null);
  const [progres, setProgres] = useState({ procesate: 0, reusite: 0, total: 0 });
  const [esecuri, setEsecuri] = useState<{ rand: number; marca: string; mesaj: string }[]>([]);

  async function incarca(): Promise<void> {
    const fisier = referintaFisier.current?.files?.[0];
    if (!fisier) {
      setEroare("Alege un fișier Excel.");
      return;
    }
    const problema = verificaFisierImport(fisier.name, fisier.size);
    if (problema !== null) {
      setEroare(problema);
      return;
    }
    setEroare(null);
    setPas("analiza");
    const pregatire = await pregatesteIncarcareaImportului({
      numeFisier: fisier.name,
      dimensiune: fisier.size,
    });
    if (!pregatire.ok) {
      setEroare(pregatire.error.message);
      setPas("incarcare");
      return;
    }
    const urcare = await getBrowserSupabase()
      .storage.from(BUCKET_DOCUMENTE)
      .uploadToSignedUrl(pregatire.data.cale, pregatire.data.token, fisier);
    if (urcare.error !== null) {
      setEroare("Încărcarea fișierului a eșuat. Verifică conexiunea și încearcă din nou.");
      setPas("incarcare");
      return;
    }
    const analiza = await analizeazaImportAngajati({
      batchId: pregatire.data.batchId,
      cale: pregatire.data.cale,
    });
    if (!analiza.ok) {
      setEroare(analiza.error.message);
      setPas("incarcare");
      return;
    }
    setPrevizualizare(analiza.data);
    setPas("previzualizare");
  }

  async function aplica(): Promise<void> {
    if (previzualizare === null) return;
    setPas("aplicare");
    setEroare(null);
    let offset = 0;
    let reusite = 0;
    const respinse: { rand: number; marca: string; mesaj: string }[] = [];
    // Loturi mici, apelate secvențial: fiecare răspuns e mic, iar progresul rămâne vizibil.
    for (;;) {
      const rezultat = await aplicaImportAngajati({ batchId: previzualizare.batchId, offset });
      if (!rezultat.ok) {
        setEroare(`${rezultat.error.message} Poți relua importul de la rândul ${offset + 1}.`);
        setPas("previzualizare");
        return;
      }
      reusite += rezultat.data.reusite;
      respinse.push(...rezultat.data.esuate);
      offset = rezultat.data.urmator;
      setProgres({ procesate: offset, reusite, total: rezultat.data.total });
      if (rezultat.data.gata) break;
    }
    setEsecuri(respinse);
    setPas("gata");
  }

  function descarcaRaport(): void {
    if (previzualizare === null) return;
    const linii = [
      "rand;camp;mesaj",
      ...previzualizare.invalide.map(
        (e: EroareRand) => `${e.rand};"${e.camp}";"${e.mesaj.replace(/"/g, '""')}"`,
      ),
      ...esecuri.map(
        (e) => `${e.rand};"Import";"${e.mesaj.replace(/"/g, '""')} (marca ${e.marca})"`,
      ),
    ].join("\r\n");
    const url = URL.createObjectURL(
      new Blob([`\uFEFF${linii}`], { type: "text/csv;charset=utf-8" }),
    );
    const legatura = document.createElement("a");
    legatura.href = url;
    legatura.download = "randuri-respinse.csv";
    legatura.click();
    URL.revokeObjectURL(url);
  }

  if (pas === "analiza") return <SkeletonTable rows={6} cols={4} />;

  return (
    <section className="flex flex-col gap-6">
      {eroare !== null && (
        <StareEroare
          titlu="Importul nu a putut continua"
          eroare={new Error(eroare)}
          reincearca={() => {
            setEroare(null);
            setPas("incarcare");
          }}
        />
      )}

      {pas === "incarcare" && (
        <div className="border-border rounded-lg border p-6">
          <label htmlFor={idFisier} className="text-foreground block text-sm font-medium">
            Fișier Excel (.xlsx), maximum {Math.round(LIMITA_FISIER_BYTES / 1024 / 1024)} MB
          </label>
          <input
            ref={referintaFisier}
            id={idFisier}
            type="file"
            accept=".xlsx,.xlsm"
            aria-describedby={`${idFisier}-ajutor`}
            className="mt-2 block w-full text-sm"
          />
          <p id={`${idFisier}-ajutor`} className="text-muted-foreground mt-2 text-sm">
            Primul rând trebuie să conțină antetul coloanelor. Obligatorii: Marcă, Nume (sau Nume
            complet) și Data angajării.
          </p>
          <button
            type="button"
            onClick={() => void incarca()}
            className="bg-primary text-primary-foreground mt-4 rounded-md px-4 py-2 text-sm font-medium"
          >
            Încarcă și previzualizează
          </button>
        </div>
      )}

      {pas === "previzualizare" && previzualizare !== null && (
        <div className="flex flex-col gap-4">
          <p aria-live="polite" className="text-foreground text-sm">
            {previzualizare.totalRanduri} rânduri citite din foaia „{previzualizare.numeFoaie}”:{" "}
            {previzualizare.numarValide} pot fi importate, {previzualizare.invalide.length} probleme
            de corectat.
            {previzualizare.trunchiat && " Fișierul a fost trunchiat la limita de 1000 de rânduri."}
          </p>
          {previzualizare.coloaneIgnorate.length > 0 && (
            <p className="text-foreground text-sm">
              Coloane ignorate: {previzualizare.coloaneIgnorate.join(", ")}.
            </p>
          )}
          {previzualizare.invalide.length === 0 ? (
            <EmptyState
              icon={CheckCircle2}
              title="Niciun rând respins"
              description="Toate rândurile trec validarea."
            />
          ) : (
            <div className="overflow-x-auto">
              <table className="w-full text-left text-sm">
                <caption className="sr-only">Rânduri respinse la validare</caption>
                <thead>
                  <tr>
                    <th scope="col" className="p-2">
                      Rând
                    </th>
                    <th scope="col" className="p-2">
                      Câmp
                    </th>
                    <th scope="col" className="p-2">
                      Problemă
                    </th>
                  </tr>
                </thead>
                <tbody>
                  {previzualizare.invalide.slice(0, 50).map((e: EroareRand, i: number) => (
                    <tr
                      key={`${e.rand}-${e.camp}-${i}`}
                      className="border-danger/40 bg-danger/8 border-t"
                    >
                      <td className="p-2">{e.rand}</td>
                      <td className="p-2">{e.camp}</td>
                      <td className="p-2">{e.mesaj}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}
          <div className="flex flex-wrap gap-3">
            <button
              type="button"
              disabled={previzualizare.numarValide === 0}
              onClick={() => void aplica()}
              className="bg-primary text-primary-foreground disabled:border-border disabled:bg-surface disabled:text-muted-foreground rounded-md px-4 py-2 text-sm font-medium disabled:cursor-not-allowed"
            >
              Importă cele {previzualizare.numarValide} rânduri valide
            </button>
            <button
              type="button"
              onClick={descarcaRaport}
              className="border-foreground/60 rounded-md border px-4 py-2 text-sm"
            >
              Descarcă raportul rândurilor respinse
            </button>
          </div>
        </div>
      )}

      {pas === "aplicare" && (
        <p role="status" aria-live="polite" className="text-sm">
          Se importă… {progres.procesate} din {progres.total} rânduri procesate, {progres.reusite}{" "}
          create.
        </p>
      )}

      {pas === "gata" && (
        <div className="border-success/40 bg-surface rounded-lg border p-4">
          <p role="status" aria-live="polite" className="text-sm font-medium">
            Import încheiat: {progres.reusite} fișe create, {esecuri.length} rânduri respinse la
            scriere.
          </p>
          <button
            type="button"
            onClick={descarcaRaport}
            className="border-foreground/60 mt-3 rounded-md border px-4 py-2 text-sm"
          >
            Descarcă raportul complet
          </button>
        </div>
      )}
    </section>
  );
}
