// src/app/(app)/revisal/page.tsx
import { FileCheck2 } from "lucide-react";
import { AccesRestrictionat } from "@/components/feedback/acces-restrictionat";
import { AntetPagina } from "@/components/ui/antet-pagina";
import { buton } from "@/components/ui/buton";
import { RandTabel } from "@/components/data/rand-tabel";
import { StareGoala } from "@/components/ui/stare-goala";
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
  intarziat: "bg-danger/8 text-danger ring-1 ring-danger/40",
  astazi: "bg-warning/12 text-foreground ring-1 ring-warning/40",
  in_termen: "bg-surface text-foreground ring-1 ring-border",
  transmis: "bg-surface text-foreground ring-1 ring-success/40",
  anulat: "bg-surface text-muted-foreground ring-1 ring-border",
};

export default async function PaginaRevisal(props: {
  searchParams: Promise<Record<string, string | string[] | undefined>>;
}) {
  const { tenant } = await requireTenant();
  await requireFeature(tenant.organizationId, "nucleu"); // modul dezactivat ⇒ 404
  const permisiuni = await getPermissionMap(tenant.organizationId, tenant.role, tenant.memberId);

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
    <div className="space-y-6">
      <AntetPagina
        titlu="REVISAL"
        descriere={`Registrul general de evidență a salariaților. Netransmiterea în termen a unui eveniment este contravenție, separat pentru fiecare salariat. Situația la ${formatDate(azi)}.`}
      />

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
          <div key={fisa.eticheta} className={`rounded-panou p-4 ${fisa.clasa ?? ""}`}>
            <p className="text-corp font-medium">{fisa.eticheta}</p>
            <p className="text-cifra font-semibold tabular-nums">{fisa.valoare}</p>
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
              className={buton({ varianta: activ ? "primar" : "secundar" })}
            >
              {optiune.eticheta}
            </a>
          );
        })}
        {poateExporta ? <ButonExport /> : null}
      </nav>

      {randuri.length === 0 ? (
        <StareGoala
          fel="filtrata"
          pictograma={FileCheck2}
          titlu="Niciun eveniment pentru filtrul ales"
          descriere="Evenimentele REVISAL se creează automat la înregistrarea unui contract, la modificarea salariului, a funcției sau a normei, la suspendare și la încetare."
          actiune={{ eticheta: "Vezi angajații", href: "/angajati" }}
        />
      ) : (
        <div className="ring-border rounded-panou overflow-x-auto ring-1">
          <table className="text-corp w-full min-w-[64rem] text-left">
            <caption className="sr-only">
              Evenimente REVISAL, ordonate după termenul de transmitere
            </caption>
            <thead className="bg-surface text-foreground">
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
            <tbody className="divide-border bg-background divide-y">
              {randuri.map((rand) => (
                <RandTabel
                  key={rand.id}
                  href={`/angajati/${rand.angajatId}`}
                  className={rand.stare === "intarziat" ? "bg-danger/8" : ""}
                >
                  <td className="px-4 py-3">
                    <span className="text-foreground font-medium">{rand.angajatNume}</span>
                    <span className="text-muted-foreground text-nota block">
                      Marca {rand.angajatMarca}
                      {rand.contractNumar === null ? "" : ` · CIM ${rand.contractNumar}`}
                    </span>
                  </td>
                  <td className="px-4 py-3">{ETICHETE_TIP[rand.tip]}</td>
                  <td className="px-4 py-3 tabular-nums">{formatDate(rand.dataEvenimentului)}</td>
                  <td className="px-4 py-3 tabular-nums">{formatDate(rand.termenTransmitere)}</td>
                  <td className="px-4 py-3">
                    <span
                      className={`text-nota inline-block rounded px-2 py-0.5 font-medium ${CLASA_STARE[rand.stare] ?? ""}`}
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
                      <span className="text-danger text-nota mt-1 block">{rand.eroare}</span>
                    )}
                  </td>
                  <td className="px-4 py-3">{rand.numarInregistrare ?? "—"}</td>
                  <td className="px-4 py-3">
                    {rand.stare === "transmis" || rand.stare === "anulat" ? (
                      <span className="text-muted-foreground text-nota">Nimic de făcut</span>
                    ) : poateActualiza ? (
                      <ActiuniEveniment
                        evenimentId={rand.id}
                        numeAngajat={rand.angajatNume}
                        azi={azi}
                      />
                    ) : (
                      <span className="text-muted-foreground text-nota">Fără drept de marcare</span>
                    )}
                  </td>
                </RandTabel>
              ))}
            </tbody>
          </table>
        </div>
      )}
    </div>
  );
}
