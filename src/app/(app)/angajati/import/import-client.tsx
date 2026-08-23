// src/app/(app)/angajati/import/import-client.tsx
"use client";
import { useId, useRef, useState } from "react";
import { getBrowserSupabase } from "@/lib/supabase/browser";
import { BUCKET_DOCUMENTE } from "@/lib/documents/cale";
import { LIMITA_FISIER_BYTES, verificaFisierImport } from "@/lib/import/excel";
import { Buton } from "@/components/ui/buton";
import { StareGoala } from "@/components/ui/stare-goala";
import { StareEroare } from "@/components/ui/stare-eroare";
import { Schelet } from "@/components/ui/schelet";
import { Tabel, type Coloana } from "@/components/ui/tabel";
import type { ActionResult } from "@/lib/actions/types";
import type { AngajatValidat } from "@/domain/import/validare";
import { CheckCircle2 } from "lucide-react";
import {
  analizeazaImportAngajati as analizeazaImportAngajatiBruta,
  aplicaImportAngajati as aplicaImportAngajatiBruta,
  pregatesteIncarcareaImportului as pregatesteIncarcareaImportuluiBruta,
} from "./actions";

type EroareRand = { rand: number; camp: string; mesaj: string };
/** Aceeași eroare poate apărea de două ori identic; cheia poartă și poziția. */
type RandRespins = EroareRand & { cheie: string };
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

  /**
   * Tabelul respinselor n-are sortare și n-are paginare: e o listă scurtă,
   * citită dintr-un fișier, tăiată la 50 de rânduri — restul se ia din CSV-ul
   * de mai jos. Numărul rândului e `numeric`, ca să se citească pe verticală.
   */
  const coloaneRespinse: readonly Coloana<RandRespins>[] = [
    {
      cheie: "rand",
      antet: "Rând",
      numeric: true,
      latime: "ingusta",
      peTelefon: "meta",
      celula: (e) => e.rand,
    },
    {
      cheie: "camp",
      antet: "Câmp",
      peTelefon: "meta",
      celula: (e) => e.camp,
    },
    {
      cheie: "mesaj",
      antet: "Problemă",
      peTelefon: "titlu",
      // Rândul întreg era tencuit în `bg-danger/8`; `Tabel` nu colorează rânduri
      // (și n-ar trebui — o listă în care TOATE rândurile sunt roșii nu spune
      // nimic). Semnalul rămâne pe text, acolo unde e și problema.
      celula: (e) => <span className="text-danger">{e.mesaj}</span>,
    },
  ];

  if (pas === "analiza") return <Schelet forma="tabel" randuri={6} coloane={3} />;

  return (
    <section className="flex flex-col gap-6">
      {eroare !== null && (
        <StareEroare
          titlu="Importul nu a putut continua"
          eroare={new Error(eroare)}
          reset={() => {
            setEroare(null);
            setPas("incarcare");
          }}
        />
      )}

      {pas === "incarcare" && (
        <div className="border-border rounded-panou border p-6">
          <label htmlFor={idFisier} className="text-foreground text-corp block font-medium">
            Fișier Excel (.xlsx), maximum {Math.round(LIMITA_FISIER_BYTES / 1024 / 1024)} MB
          </label>
          <input
            ref={referintaFisier}
            id={idFisier}
            type="file"
            accept=".xlsx,.xlsm"
            aria-describedby={`${idFisier}-ajutor`}
            className="text-corp mt-2 block w-full"
          />
          <p id={`${idFisier}-ajutor`} className="text-muted-foreground text-corp mt-2">
            Primul rând trebuie să conțină antetul coloanelor. Obligatorii: Marcă, Nume (sau Nume
            complet) și Data angajării.
          </p>
          <Buton
            varianta="primar"
            className="mt-4"
            onClick={() => {
              void incarca();
            }}
          >
            Încarcă și previzualizează
          </Buton>
        </div>
      )}

      {pas === "previzualizare" && previzualizare !== null && (
        <div className="flex flex-col gap-4">
          <p aria-live="polite" className="text-foreground text-corp">
            {previzualizare.totalRanduri} rânduri citite din foaia „{previzualizare.numeFoaie}”:{" "}
            {previzualizare.numarValide} pot fi importate, {previzualizare.invalide.length} probleme
            de corectat.
            {previzualizare.trunchiat && " Fișierul a fost trunchiat la limita de 1000 de rânduri."}
          </p>
          {previzualizare.coloaneIgnorate.length > 0 && (
            <p className="text-foreground text-corp">
              Coloane ignorate: {previzualizare.coloaneIgnorate.join(", ")}.
            </p>
          )}
          {previzualizare.invalide.length === 0 ? (
            <StareGoala
              fel="initiala"
              pictograma={CheckCircle2}
              titlu="Niciun rând respins"
              descriere="Toate rândurile trec validarea."
              compact
            />
          ) : (
            <Tabel
              caption="Rânduri respinse la validare"
              coloane={coloaneRespinse}
              randuri={previzualizare.invalide
                .slice(0, 50)
                .map((e, i) => ({ ...e, cheie: `${String(e.rand)}-${e.camp}-${String(i)}` }))}
              cheieRand={(e) => e.cheie}
              densitate="compact"
              gol={null}
            />
          )}
          <div className="flex flex-wrap gap-3">
            <Buton
              varianta="primar"
              disabled={previzualizare.numarValide === 0}
              onClick={() => {
                void aplica();
              }}
            >
              Importă cele {previzualizare.numarValide} rânduri valide
            </Buton>
            <Buton varianta="secundar" onClick={descarcaRaport}>
              Descarcă raportul rândurilor respinse
            </Buton>
          </div>
        </div>
      )}

      {pas === "aplicare" && (
        <p role="status" aria-live="polite" className="text-corp">
          Se importă… {progres.procesate} din {progres.total} rânduri procesate, {progres.reusite}{" "}
          create.
        </p>
      )}

      {pas === "gata" && (
        <div className="border-success/40 bg-surface rounded-panou border p-4">
          <p role="status" aria-live="polite" className="text-corp font-medium">
            Import încheiat: {progres.reusite} fișe create, {esecuri.length} rânduri respinse la
            scriere.
          </p>
          <Buton varianta="secundar" className="mt-3" onClick={descarcaRaport}>
            Descarcă raportul complet
          </Buton>
        </div>
      )}
    </section>
  );
}
