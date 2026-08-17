// src/app/(app)/revisal/page.tsx
import { FileCheck2 } from "lucide-react";
import { AccesRestrictionat } from "@/components/feedback/acces-restrictionat";
import { EmptyState } from "@/components/feedback/empty-state";
import { meetsScope } from "@/config/permissions";
import { requireFeature } from "@/lib/auth/features";
import { getPermissionMap, scopeFor } from "@/lib/auth/permissions";
import { formatDate } from "@/lib/format/date";
import {
  FILTRE_IMPLICITE,
  idOrganizatie,
  interogheazaEvenimenteRevisal,
  type FiltruStare,
} from "@/lib/queries/revisal";
import { createServerSupabase } from "@/lib/supabase/server";
import { requireTenant } from "@/lib/tenant/resolve-tenant";
import { ETICHETE_STATUS, ETICHETE_TIP, OPTIUNI_STARE } from "./constante";
import { ActiuniEveniment, ButonExport } from "./actiuni-client";

export const metadata = { title: "REVISAL — evidența evenimentelor" };

const STARI_VALIDE: readonly FiltruStare[] = ["toate", "intarziate", "de_transmis", "transmise"];

function esteStare(valoare: string | undefined): valoare is FiltruStare {
  return valoare !== undefined && STARI_VALIDE.includes(valoare as FiltruStare);
}

const CLASA_STARE: Record<string, string> = {
  intarziat: "bg-red-100 text-red-900 ring-1 ring-red-300",
  astazi: "bg-amber-100 text-amber-900 ring-1 ring-amber-300",
  in_termen: "bg-slate-100 text-slate-800 ring-1 ring-slate-300",
  transmis: "bg-emerald-100 text-emerald-900 ring-1 ring-emerald-300",
  anulat: "bg-slate-100 text-slate-500 ring-1 ring-slate-300",
};

