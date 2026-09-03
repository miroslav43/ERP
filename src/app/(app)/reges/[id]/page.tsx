// src/app/(app)/reges/[id]/page.tsx
import { notFound } from "next/navigation";

import { AccesRestrictionat } from "@/components/feedback/acces-restrictionat";
import { AntetPagina } from "@/components/ui/antet-pagina";
import { Callout } from "@/components/ui/callout";
import { ListaDefinitii } from "@/components/ui/lista-definitii";
import { Tabel, type Coloana } from "@/components/ui/tabel";
import { meetsScope } from "@/config/permissions";
import {
  propuneNormaTimpMunca,
  propuneTipContract,
  propuneTipNorma,
} from "@/domain/reges/operatii";
import { requireFeature } from "@/lib/auth/features";
import { getPermissionMap, scopeFor } from "@/lib/auth/permissions";
import { formatDate } from "@/lib/format/date";
import { citesteDetaliuMesaj, idOrganizatie, type RandApel } from "@/lib/queries/reges";
import { createServerSupabase } from "@/lib/supabase/server";
import { requireTenant } from "@/lib/tenant/resolve-tenant";
import { ETICHETE_OPERATIE, ETICHETE_STARE_MESAJ } from "../constante";
import { FormularClasificare } from "./formular-clasificare";

export const metadata = { title: "REGES-Online — mesaj" };

const COLOANE_APELURI: readonly Coloana<RandApel>[] = [
  {
    cheie: "cand",
    antet: "Când",
    peTelefon: "titlu",
    celula: (a) => new Date(a.creatLa).toLocaleString("ro-RO"),
  },
  { cheie: "cerere", antet: "Cerere", celula: (a) => `${a.metoda} ${a.cale}` },
  {
    cheie: "status",
    antet: "Răspuns",
    numeric: true,
    celula: (a) => (a.httpStatus === null ? "fără răspuns" : String(a.httpStatus)),
  },
  {
    cheie: "durata",
    antet: "Durată",
    numeric: true,
    celula: (a) => (a.durataMs === null ? "—" : `${a.durataMs} ms`),
  },
  { cheie: "eroare", antet: "Eroare", celula: (a) => a.eroare ?? "—" },
];

