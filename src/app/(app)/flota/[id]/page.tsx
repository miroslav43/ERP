// src/app/(app)/flota/[id]/page.tsx
import { ListaDefinitii } from "@/components/ui/lista-definitii";
import { notFound } from "next/navigation";
import Link from "next/link";
import type { Metadata } from "next";

import { AccesRestrictionat } from "@/components/feedback/acces-restrictionat";
import { AntetPagina } from "@/components/ui/antet-pagina";
import { Badge } from "@/components/ui/badge";
import { buton } from "@/components/ui/buton";
import { Scadenta } from "@/components/ui/scadenta";
import { Tabel, type Coloana } from "@/components/ui/tabel";
import { can, getPermissionMap } from "@/lib/auth/permissions";
import { requireFeature } from "@/lib/auth/features";
import { requireTenant } from "@/lib/tenant/resolve-tenant";
import { formatDate, todayInBucharest } from "@/lib/format/date";
import { formatLei } from "@/lib/format/money";
import { idDinRuta } from "@/lib/rute/parametri";
import { citesteVehicul, documenteleVehiculului, tipuriDocument } from "@/lib/queries/fleet";

import {
  ETICHETE_CATEGORIE,
  ETICHETE_COMBUSTIBIL,
  ETICHETE_SCADENTA,
  ETICHETE_STATUS_VEHICUL,
  stareScadenta,
  TONURI_STATUS_VEHICUL,
} from "../etichete";
import { FormularDocument } from "./formular-document";

export const metadata: Metadata = { title: "Fișa vehiculului" };

interface ProprietatiPagina {
  readonly params: Promise<{ readonly id: string }>;
}

