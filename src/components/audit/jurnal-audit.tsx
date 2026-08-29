// src/components/audit/jurnal-audit.tsx
import { AlertTriangle, Download, FileSearch, RotateCcw } from "lucide-react";

import { FiltreAuditForm } from "@/components/audit/filtre-audit";
import { TabelAudit } from "@/components/audit/tabel-audit";
import { buton } from "@/components/ui/buton";
import {
  interogheazaJurnal,
  listeazaOrganizatiiPentruFiltru,
  serializeazaFiltre,
  type FiltreAudit,
} from "@/lib/queries/audit";
import { createServerSupabase } from "@/lib/supabase/server";
import { ButonDescarcare } from "@/components/incarcare/buton-descarcare";

type Props = Readonly<{
  cale: string;
  filtre: FiltreAudit;
  /** 'platforma' = toate organizațiile (super-admin); 'organizatie' = tenantul curent. */
  mod: "platforma" | "organizatie";
}>;

/**
 * Clasa venea scrisă de mână și se termina în `focus:` — un prefix Tailwind
 * fără utilitar după el. E reziduul unui `sed` care a scos
 * `focus-visible:outline-2` și a lăsat prefixul: Tailwind ignoră clasa tăcut,
 * `tsc` nu vede șiruri, ESLint nici atât. Cele patru linkuri de aici („Încearcă
 * din nou”, „Golește filtrele”, „Descarcă CSV”, paginarea) rămâneau, așadar,
 * fără inelul de focus pe care clasa pretindea că-l pune.
 *
 * `buton({ varianta: "secundar" })` e aceeași formă vizuală, dar cu chenarul de
 * 4,23:1 în loc de `border-border` (1,29:1, sub pragul WCAG 1.4.11 pentru un
 * element pe care se apasă) și cu setul `disabled:` canonic. Focusul vine din
 * regula globală `:focus-visible`, deci nu se mai scrie nicăieri local.
 */
const clasaLink = buton({ varianta: "secundar" });

const href = (cale: string, interogare: string): string =>
  interogare === "" ? cale : `${cale}?${interogare}`;

export async function JurnalAudit({ cale, filtre, mod }: Props) {
  const client = await createServerSupabase();
  const arataOrganizatia = mod === "platforma";
  const organizatii = arataOrganizatia ? await listeazaOrganizatiiPentruFiltru(client) : null;
  const rezultat = await interogheazaJurnal(client, filtre);
  const interogareCurenta = serializeazaFiltre(filtre);
  const linkExport = `/api/export/audit?${serializeazaFiltre(filtre, { scope: mod })}`;

  return (
    <div className="space-y-4">
      <FiltreAuditForm cale={cale} filtre={filtre} organizatii={organizatii} />

      <div aria-live="polite" className="space-y-4">
        {!rezultat.ok ? (
          <div className="border-border bg-surface rounded-panou border p-6 text-center">
            <AlertTriangle aria-hidden="true" className="text-danger mx-auto size-6" />
            <p className="text-foreground text-corp mt-2">{rezultat.mesaj}</p>
            <a
              href={href(cale, `${interogareCurenta}&reincarca=1`)}
              className={`${clasaLink} mt-4`}
            >
              <RotateCcw aria-hidden="true" className="size-4" />
              Încearcă din nou
            </a>
          </div>
        ) : rezultat.randuri.length === 0 ? (
          <div className="border-border bg-surface rounded-panou border p-8 text-center">
            <FileSearch aria-hidden="true" className="text-muted-foreground mx-auto size-6" />
            <p className="text-foreground text-corp mt-2 font-medium">
              Niciun eveniment pentru filtrele alese
            </p>
            <p className="text-muted-foreground text-corp mt-1">
              Încearcă un interval de date mai larg sau renunță la filtre.
            </p>
            <a href={cale} className={`${clasaLink} mt-4`}>
              Golește filtrele
            </a>
          </div>
        ) : (
          <>
            <div className="flex flex-wrap items-center justify-between gap-3">
              <p className="text-muted-foreground text-corp">
                Se afișează {rezultat.randuri.length}{" "}
                {rezultat.randuri.length === 1 ? "eveniment" : "de evenimente"}, de la cel mai
                recent. Jurnalul este doar pentru citire.
              </p>
              {/*
                Exportul colectează pe pagini, în serie (`queries/audit.ts:435-457`),
                deci pe un jurnal mare sunt zeci de dus-întors în spatele unui
                singur clic. Ca `<a href>` nu se vedea nimic; ca buton, se vede
                și refuzul, în loc să înlocuiască ecranul cu text brut.
              */}
              <ButonDescarcare
                href={linkExport}
                eticheta="jurnalul de audit"
                numeImplicit="jurnal-audit.csv"
                varianta="secundar"
              >
                <Download aria-hidden="true" className="size-4" />
                Descarcă CSV
              </ButonDescarcare>
            </div>

            <TabelAudit randuri={rezultat.randuri} arataOrganizatia={arataOrganizatia} />

            <nav aria-label="Paginare jurnal" className="flex flex-wrap items-center gap-3">
              {filtre.cursor !== null ? (
                <a href={href(cale, interogareCurenta)} className={clasaLink}>
                  Prima pagină
                </a>
              ) : null}
              {rezultat.cursorUrmator !== null ? (
                <a
                  href={href(cale, serializeazaFiltre(filtre, { cursor: rezultat.cursorUrmator }))}
                  className={clasaLink}
                >
                  Evenimente mai vechi
                </a>
              ) : (
                <span className="text-muted-foreground text-corp">Ai ajuns la capătul listei.</span>
              )}
            </nav>
          </>
        )}
      </div>
    </div>
  );
}