export default async function PaginaMesajReges(props: { params: Promise<{ id: string }> }) {
  const { tenant } = await requireTenant();
  // Două citiri independente, pe tabele diferite. Înlănțuite erau două
  // dus-întorsuri seriale spre PostgREST; costul e integral rețea, nu bază.
  const [, permisiuni] = await Promise.all([
    requireFeature(tenant.organizationId, "reges"),
    getPermissionMap(tenant.organizationId, tenant.role, tenant.memberId),
  ]);

  if (!meetsScope(scopeFor(permisiuni, "reges:read") ?? undefined, "all")) {
    return (
      <AccesRestrictionat mesaj="Nu aveți dreptul de a consulta mesajele către Inspecția Muncii. Solicitați administratorului firmei permisiunea „REGES — citire”." />
    );
  }
  const poateEdita = meetsScope(scopeFor(permisiuni, "reges:update") ?? undefined, "all");

  const { id } = await props.params;
  const supabase = await createServerSupabase();
  const detaliu = await citesteDetaliuMesaj(supabase, idOrganizatie(tenant), id);
  if (detaliu === null) notFound();

  const { mesaj, clasificare, apeluri } = detaliu;

  // Ce se va trimite, dacă operatorul n-a ales explicit. Se afișează ca atare —
  // ascunsă, deducția devine o presupunere nevăzută care ajunge la o autoritate.
  const dedus =
    clasificare === null
      ? null
      : {
          tipContract:
            clasificare.tipContract ??
            propuneTipContract({
              regimSpecial: clasificare.regimSpecial as "ucenicie" | "internship" | "zilier" | null,
              modLucru: clasificare.modLucru as "sediu" | "telemunca" | "domiciliu" | "mixt",
            }),
          tipNorma: clasificare.tipNorma ?? propuneTipNorma(clasificare.normaOreSaptamana),
          normaTimp:
            clasificare.normaTimp ??
            propuneNormaTimpMunca(clasificare.normaOreZi, clasificare.normaOreSaptamana),
          repartizare: clasificare.repartizare ?? "OreDeZi",
        };

  const esteIncetare = mesaj.operatie.includes("Incetare");

  return (
    <div className="space-y-8">
      <AntetPagina
        firimituri={[{ eticheta: "REGES-Online", href: "/reges" }, { eticheta: "Mesaj" }]}
        titlu={ETICHETE_OPERATIE[mesaj.operatie] ?? mesaj.operatie}
        descriere={`${mesaj.angajatNume ?? "—"}${mesaj.contractNumar === null ? "" : ` · CIM ${mesaj.contractNumar}`}`}
      />

      {mesaj.stare === "esuat" ? (
        <Callout fel="eroare" titlu="Inspecția Muncii a respins mesajul">
          {mesaj.rezultatMesaj ?? mesaj.eroare ?? "Fără explicație."}
        </Callout>
      ) : null}

      {mesaj.stare === "de_transmis" && !mesaj.transmisibil ? (
        <Callout fel="atentie" titlu="Așteaptă mesajul precedent">
          Mesajul se transmite prin referință la o entitate pe care Inspecția Muncii nu ne-a
          confirmat-o încă. Pleacă singur imediat ce sosește identificatorul.
        </Callout>
      ) : null}

      <section className="space-y-3">
        <h2 className="text-foreground font-medium">Starea mesajului</h2>
        <ListaDefinitii
          textNecompletat="—"
          definitii={[
            { eticheta: "Stare", valoare: ETICHETE_STARE_MESAJ[mesaj.stare] ?? mesaj.stare },
            { eticheta: "Creat", valoare: formatDate(mesaj.creatLa.slice(0, 10)) },
            {
              eticheta: "Trimis",
              valoare: mesaj.trimisLa === null ? null : formatDate(mesaj.trimisLa.slice(0, 10)),
            },
            {
              eticheta: "Răspuns",
              valoare: mesaj.raspunsLa === null ? null : formatDate(mesaj.raspunsLa.slice(0, 10)),
            },
            { eticheta: "Încercări", valoare: mesaj.incercari },
            { eticheta: "Rezultat", valoare: mesaj.rezultatCod },
            // Cele trei identificatoare sunt singurul fir prin care un mesaj de
            // la noi se leagă de un rând din registrul Inspecției Muncii. Fără
            // ele, o reclamație nu se poate urmări în niciun sens.
            { eticheta: "MessageId (al nostru)", valoare: mesaj.messageId, identificator: true },
            { eticheta: "ResponseId (recipisa)", valoare: mesaj.responseId, identificator: true },
            {
              eticheta: "Identificator REGES al entității",
              valoare: mesaj.referintaId,
              identificator: true,
              lat: true,
            },
            ...(mesaj.rezultatMesaj === null
              ? []
              : [{ eticheta: "Explicația ITM", valoare: mesaj.rezultatMesaj, lat: true }]),
          ]}
        />
      </section>

      {clasificare !== null && dedus !== null ? (
        <section className="space-y-3">
          <h2 className="text-foreground font-medium">Clasificarea cerută de REGES</h2>
          <p className="text-muted-foreground text-nota">
            Contractul {clasificare.numar} · {clasificare.normaOreZi} ore/zi,{" "}
            {clasificare.normaOreSaptamana} ore/săptămână ·{" "}
            {clasificare.durataDeterminata ? "durată determinată" : "durată nedeterminată"} · cod
            COR {clasificare.codCor ?? "lipsă"}
          </p>
          <FormularClasificare
            poateEdita={poateEdita && mesaj.stare === "de_transmis"}
            valori={{
              contractId: clasificare.contractId,
              tipContract: dedus.tipContract,
              tipNorma: dedus.tipNorma,
              normaTimp: dedus.normaTimp,
              repartizare: dedus.repartizare,
              temeiIncetare: clasificare.temeiIncetare,
              dedus: clasificare.tipContract === null,
              cuTemeiIncetare: esteIncetare,
            }}
          />
        </section>
      ) : null}

      <section className="space-y-3">
        <h2 className="text-foreground font-medium">Apeluri către Inspecția Muncii</h2>
        <p className="text-muted-foreground text-nota">
          Jurnalul păstrează metoda, calea, statusul și durata — niciodată corpurile. O cerere de
          salariat e, în întregime, dată personală.
        </p>
        <Tabel
          caption="Apeluri API pentru acest mesaj"
          coloane={COLOANE_APELURI}
          randuri={apeluri}
          cheieRand={(a) => a.id}
          densitate="compact"
          gol={<p className="text-muted-foreground text-nota">Mesajul n-a plecat încă.</p>}
        />
      </section>
    </div>
  );
}