export default async function PaginaVehicul({ params }: ProprietatiPagina) {
  // Un segment care nu e UUID nu poate desemna niciun rând: 404, nu 22P02.
  const id = idDinRuta((await params).id);

  const { tenant } = await requireTenant();
  await requireFeature(tenant.organizationId, "fleet");
  const permisiuni = await getPermissionMap(tenant.organizationId, tenant.role, tenant.memberId);

  if (!can(permisiuni, "vehicles:read", "own")) {
    return (
      <AccesRestrictionat mesaj="Nu aveți dreptul de a consulta parcul auto. Solicitați administratorului organizației rolul potrivit." />
    );
  }

  const vehicul = await citesteVehicul(tenant.organizationId, id);
  if (vehicul === null) notFound();

  const [documente, tipuri] = await Promise.all([
    documenteleVehiculului(vehicul.id),
    tipuriDocument(),
  ]);
  const azi = todayInBucharest();
  const poateScrie = can(permisiuni, "vehicles:create", "all");
  const poateVedeaFoi = can(permisiuni, "trip_sheets:read", "own");

  const curente = documente.filter((d) => d.este_curent);
  const dupaTip = new Map(curente.map((d) => [d.document_type_id, d]));

  // Se listează TIPURILE, nu documentele: un tip obligatoriu fără document
  // trebuie să apară ca „Lipsește”, roșu. Altfel absența unui RCA arată identic
  // cu absența unei rubrici.
  const randuriDocumente = tipuri.filter((tip) => dupaTip.has(tip.id) || tip.obligatoriu);

  // Fără sortare: lista de tipuri nu are cursor, se citește întreagă și e
  // ordonată de nomenclator (`ordine`).
  const coloaneDocumente: readonly Coloana<(typeof randuriDocumente)[number]>[] = [
    {
      cheie: "tip",
      antet: "Tip",
      peTelefon: "titlu",
      celula: (tip) => (
        <>
          {tip.denumire}
          {tip.obligatoriu ? (
            <span className="text-muted-foreground text-nota ml-1">(obligatoriu)</span>
          ) : null}
        </>
      ),
    },
    {
      cheie: "numar",
      antet: "Număr",
      peTelefon: "meta",
      celula: (tip) => dupaTip.get(tip.id)?.numar ?? "—",
    },
    {
      cheie: "expira",
      antet: "Expiră",
      latime: "ingusta",
      peTelefon: "meta",
      celula: (tip) => {
        const expira = dupaTip.get(tip.id)?.expira_la;
        return expira === undefined || expira === null ? "—" : formatDate(expira);
      },
    },
    {
      cheie: "stare",
      antet: "Stare",
      peTelefon: "insigna",
      celula: (tip) => {
        // Un tip obligatoriu fără document dă `null`, iar în flotă `null`
        // înseamnă `lipsa` — treapta cea mai gravă, fiindcă un document care nu
        // există n-are dată de la care să numere și nu se aprinde niciodată
        // singur. Treapta o hotărăște domeniul, nu pastila.
        const stare = stareScadenta(dupaTip.get(tip.id)?.expira_la ?? null, azi);
        return <Scadenta treapta={stare}>{ETICHETE_SCADENTA[stare]}</Scadenta>;
      },
    },
  ];

  return (
    <div className="space-y-6">
      <div className="space-y-1">
        <p className="text-muted-foreground text-corp">
          <Link href="/flota" className="underline-offset-2 hover:underline">
            Parc auto
          </Link>
        </p>
        <AntetPagina
          titlu={vehicul.nr_inmatriculare}
          descriere={`${vehicul.marca} ${vehicul.model} · ${ETICHETE_CATEGORIE[vehicul.categorie]} · ${ETICHETE_COMBUSTIBIL[vehicul.tip_combustibil]}`}
          actiuni={
            <div className="flex flex-wrap items-center gap-3">
              <Badge ton={TONURI_STATUS_VEHICUL[vehicul.status]} className="shrink-0">
                {ETICHETE_STATUS_VEHICUL[vehicul.status]}
              </Badge>
              {/* Drumul vehicul → cursele lui nu exista deloc: `filtreFoiSchema`
                  avea `vehicul` de la început, dar nimic nu-l scria în adresă.
                  Acum filtrul de pe /flota/foi îl citește și îl arată ca pastilă. */}
              {poateVedeaFoi ? (
                <Link
                  href={`/flota/foi?vehicul=${vehicul.id}`}
                  className={buton({ varianta: "secundar" })}
                >
                  Foile de parcurs
                </Link>
              ) : null}
            </div>
          }
        />
      </div>

      <section aria-label="Date de identificare" className="border-border rounded-panou border p-4">
        {/*
         * `<Camp>`-ul local randa `<dt>` și `<dd>` într-un `<div>` FĂRĂ niciun
         * `<dl>` în jur: marcaj nevalid, iar relația etichetă–valoare pur și
         * simplu nu exista pentru cititorul de ecran — cele două se citeau ca
         * două texte alăturate.
         *
         * În plus, fiecare câmp lipsă trecea prin `?? "—"`. O liniuță nu spune
         * dacă valoarea nu s-a completat sau nu se aplică; `<ListaDefinitii>`
         * primește valoarea BRUTĂ și scrie cuvântul, o dată, în locul tuturor
         * celor șapte `??`.
         */}
        <ListaDefinitii
          coloane={4}
          textNecompletat="Necompletat"
          definitii={[
            { eticheta: "Kilometraj", valoare: `${vehicul.km_curent.toLocaleString("ro-RO")} km` },
            // VIN-ul e identificator: se compară caracter cu caracter cu talonul,
            // deci cifre monospațiate, și se rupe oriunde, fiindcă n-are cuvinte.
            { eticheta: "VIN", valoare: vehicul.vin, identificator: true },
            { eticheta: "An fabricație", valoare: vehicul.an_fabricatie },
            {
              eticheta: "Consum declarat",
              valoare:
                vehicul.consum_mediu_declarat === null
                  ? null
                  : `${vehicul.consum_mediu_declarat} l/100 km`,
            },
            {
              eticheta: "Data achiziției",
              valoare: vehicul.data_achizitie === null ? null : formatDate(vehicul.data_achizitie),
            },
            {
              eticheta: "Valoare",
              valoare:
                vehicul.valoare_achizitie === null ? null : formatLei(vehicul.valoare_achizitie),
            },
            { eticheta: "Culoare", valoare: vehicul.culoare },
            {
              // „implicit” NU e o valoare lipsă: pragul chiar se aplică, doar că
              // vine din setările flotei. De aceea nu se lasă pe `null`.
              eticheta: "Prag salt kilometraj",
              valoare:
                vehicul.prag_salt_km === null
                  ? "implicit, din setările flotei"
                  : `${vehicul.prag_salt_km.toLocaleString("ro-RO")} km`,
            },
          ]}
        />
      </section>

      <section aria-labelledby="documente" className="space-y-3">
        <h2 id="documente" className="text-sectiune font-semibold">
          Documente
        </h2>
        <Tabel
          caption="Documentele vehiculului, cu starea fiecărei scadențe."
          coloane={coloaneDocumente}
          randuri={randuriDocumente}
          cheieRand={(tip) => tip.id}
          gol={
            <p className="text-muted-foreground text-corp">
              Niciun document înregistrat și niciun tip obligatoriu de completat.
            </p>
          }
        />

        {poateScrie ? (
          <FormularDocument vehiculId={vehicul.id} tipuri={tipuri} />
        ) : (
          <p className="text-muted-foreground text-corp">
            Documentele se adaugă de către cei care administrează parcul auto.
          </p>
        )}
      </section>
    </div>
  );
}
