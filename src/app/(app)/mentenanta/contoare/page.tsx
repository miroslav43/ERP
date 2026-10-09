// src/app/(app)/mentenanta/contoare/page.tsx
import type { Metadata } from "next";
import Link from "next/link";
import { Gauge } from "lucide-react";

import { AccesRestrictionat } from "@/components/feedback/acces-restrictionat";
import { AntetPagina } from "@/components/ui/antet-pagina";
import { StareGoala } from "@/components/ui/stare-goala";
import { can, getPermissionMap } from "@/lib/auth/permissions";
import { requireFeature } from "@/lib/auth/features";
import { requireTenant } from "@/lib/tenant/resolve-tenant";
import { todayInBucharest } from "@/lib/format/date";
import {
  cheieContor,
  listeazaEchipamente,
  setariMentenanta,
  ultimeleCitiriCuData,
  type RandEchipament,
} from "@/lib/queries/maintenance";
import { TIPURI_CONTOR } from "@/schemas/maintenance";

import { FormularCitiriLot, type RandContor } from "./formular-citiri-lot";
import { FileModul } from "@/components/ui/file-modul";
import { FILE_MENTENANTA } from "@/config/file-module";

export const metadata: Metadata = { title: "Contoare" };

const ZI_MS = 86_400_000;

/**
 * Pagina „Contoare”: toate echipamentele care au un contor citit vreodată, cu
 * ultima citire, de când nu s-a mai citit și un câmp pentru citirea nouă — un
 * singur „Salvează citirile” pentru tot parcul. Cele fără nicio citire sunt
 * listate separat, cu linkul spre fișă, unde se face prima.
 */
export default async function PaginaContoare() {
  const { tenant } = await requireTenant();
  const [, permisiuni] = await Promise.all([
    requireFeature(tenant.organizationId, "maintenance"),
    getPermissionMap(tenant.organizationId, tenant.role, tenant.memberId),
  ]);
  if (!can(permisiuni, "maintenance:read", "team")) {
    return (
      <AccesRestrictionat mesaj="Nu aveți dreptul de a consulta contoarele. Solicitați administratorului organizației rolul potrivit." />
    );
  }
  const poateScrie = can(permisiuni, "maintenance:update", "team");
  const azi = todayInBucharest();

  // Tot parcul viu (fără casate), paginat keyset până la 500.
  const echipamente: RandEchipament[] = [];
  let cursor: string | null = null;
  for (let pagina = 0; pagina < 5; pagina += 1) {
    const rezultat = await listeazaEchipamente(tenant.organizationId, {
      status: null,
      cauta: null,
      categorie: null,
      punct_lucru: null,
      iscir: null,
      responsabil: null,
      cursor,
      limita: 100,
      sort: "cod",
    });
    echipamente.push(...rezultat.randuri.filter((e) => e.status !== "casat"));
    cursor = rezultat.urmatorulCursor;
    if (cursor === null) break;
  }

  const [ultimele, setari] = await Promise.all([
    ultimeleCitiriCuData(
      tenant.organizationId,
      echipamente.map((e) => e.id),
    ),
    setariMentenanta(tenant.organizationId),
  ]);

  const aziMs = new Date(`${azi}T00:00:00Z`).getTime();
  const randuri: RandContor[] = [];
  const faraContor: RandEchipament[] = [];
  for (const e of echipamente) {
    let areContor = false;
    for (const tip of TIPURI_CONTOR) {
      const u = ultimele.get(cheieContor(e.id, tip));
      if (u === undefined) continue;
      areContor = true;
      const zile = Math.max(
        0,
        Math.round((aziMs - new Date(`${u.data_citirii}T00:00:00Z`).getTime()) / ZI_MS),
      );
      randuri.push({
        equipment_id: e.id,
        cod: e.cod,
        denumire: e.denumire,
        tip,
        ultima: { citire: u.citire, data_citirii: u.data_citirii },
        restant: zile > setari.prag_contor_necitit_zile,
        zileDeLaUltima: zile,
      });
    }
    if (!areContor) faraContor.push(e);
  }
  // Restanțele primele: sunt motivul pentru care se deschide pagina.
  randuri.sort((a, b) => Number(b.restant) - Number(a.restant) || a.cod.localeCompare(b.cod));
  const restante = randuri.filter((r) => r.restant).length;

  return (
    <div className="space-y-6">
      <AntetPagina
        titlu="Contoare"
        descriere={
          restante === 0
            ? `Toate contoarele au citiri mai noi de ${String(setari.prag_contor_necitit_zile)} zile.`
            : `${String(restante)} ${restante === 1 ? "contor necitit" : "contoare necitite"} de peste ${String(setari.prag_contor_necitit_zile)} zile.`
        }
        file={<FileModul eticheta="Navigare mentenanță" file={FILE_MENTENANTA} tenant={tenant} />}
      />

      {randuri.length === 0 ? (
        <StareGoala
          fel="initiala"
          pictograma={Gauge}
          titlu="Niciun contor citit încă"
          descriere="Prima citire a unui echipament se înregistrează de pe fișa lui; de atunci încolo apare aici, pentru citirile periodice în lot."
          actiune={{ eticheta: "Echipamente", href: "/mentenanta/echipamente" }}
        />
      ) : poateScrie ? (
        <FormularCitiriLot randuri={randuri} azi={azi} />
      ) : (
        <ul className="border-border divide-border rounded-panou divide-y border">
          {randuri.map((r) => (
            <li
              key={`${r.equipment_id}:${r.tip}`}
              className="text-corp flex flex-wrap items-center justify-between gap-2 p-3"
            >
              <span>
                <Link
                  href={`/mentenanta/echipamente/${r.equipment_id}#contoare`}
                  className="font-medium underline-offset-2 hover:underline"
                >
                  {r.cod}
                </Link>{" "}
                {r.denumire}
              </span>
              <span className="text-muted-foreground">
                {r.ultima === null ? "—" : `${String(r.ultima.citire)} (${r.ultima.data_citirii})`}
              </span>
            </li>
          ))}
        </ul>
      )}

      {faraContor.length === 0 ? null : (
        <section aria-labelledby="fara-contor" className="space-y-2">
          <h2 id="fara-contor" className="text-sectiune font-semibold">
            Fără contor înregistrat
          </h2>
          <p className="text-muted-foreground text-corp">
            Prima citire fixează punctul de pornire al planurilor pe contor și se face de pe fișă.
          </p>
          <ul className="flex flex-wrap gap-2">
            {faraContor.map((e) => (
              <li key={e.id}>
                <Link
                  href={`/mentenanta/echipamente/${e.id}`}
                  className="border-border rounded-control text-corp inline-block border px-3 py-1 underline-offset-2 hover:underline"
                >
                  {e.cod} — {e.denumire}
                </Link>
              </li>
            ))}
          </ul>
        </section>
      )}
    </div>
  );
}