export default async function PaginaRevisal(props: {
  searchParams: Promise<Record<string, string | string[] | undefined>>;
}) {
  const { tenant } = await requireTenant();
  await requireFeature(tenant.organizationId, "nucleu"); // modul dezactivat ⇒ 404
  const permisiuni = await getPermissionMap(tenant.organizationId, tenant.role);

  const scopCitire = scopeFor(permisiuni, "compliance:read") ?? undefined;
  if (!meetsScope(scopCitire, "all")) {
    return (
      <AccesRestrictionat mesaj="Nu aveți dreptul de a consulta registrul general de evidență a salariaților. Solicitați administratorului firmei permisiunea „Conformitate — citire”." />
    );
  }
  const poateActualiza = meetsScope(scopeFor(permisiuni, "compliance:update") ?? undefined, "all");
  const poateExporta = meetsScope(scopeFor(permisiuni, "compliance:export") ?? undefined, "all");

  const parametri = await props.searchParams;
  const stareBruta = Array.isArray(parametri["stare"]) ? parametri["stare"][0] : parametri["stare"];
  const filtre = { ...FILTRE_IMPLICITE, stare: esteStare(stareBruta) ? stareBruta : "toate" };

  const supabase = await createServerSupabase();
  const { randuri, statistici, azi } = await interogheazaEvenimenteRevisal(
    supabase,
    idOrganizatie(tenant),
    filtre,
  );

  return (
    <main className="space-y-6 p-6">
      <header className="space-y-1">
        <h1 className="text-2xl font-semibold text-slate-900">REVISAL</h1>
        <p className="text-sm text-slate-600">
          Registrul general de evidență a salariaților. Netransmiterea în termen a unui eveniment
          este contravenție, separat pentru fiecare salariat. Situația la {formatDate(azi)}.
        </p>
      </header>

      <section aria-label="Situația termenelor" className="grid grid-cols-2 gap-3 md:grid-cols-4">
        {[
          {
            eticheta: "Întârziate",
            valoare: statistici.intarziate,
            clasa: CLASA_STARE["intarziat"],
          },
          { eticheta: "Cu termen azi", valoare: statistici.astazi, clasa: CLASA_STARE["astazi"] },
          { eticheta: "În termen", valoare: statistici.inTermen, clasa: CLASA_STARE["in_termen"] },
          { eticheta: "Transmise", valoare: statistici.transmise, clasa: CLASA_STARE["transmis"] },
        ].map((fisa) => (
          <div key={fisa.eticheta} className={`rounded-lg p-4 ${fisa.clasa ?? ""}`}>
            <p className="text-sm font-medium">{fisa.eticheta}</p>
            <p className="text-3xl font-semibold tabular-nums">{fisa.valoare}</p>
          </div>
        ))}
      </section>

      <nav aria-label="Filtrare după stare" className="flex flex-wrap gap-2">
        {OPTIUNI_STARE.map((optiune) => {
          const activ = optiune.valoare === filtre.stare;
          return (
            <a
              key={optiune.valoare}
              href={`/revisal?stare=${optiune.valoare}`}
              aria-current={activ ? "page" : undefined}
              className={`rounded-md px-3 py-1.5 text-sm focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-slate-900 ${
                activ ? "bg-slate-900 text-white" : "bg-white text-slate-700 ring-1 ring-slate-300"
              }`}
            >
              {optiune.eticheta}
            </a>
          );
        })}
        {poateExporta ? <ButonExport /> : null}
      </nav>

      {randuri.length === 0 ? (
        <EmptyState
          icon={FileCheck2}
          title="Niciun eveniment pentru filtrul ales"
          description="Evenimentele REVISAL se creează automat la înregistrarea unui contract, la modificarea salariului, a funcției sau a normei, la suspendare și la încetare."
          action={{ label: "Vezi angajații", href: "/angajati" }}
        />
      ) : (
        <div className="overflow-x-auto rounded-lg ring-1 ring-slate-200">
          <table className="w-full min-w-[64rem] text-left text-sm">
            <caption className="sr-only">
              Evenimente REVISAL, ordonate după termenul de transmitere
            </caption>
            <thead className="bg-slate-50 text-slate-700">
              <tr>
                <th scope="col" className="px-4 py-2">
                  Salariat
                </th>
                <th scope="col" className="px-4 py-2">
                  Eveniment
                </th>
                <th scope="col" className="px-4 py-2">
                  Data
                </th>
                <th scope="col" className="px-4 py-2">
                  Termen
                </th>
                <th scope="col" className="px-4 py-2">
                  Stare
                </th>
                <th scope="col" className="px-4 py-2">
                  Înregistrare ITM
                </th>
                <th scope="col" className="px-4 py-2">
                  Acțiuni
                </th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-100 bg-white">
              {randuri.map((rand) => (
                <tr key={rand.id} className={rand.stare === "intarziat" ? "bg-red-50" : undefined}>
                  <td className="px-4 py-3">
                    <span className="font-medium text-slate-900">{rand.angajatNume}</span>
                    <span className="block text-xs text-slate-500">
                      Marca {rand.angajatMarca}
                      {rand.contractNumar === null ? "" : ` · CIM ${rand.contractNumar}`}
                    </span>
                  </td>
                  <td className="px-4 py-3">{ETICHETE_TIP[rand.tip]}</td>
                  <td className="px-4 py-3 tabular-nums">{formatDate(rand.dataEvenimentului)}</td>
                  <td className="px-4 py-3 tabular-nums">{formatDate(rand.termenTransmitere)}</td>
                  <td className="px-4 py-3">
                    <span
                      className={`inline-block rounded px-2 py-0.5 text-xs font-medium ${CLASA_STARE[rand.stare] ?? ""}`}
                    >
                      {rand.stare === "intarziat"
                        ? `Întârziat cu ${rand.zileIntarziere} ${rand.zileIntarziere === 1 ? "zi" : "zile"}`
                        : rand.stare === "astazi"
                          ? "Termen astăzi"
                          : rand.stare === "in_termen"
                            ? `Mai sunt ${rand.zileRamase} ${rand.zileRamase === 1 ? "zi" : "zile"}`
                            : ETICHETE_STATUS[rand.status]}
                    </span>
                    {rand.eroare === null ? null : (
                      <span className="mt-1 block text-xs text-red-700">{rand.eroare}</span>
                    )}
                  </td>
                  <td className="px-4 py-3">{rand.numarInregistrare ?? "—"}</td>
                  <td className="px-4 py-3">
                    {rand.stare === "transmis" || rand.stare === "anulat" ? (
                      <span className="text-xs text-slate-500">Nimic de făcut</span>
                    ) : poateActualiza ? (
                      <ActiuniEveniment
                        evenimentId={rand.id}
                        numeAngajat={rand.angajatNume}
                        azi={azi}
                      />
                    ) : (
                      <span className="text-xs text-slate-500">Fără drept de marcare</span>
                    )}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}
    </main>
  );
}
