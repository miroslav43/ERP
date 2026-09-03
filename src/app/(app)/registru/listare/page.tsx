// src/app/(app)/registru/listare/page.tsx
//
// Registrul, în forma în care se pune pe masa inspectorului.
//
// ── ANTETUL NU E DECORATIV ──────────────────────────────────────────────────
// OMFP 2634/2015, Anexa 1, pct. 58 lit. k): programul trebuie „să asigure
// listări clare, inteligibile și complete, care să conțină următoarele elemente
// de identificare, în antet sau pe fiecare pagină:
//   - tipul documentului sau al situației;
//   - denumirea entității;
//   - perioada la care se referă informația;
//   - datarea listărilor;
//   - paginarea cronologică;
//   - precizarea programului informatic și a versiunii utilizate."
//
// Toate șase sunt mai jos, în ordinea aia. Ultimul e motivul pentru care există
// `src/config/versiune.ts`.
//
// ── DE CE COLOANELE SUNT ALTELE DECÂT ÎN ARHIVĂ ─────────────────────────────
// Arhiva e un ecran de căutare; listarea e documentul cerut de Ordinul 217/1996
// art. 9, care ENUMERĂ coloanele registrului de intrare-ieșire. Aici apar toate,
// inclusiv cele aproape mereu goale (file, anexe, compartiment), fiindcă lipsa
// unei coloane dintr-un registru e o obiecție, iar o celulă goală nu e.
//
// ── DE CE O PAGINĂ SEPARATĂ, NU UN `?tipar=1` ───────────────────────────────
// Se deschide în filă nouă și se tipărește fără meniul aplicației în hârtie.

import type { Metadata } from "next";

import { AccesRestrictionat } from "@/components/feedback/acces-restrictionat";
import { can, getPermissionMap } from "@/lib/auth/permissions";
import { requireFeature } from "@/lib/auth/features";
import { requireTenant } from "@/lib/tenant/resolve-tenant";
import { formatDate, formatDateTime } from "@/lib/format/date";
import { PROGRAM_SI_VERSIUNE } from "@/config/versiune";
import {
  citesteExercitiu,
  listeazaRegistru,
  MAX_RANDURI_EXPORT,
  parseazaFiltre,
} from "@/lib/queries/registru";

import { ETICHETE_SENS, eticheteazaTipDocument } from "../etichete";

export const metadata: Metadata = { title: "Listare registru" };

export const dynamic = "force-dynamic";

interface ProprietatiPagina {
  readonly searchParams: Promise<Record<string, string | string[] | undefined>>;
}

const CAPETE = [
  "Nr. înreg.",
  "Data înreg.",
  "Sens",
  "Nr. doc. emitent",
  "Data doc.",
  "Emitent",
  "Conținutul documentului în rezumat",
  "File",
  "Anexe",
  "Compartiment",
  "Data expedierii",
  "Modul rezolvării",
  "Destinatar",
  "Conexat la",
] as const;

