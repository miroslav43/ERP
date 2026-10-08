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
import { formatDate, formatDateTime, todayInBucharest } from "@/lib/format/date";
import { formatLei } from "@/lib/format/money";
import { idDinRuta } from "@/lib/rute/parametri";
import {
  alocarileVehiculului,
  angajatiPentruAlocare,
  citesteVehicul,
  departamentePentruVehicul,
  documenteleVehiculului,
  tipuriDocument,
} from "@/lib/queries/fleet";
import type { AlocareVehicul, DocumentVehicul, TipDocument } from "@/lib/queries/fleet";

import {
  ETICHETE_CATEGORIE,
  ETICHETE_COMBUSTIBIL,
  ETICHETE_SCADENTA,
  ETICHETE_STATUS_VEHICUL,
  stareScadenta,
  TONURI_STATUS_VEHICUL,
} from "../etichete";
import { ButonStergeAlocare } from "./buton-sterge-alocare";
import { ButonStergeDocument } from "./buton-sterge-document";
import { DialogAlocare } from "./dialog-alocare";
import { DialogIncheieAlocare } from "./dialog-incheie-alocare";
import { ButonStergeVehicul } from "./buton-sterge-vehicul";
import { DialogDocument } from "./dialog-document";
import { DialogDocumentNou } from "./dialog-document-nou";
import { DialogKilometraj } from "./dialog-kilometraj";
import { DialogVehicul } from "./dialog-vehicul";

export const metadata: Metadata = { title: "Fișa vehiculului" };

interface ProprietatiPagina {
  readonly params: Promise<{ readonly id: string }>;
}

/**
 * Un rând al tabelului de documente: TIPUL, plus documentul curent dacă există.
 *
 * Rândul era, până acum, doar tipul — iar `cheieRand` întorcea id-ul TIPULUI.
 * Adică identificatorul documentului nu ajungea niciodată la client, deci nu
 * exista nimic de editat sau de șters. Perechea de aici e schimbarea minimă care
 * face posibile butoanele, fără să renunțe la lucrul important: rândurile rămân
 * tipurile, ca un tip obligatoriu necompletat să aibă unde să apară.
 */
interface RandDocument {
  readonly tip: TipDocument;
  readonly documentul: DocumentVehicul | null;
}

