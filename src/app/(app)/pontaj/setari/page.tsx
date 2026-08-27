// src/app/(app)/pontaj/setari/page.tsx
import Link from "next/link";
import type { Metadata } from "next";

import { AccesRestrictionat } from "@/components/feedback/acces-restrictionat";
import { AntetPagina, LATIMI } from "@/components/ui/antet-pagina";
import { cn } from "@/lib/ui/cn";
import { can, getPermissionMap } from "@/lib/auth/permissions";
import { requireFeature } from "@/lib/auth/features";
import { requireTenant } from "@/lib/tenant/resolve-tenant";
import { formatDate, todayInBucharest } from "@/lib/format/date";
import {
  istoricSetariPontaj,
  setariPontajComplete,
  type SetariPontajComplete,
} from "@/lib/queries/attendance";

import { FormularSetariPontaj } from "./formular-setari-pontaj";

export const metadata: Metadata = { title: "Setări pontaj" };

export default async function PaginaSetariPontaj() {
  const { tenant } = await requireTenant();
  await requireFeature(tenant.organizationId, "attendance");
  const permisiuni = await getPermissionMap(tenant.organizationId, tenant.role, tenant.memberId);

  if (!can(permisiuni, "attendance:update", "all")) {
    return (
      <div>
        <AccesRestrictionat mesaj="Nu aveți dreptul de a configura parametrii de pontaj." />
      </div>
    );
  }

  const [curente, istoric] = await Promise.all([
    setariPontajComplete(tenant.organizationId, todayInBucharest()),
    istoricSetariPontaj(tenant.organizationId),
  ]);

  return (
    <div className={cn(LATIMI.formular, "space-y-6")}>
      <div className="space-y-2">
        <p className="text-muted-foreground text-corp">
          <Link href="/pontaj" className="underline-offset-2 hover:underline">
            Pontaj
          </Link>
        </p>
        <AntetPagina titlu="Setări pontaj" />
      </div>

      <div
        role="note"
        className="border-warning/40 bg-warning/8 rounded-panou text-corp border p-4"
      >
        <strong>Niciuna dintre valorile de mai jos nu e verificată juridic.</strong> Tabela a fost
        creată intenționat fără valori implicite, ca nimeni să nu calculeze un salariu pe cifre
        presupuse. Confirmați fiecare parametru cu un jurist sau cu inspectoratul teritorial de
        muncă înainte de o plată reală.
      </div>

      {curente === null ? (
        <div
          role="alert"
          className="border-danger/40 bg-danger/8 rounded-panou text-corp border p-4"
        >
          <strong>Nu există niciun set de parametri configurat.</strong> Până acum, sporul de
          noapte, cel de weekend și cel de sărbătoare, intervalul nocturn și termenele de compensare
          nu erau definite nicăieri, iar salarizarea cădea pe valorile din setările ei proprii.
          Completați formularul de mai jos.
        </div>
      ) : (
        <RegulaInVigoare setari={curente} />
      )}

      <FormularSetariPontaj setariCurente={curente} />

      {istoric.length <= 1 ? null : (
        <section
          aria-label="Versiuni anterioare"
          className="border-border rounded-panou border p-4"
        >
          <h2 className="text-corp mb-2 font-medium">Versiuni</h2>
          <ul className="text-muted-foreground text-corp space-y-1">
            {/* Sporurile au ieșit din ecranul de pontaj în 0076 — nu mai plăteau
                nimic. Versiunea se rezumă acum prin ce chiar produce cifre: norma
                și regula pauzei. */}
            {istoric.map((versiune) => (
              <li key={versiune.id}>
                de la {formatDate(versiune.valabil_de_la)} — normă {versiune.ore_pe_zi} h/zi,{" "}
                {versiune.pauza_masa_minute === 0
                  ? "fără pauză configurată"
                  : versiune.pauza_masa_inclusa_in_program
                    ? `pauză ${String(versiune.pauza_masa_minute)} min inclusă în program`
                    : `pauză ${String(versiune.pauza_masa_minute)} min scăzută peste ${String(versiune.pauza_obligatorie_peste_ore)} h`}
              </li>
            ))}
          </ul>
        </section>
      )}
    </div>
  );
}

/**
 * Regula care se aplică ACUM, scrisă în cuvinte.
 *
 * Ecranul ăsta arăta doar „În vigoare de la <dată>" și câmpurile brute. Un patron
 * care voia să verifice ce regulă e activă trebuia să citească cincisprezece
 * câmpuri numerice și să le compună în cap — iar două dintre ele (caseta de
 * pauză plătită și pragul de obligativitate) se pot anula reciproc fără ca
 * nimic să semnaleze.
 *
 * Aici nu se calculează nimic: se TRADUCE ce e salvat. Cifrele derivate stau
 * în panoul viu din formular, care rulează `oreleZilei`.
 */
function RegulaInVigoare({ setari }: { readonly setari: SetariPontajComplete }) {
  const pauzaSeScade = !setari.pauza_masa_inclusa_in_program && setari.pauza_masa_minute > 0;

  const randuri: readonly (readonly [string, string])[] = [
    [
      "Normă zilnică",
      `${String(setari.ore_pe_zi)} h/zi · ${String(setari.ore_pe_saptamana)} h/săptămână`,
    ],
    [
      "Pauză de masă",
      setari.pauza_masa_minute === 0
        ? "nu e configurată"
        : pauzaSeScade
          ? `${String(setari.pauza_masa_minute)} min, SE SCADE din program peste ${String(setari.pauza_obligatorie_peste_ore)} h lucrate`
          : `${String(setari.pauza_masa_minute)} min, inclusă în programul plătit — NU se scade`,
    ],
    [
      "Tură de noapte",
      setari.lucreaza_noaptea
        ? `${setari.noapte_start.slice(0, 5)}–${setari.noapte_sfarsit.slice(0, 5)}, spor peste ${String(setari.prag_ore_noapte)} h/zi`
        : "firma nu lucrează noaptea",
    ],
    ["Repaus săptămânal", setari.lucreaza_weekend ? "se lucrează" : "nu se lucrează"],
    ["Sărbători legale", setari.lucreaza_sarbatori ? "se lucrează" : "nu se lucrează"],
    ["Ore suplimentare", setari.admite_ore_suplimentare ? "se admit" : "nu se admit"],
  ];

  return (
    <section aria-label="Regula în vigoare" className="border-border rounded-panou border p-4">
      <h2 className="text-corp font-medium">
        Regula în vigoare, de la {formatDate(setari.valabil_de_la)}
      </h2>
      <dl className="text-corp mt-3 space-y-1.5">
        {randuri.map(([eticheta, valoare]) => (
          <div key={eticheta} className="flex flex-wrap justify-between gap-x-4">
            <dt className="text-muted-foreground">{eticheta}</dt>
            <dd className="text-foreground text-right">{valoare}</dd>
          </div>
        ))}
      </dl>
      <p className="text-muted-foreground text-nota mt-3">
        Se aplică peste tot unde se calculează ore: ziua din portalul angajatului, planul săptămânal
        și foaia colectivă. O salvare nouă nu rescrie trecutul — creează o versiune cu altă dată de
        intrare în vigoare, iar lunile deja calculate rămân explicabile cu parametrii de atunci.
      </p>
    </section>
  );
}