export default async function PaginaListareRegistru({ searchParams }: ProprietatiPagina) {
  const { tenant } = await requireTenant();
  // Două citiri independente, pe tabele diferite. Înlănțuite erau două
  // dus-întorsuri seriale spre PostgREST; costul e integral rețea, nu bază.
  const [, permisiuni] = await Promise.all([
    requireFeature(tenant.organizationId, "nucleu"),
    getPermissionMap(tenant.organizationId, tenant.role, tenant.memberId),
  ]);

  if (!can(permisiuni, "registru:export", "all")) {
    return (
      <div>
        <AccesRestrictionat mesaj="Nu aveți dreptul de a lista registrul documentelor." />
      </div>
    );
  }

  const brute = await searchParams;
  const filtre = { ...parseazaFiltre(brute), cursor: null, limita: MAX_RANDURI_EXPORT };

  const [pagina, exercitiu] = await Promise.all([
    listeazaRegistru(tenant.organizationId, filtre),
    citesteExercitiu(tenant.organizationId, filtre.an),
  ]);

  // Perioada: intervalul cerut, dacă a fost dat; altfel anul întreg, care e
  // perioada naturală a registrului (art. 9).
  const perioada =
    filtre.deLa !== null || filtre.panaLa !== null
      ? `${filtre.deLa === null ? `01.01.${filtre.an}` : formatDate(filtre.deLa)} – ${
          filtre.panaLa === null ? `31.12.${filtre.an}` : formatDate(filtre.panaLa)
        }`
      : `1 ianuarie – 31 decembrie ${filtre.an}`;

  // Registrul se citește cronologic, de la 1 în sus — invers față de arhivă,
  // unde noul e sus. „În ordinea primirii lor", art. 9.
  const randuri = [...pagina.randuri].sort((a, b) => a.numar - b.numar);

  const trunchiat = pagina.total > randuri.length;

  return (
    <div className="mx-auto max-w-[1400px] bg-white p-6 text-black print:p-0">
      {/* ── Antetul cerut de pct. 58 lit. k), toate cele șase elemente ── */}
      <header className="mb-4 border-b-2 border-black pb-3">
        <h1 className="text-lg font-bold">
          Registru de intrare-ieșire a documentelor
          {/* 1. tipul situației */}
        </h1>
        <p className="mt-1 text-sm font-semibold">
          {tenant.name}
          {/* 2. denumirea entității */}
        </p>
        <dl className="mt-2 grid grid-cols-2 gap-x-8 gap-y-0.5 text-xs sm:grid-cols-3">
          <div className="flex gap-1">
            <dt className="font-medium">Perioada:</dt>
            <dd>{perioada}</dd>
            {/* 3. perioada la care se referă informația */}
          </div>
          <div className="flex gap-1">
            <dt className="font-medium">Data listării:</dt>
            <dd>{formatDateTime(new Date())}</dd>
            {/* 4. datarea listărilor */}
          </div>
          <div className="flex gap-1">
            <dt className="font-medium">Program:</dt>
            <dd>{PROGRAM_SI_VERSIUNE}</dd>
            {/* 6. programul informatic și versiunea */}
          </div>
          <div className="flex gap-1">
            <dt className="font-medium">Înregistrări:</dt>
            <dd>{randuri.length}</dd>
          </div>
          <div className="flex gap-1">
            <dt className="font-medium">Exercițiul:</dt>
            <dd>
              {exercitiu === null || exercitiu.stare === "deschis"
                ? "deschis"
                : `închis${
                    exercitiu.inchisLa === null
                      ? ""
                      : ` la ${formatDate(exercitiu.inchisLa.slice(0, 10))}`
                  }`}
            </dd>
          </div>
          {exercitiu?.amprenta == null ? null : (
            <div className="flex gap-1">
              <dt className="font-medium">Amprentă:</dt>
              <dd className="font-mono break-all">{exercitiu.amprenta}</dd>
            </div>
          )}
        </dl>
        {exercitiu?.redeschisLa == null ? null : (
          <p className="mt-2 text-xs font-semibold">
            Exercițiu REDESCHIS la {formatDate(exercitiu.redeschisLa.slice(0, 10))}
            {exercitiu.motivRedeschidere === null ? "" : ` — motiv: ${exercitiu.motivRedeschidere}`}
          </p>
        )}
      </header>

      {trunchiat ? (
        <p className="mb-3 border border-black p-2 text-xs font-semibold">
          Atenție: registrul filtrat are {pagina.total} înregistrări, iar listarea aceasta conține
          primele {randuri.length}. Restrânge perioada și listează pe bucăți, ca evidența să fie
          completă.
        </p>
      ) : null}

      <table className="w-full border-collapse text-[10px]">
        <thead>
          <tr>
            {CAPETE.map((c) => (
              <th key={c} className="border border-black px-1 py-1 text-left align-bottom">
                {c}
              </th>
            ))}
          </tr>
        </thead>
        <tbody>
          {randuri.map((r) => (
            <tr key={r.id} className="break-inside-avoid">
              <td className="border border-black px-1 py-0.5 font-mono whitespace-nowrap">
                {r.numar}
                {r.anulatLa === null ? "" : " (ANULAT)"}
              </td>
              <td className="border border-black px-1 py-0.5 whitespace-nowrap">
                {formatDate(r.dataInregistrare)}
              </td>
              <td className="border border-black px-1 py-0.5">{ETICHETE_SENS[r.sens]}</td>
              <td className="border border-black px-1 py-0.5">{r.numarDocumentEmitent ?? ""}</td>
              <td className="border border-black px-1 py-0.5 whitespace-nowrap">
                {r.dataDocumentEmitent === null ? "" : formatDate(r.dataDocumentEmitent)}
              </td>
              <td className="border border-black px-1 py-0.5">{r.emitent ?? ""}</td>
              <td className="border border-black px-1 py-0.5">
                {eticheteazaTipDocument(r.tipDocument)} — {r.continutRezumat}
                {r.motivAnulare === null ? "" : ` (anulat: ${r.motivAnulare})`}
              </td>
              <td className="border border-black px-1 py-0.5 text-right">{r.numarFile ?? ""}</td>
              <td className="border border-black px-1 py-0.5 text-right">{r.numarAnexe ?? ""}</td>
              <td className="border border-black px-1 py-0.5">{r.compartiment ?? ""}</td>
              <td className="border border-black px-1 py-0.5 whitespace-nowrap">
                {r.dataExpedierii === null ? "" : formatDate(r.dataExpedierii)}
              </td>
              <td className="border border-black px-1 py-0.5">{r.modRezolvare ?? ""}</td>
              <td className="border border-black px-1 py-0.5">{r.destinatar ?? ""}</td>
              <td className="border border-black px-1 py-0.5">
                {r.conexatLa === null ? "" : "da"}
              </td>
            </tr>
          ))}
        </tbody>
      </table>

      {/*
        5. paginarea cronologică. Numărul paginii îl pune browserul la tipărire;
        rândurile sunt deja în ordinea numerelor, iar antetul de tabel se repetă
        pe fiecare pagină prin `thead` — comportament de tipar, nu CSS propriu.
      */}
      <footer className="mt-3 text-[10px]">
        Rândurile sunt listate cronologic, în ordinea numerelor de înregistrare, conform art. 9 din
        Instrucțiunile aprobate prin Ordinul Arhivelor Naționale nr. 217/1996.
      </footer>
    </div>
  );
}