export default async function PaginaVehicul({ params }: ProprietatiPagina) {
  // Un segment care nu e UUID nu poate desemna niciun rând: 404, nu 22P02.
  const id = idDinRuta((await params).id);

  const { tenant } = await requireTenant();
  // Două citiri independente, pe tabele diferite. Înlănțuite erau două
  // dus-întorsuri seriale spre PostgREST; costul e integral rețea, nu bază.
  const [, permisiuni] = await Promise.all([
    requireFeature(tenant.organizationId, "fleet"),
    getPermissionMap(tenant.organizationId, tenant.role, tenant.memberId),
  ]);

  if (!can(permisiuni, "vehicles:read", "own")) {
    return (
      <AccesRestrictionat mesaj="Nu aveți dreptul de a consulta parcul auto. Solicitați administratorului organizației rolul potrivit." />
    );
  }

  const vehicul = await citesteVehicul(tenant.organizationId, id);
  if (vehicul === null) notFound();

  const poateScrie = can(permisiuni, "vehicles:create", "all");
  // Modificarea ȘI ștergerea trec amândouă prin `vehicules:update = all`: exact
  // ce cere `vehicule_update` în bază. O poartă mai largă aici ar lăsa un rol să
  // apese butonul și să fie respins tăcut, cu zero rânduri și mesaj de reușită.
  const poateAdministra = can(permisiuni, "vehicles:update", "all");

  // Selectoarele (angajați, departamente) doar pentru cine poate scrie cu ele.
  const [documente, tipuri, alocari, angajati, departamente] = await Promise.all([
    documenteleVehiculului(vehicul.id),
    tipuriDocument(),
    alocarileVehiculului(tenant.organizationId, vehicul.id),
    poateAdministra ? angajatiPentruAlocare(tenant.organizationId) : Promise.resolve([]),
    poateAdministra ? departamentePentruVehicul(tenant.organizationId) : Promise.resolve([]),
  ]);
  const azi = todayInBucharest();
  const alocareDeschisa = alocari.find((a) => a.pana_la === null);
  // Un vehicul vândut sau casat nu se mai predă: baza refuză oricum, iar
  // butonul n-ar face decât să ducă omul spre un P0001.
  const vehiculInParc = vehicul.status !== "vandut" && vehicul.status !== "casat";

  const coloaneAlocari: readonly Coloana<AlocareVehicul>[] = [
    {
      cheie: "sofer",
      antet: "Șofer",
      peTelefon: "titlu",
      celula: (a) => (
        <>
          {a.sofer?.full_name ?? "—"}
          {a.folosinta_personala ? (
            <span className="text-muted-foreground text-nota block">și în scop personal</span>
          ) : null}
          {a.observatii === null ? null : (
            <span className="text-muted-foreground text-nota block">{a.observatii}</span>
          )}
        </>
      ),
    },
    {
      cheie: "de_la",
      antet: "De la",
      latime: "ingusta",
      peTelefon: "meta",
      celula: (a) => formatDateTime(new Date(a.de_la)),
    },
    {
      cheie: "pana_la",
      antet: "Până la",
      latime: "ingusta",
      peTelefon: "meta",
      celula: (a) => (a.pana_la === null ? "în curs" : formatDateTime(new Date(a.pana_la))),
    },
    {
      cheie: "km",
      antet: "Km predare → restituire",
      numeric: true,
      peTelefon: "meta",
      celula: (a) =>
        `${a.km_predare === null ? "—" : a.km_predare.toLocaleString("ro-RO")} → ${
          a.km_restituire === null ? "—" : a.km_restituire.toLocaleString("ro-RO")
        }`,
    },
    ...(poateAdministra
      ? [
          {
            cheie: "actiuni",
            antet: "Acțiuni",
            antetAscuns: true,
            latime: "ingusta",
            peTelefon: "meta",
            celula: (a: AlocareVehicul) => (
              <span className="inline-flex items-center gap-1">
                {a.pana_la === null ? (
                  <DialogIncheieAlocare
                    alocareId={a.id}
                    vehiculId={vehicul.id}
                    sofer={a.sofer?.full_name ?? "șofer"}
                    deLa={a.de_la}
                    kmCurent={vehicul.km_curent}
                  />
                ) : null}
                <ButonStergeAlocare
                  alocareId={a.id}
                  vehiculId={vehicul.id}
                  sofer={a.sofer?.full_name ?? "șofer"}
                  perioada={`${formatDateTime(new Date(a.de_la))} – ${
                    a.pana_la === null ? "în curs" : formatDateTime(new Date(a.pana_la))
                  }`}
                  deschisa={a.pana_la === null}
                />
              </span>
            ),
          } satisfies Coloana<AlocareVehicul>,
        ]
      : []),
  ];
  const poateVedeaFoi = can(permisiuni, "trip_sheets:read", "own");

  const curente = documente.filter((d) => d.este_curent);
  const dupaTip = new Map(curente.map((d) => [d.document_type_id, d]));

  // Se listează TOATE tipurile, nu documentele: un tip obligatoriu fără
  // document trebuie să apară ca „Lipsește”, roșu — altfel absența unui RCA
  // arată identic cu absența unei rubrici. Cele opționale apar și ele, ca omul
  // să vadă ce MAI poate înregistra, dar fără roșu: un opțional lipsă nu e o
  // problemă. Obligatoriile întâi, apoi opționalele, fiecare grup în ordinea
  // nomenclatorului (`ordine`).
  const randuriDocumente: readonly RandDocument[] = [...tipuri]
    .sort((a, b) => Number(b.obligatoriu) - Number(a.obligatoriu) || a.ordine - b.ordine)
    .map((tip) => ({ tip, documentul: dupaTip.get(tip.id) ?? null }));

  // Fără sortare din antet: lista de tipuri nu are cursor, se citește întreagă.
  const coloaneDocumente: readonly Coloana<RandDocument>[] = [
    {
      cheie: "tip",
      antet: "Tip",
      peTelefon: "titlu",
      celula: (rand) => (
        <>
          {rand.tip.denumire}
          {rand.tip.obligatoriu ? (
            <span className="text-muted-foreground text-nota ml-1">(obligatoriu)</span>
          ) : null}
          {/* Observațiile stau sub denumire, nu într-o coloană a lor: șapte
              coloane pe un tabel care cade pe card sub 768px sunt deja multe,
              iar o notă e text lung, nu o valoare de comparat pe verticală. */}
          {rand.documentul?.observatii === null ||
          rand.documentul?.observatii === undefined ? null : (
            <span className="text-muted-foreground text-nota block">
              {rand.documentul.observatii}
            </span>
          )}
        </>
      ),
    },
    {
      cheie: "emitent",
      antet: "Emitent",
      peTelefon: "meta",
      celula: (rand) => rand.documentul?.emitent ?? "—",
    },
    {
      cheie: "valabil",
      antet: "Valabil de la",
      latime: "ingusta",
      peTelefon: "meta",
      celula: (rand) => {
        const valabil = rand.documentul?.valabil_de_la;
        return valabil === undefined || valabil === null ? "—" : formatDate(valabil);
      },
    },
    {
      cheie: "expira",
      antet: "Expiră",
      latime: "ingusta",
      peTelefon: "meta",
      celula: (rand) => {
        const expira = rand.documentul?.expira_la;
        return expira === undefined || expira === null ? "—" : formatDate(expira);
      },
    },
    {
      cheie: "cost",
      antet: "Cost",
      numeric: true,
      latime: "ingusta",
      peTelefon: "meta",
      celula: (rand) => {
        const cost = rand.documentul?.cost;
        return cost === undefined || cost === null ? "—" : formatLei(cost);
      },
    },
    {
      cheie: "stare",
      antet: "Stare",
      peTelefon: "insigna",
      celula: (rand) => {
        // Un tip OPȚIONAL fără document nu e o scadență ratată: pastilă
        // neutră, nu roșu. Un document înregistrat fără dată de expirare (tipul
        // nu cere una) e „fără scadență”, nu „lipsește”.
        if (rand.documentul === null && !rand.tip.obligatoriu) {
          return <Badge ton="neutru">Neînregistrat</Badge>;
        }
        if (rand.documentul !== null && rand.documentul.expira_la === null) {
          return <Scadenta treapta="neaplicabil">Fără scadență</Scadenta>;
        }
        // Un tip obligatoriu fără document dă `null`, iar în flotă `null`
        // înseamnă `lipsa` — treapta cea mai gravă, fiindcă un document care nu
        // există n-are dată de la care să numere și nu se aprinde niciodată
        // singur. Treapta o hotărăște domeniul, nu pastila.
        const stare = stareScadenta(rand.documentul?.expira_la ?? null, azi);
        return <Scadenta treapta={stare}>{ETICHETE_SCADENTA[stare]}</Scadenta>;
      },
    },
    // Coloana lipsește cu totul pentru cine n-o poate folosi — un `<th>` care
    // conduce cinci celule goale e zgomot pentru cititorul de ecran.
    //
    // Pe un rând „Lipsește”, acțiunea e „Adaugă” (`vehicles:create`, poarta lui
    // `adaugaDocument`). Pe un document existent, corectura și ștergerea
    // (`vehicles:update`). Coloana există dacă măcar una dintre ele e posibilă.
    ...(poateAdministra || poateScrie
      ? [
          {
            cheie: "actiuni",
            antet: "Acțiuni",
            antetAscuns: true,
            latime: "ingusta",
            peTelefon: "meta",
            /*
             * `<span inline-flex>`, nu `<div flex>`: pe telefon celula asta se
             * randează într-un `<p>`, iar un `<div>` acolo e marcaj nevalid —
             * browserul închide paragraful singur, arborele nu mai seamănă cu
             * cel de pe server și React randează de două ori, raportând eroare
             * de hidratare. Nimic nu se vede stricat; doar consola țipă.
             */
            celula: (rand: RandDocument) =>
              rand.documentul === null ? (
                poateScrie ? (
                  <DialogDocumentNou vehiculId={vehicul.id} tip={rand.tip} tipuri={tipuri} />
                ) : null
              ) : !poateAdministra ? null : (
                <span className="inline-flex items-center gap-1">
                  <DialogDocument
                    vehiculId={vehicul.id}
                    documentul={rand.documentul}
                    denumireTip={rand.tip.denumire}
                    tipuri={tipuri}
                  />
                  <ButonStergeDocument
                    documentId={rand.documentul.id}
                    vehiculId={vehicul.id}
                    denumireTip={rand.tip.denumire}
                    esteCurent={rand.documentul.este_curent}
                    expiraLa={
                      rand.documentul.expira_la === null
                        ? null
                        : formatDate(rand.documentul.expira_la)
                    }
                  />
                </span>
              ),
          } satisfies Coloana<RandDocument>,
        ]
      : []),
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
              {poateAdministra ? (
                <>
                  <DialogVehicul vehicul={vehicul} departamente={departamente} />
                  <DialogKilometraj vehiculId={vehicul.id} kmCurent={vehicul.km_curent} />
                  <ButonStergeVehicul
                    id={vehicul.id}
                    nrInmatriculare={vehicul.nr_inmatriculare}
                    descriere={`${vehicul.marca} ${vehicul.model}`}
                    stare={ETICHETE_STATUS_VEHICUL[vehicul.status]}
                  />
                </>
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
            ...(vehicul.motiv_iesire === null
              ? []
              : [{ eticheta: "Motivul ieșirii din parc", valoare: vehicul.motiv_iesire }]),
          ]}
        />
      </section>

      {/* Coloana `observatii` exista din 0012 și era citită de `citesteVehicul`,
          dar niciun ecran n-o arăta și niciun formular n-o scria — moartă în
          ambele sensuri. Secțiune proprie, nu rubrică în `ListaDefinitii`: acolo
          sunt patru coloane, iar un text liber de două rânduri le rupe grila. */}
      {vehicul.observatii === null ? null : (
        <section aria-labelledby="observatii" className="border-border rounded-panou border p-4">
          <h2 id="observatii" className="text-corp mb-2 font-semibold">
            Observații
          </h2>
          <p className="text-corp whitespace-pre-line">{vehicul.observatii}</p>
        </section>
      )}

      <section aria-labelledby="alocari" className="space-y-3">
        <div className="flex flex-wrap items-center justify-between gap-3">
          <h2 id="alocari" className="text-sectiune font-semibold">
            Alocări
          </h2>
          {poateAdministra && vehiculInParc ? (
            <DialogAlocare
              vehiculId={vehicul.id}
              kmCurent={vehicul.km_curent}
              soferCurent={
                alocareDeschisa === undefined ? null : (alocareDeschisa.sofer?.full_name ?? "—")
              }
              angajati={angajati}
            />
          ) : null}
        </div>
        <p className="text-muted-foreground text-corp">
          {vehicul.pool
            ? "Mașină comună (pool): se poate folosi fără alocare fixă."
            : alocareDeschisa === undefined
              ? "Vehiculul nu are acum șofer alocat."
              : `Șofer acum: ${alocareDeschisa.sofer?.full_name ?? "—"}, din ${formatDateTime(new Date(alocareDeschisa.de_la))}.`}
        </p>
        <Tabel
          caption="Cine a avut vehiculul, de când până când, cu kilometrajul la predare și la restituire."
          coloane={coloaneAlocari}
          randuri={alocari}
          cheieRand={(a) => a.id}
          gol={
            <p className="text-muted-foreground text-corp">
              Nicio alocare înregistrată pentru acest vehicul.
            </p>
          }
        />
      </section>

      <section aria-labelledby="documente" className="space-y-3">
        <div className="flex flex-wrap items-center justify-between gap-2">
          <h2 id="documente" className="text-sectiune font-semibold">
            Documente
          </h2>
          {poateScrie ? <DialogDocumentNou vehiculId={vehicul.id} tipuri={tipuri} /> : null}
        </div>
        <Tabel
          caption="Documentele vehiculului — obligatoriile întâi, apoi cele opționale — cu starea fiecărei scadențe."
          coloane={coloaneDocumente}
          randuri={randuriDocumente}
          cheieRand={(rand) => rand.tip.id}
          gol={
            <p className="text-muted-foreground text-corp">
              Nomenclatorul de documente e gol: niciun tip de completat.
            </p>
          }
        />

        {poateScrie ? null : (
          <p className="text-muted-foreground text-corp">
            Documentele se adaugă de către cei care administrează parcul auto.
          </p>
        )}
      </section>
    </div>
  );
}
