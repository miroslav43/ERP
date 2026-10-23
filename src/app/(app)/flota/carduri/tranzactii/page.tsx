import { Download, FileUp, Receipt } from "lucide-react";
import type { Metadata } from "next";
import Link from "next/link";

import { AccesRestrictionat } from "@/components/feedback/acces-restrictionat";
import { AntetPagina } from "@/components/ui/antet-pagina";
import { Badge } from "@/components/ui/badge";
import { buton } from "@/components/ui/buton";
import { FileModul } from "@/components/ui/file-modul";
import { Paginare } from "@/components/ui/paginare";
import { StareGoala } from "@/components/ui/stare-goala";
import { Tabel, type Coloana } from "@/components/ui/tabel";
import { FILE_FLOTA } from "@/config/file-module";
import { mascheaza } from "@/domain/fleet/carduri/card";
import { etichetaEmitent } from "@/domain/fleet/carduri/emitenti";
import { STARI_POTRIVIRE } from "@/domain/fleet/carduri/potrivire";
import { etichetaLuna, lunaDinZi, lunaMutata, lunaValida } from "@/domain/fleet/rapoarte";
import { requireFeature } from "@/lib/auth/features";
import { can, getPermissionMap } from "@/lib/auth/permissions";
import { formatDate, formatDateTime, todayInBucharest } from "@/lib/format/date";
import { vehiculeDupaId } from "@/lib/queries/fleet";
import {
  alimentariCandidate,
  listeazaImporturi,
  listeazaTranzactii,
  sumarLuna,
  type RandImport,
  type RandTranzactie,
} from "@/lib/queries/fleet-carduri";
import { requireTenant } from "@/lib/tenant/resolve-tenant";
import { filtreTranzactiiSchema } from "@/schemas/fleet-carduri";

import {
  ETICHETE_CATEGORIE,
  ETICHETE_STARE_POTRIVIRE,
  ORDINE_STARI,
  TON_STARE_POTRIVIRE,
} from "../etichete";
import {
  ButonAnuleazaImport,
  ButonReactiveaza,
  ButonRepotriveste,
  DialogIgnora,
  DialogLeaga,
} from "./actiuni-tranzactie";

export const metadata: Metadata = { title: "Tranzacții de card" };

interface ProprietatiPagina {
  readonly searchParams: Promise<Record<string, string | string[] | undefined>>;
}

function text(valoare: string | string[] | undefined): string | undefined {
  return typeof valoare === "string" && valoare.length > 0 ? valoare : undefined;
}

const LEI = new Intl.NumberFormat("ro-RO", {
  minimumFractionDigits: 2,
  maximumFractionDigits: 2,
});
const LITRI = new Intl.NumberFormat("ro-RO", { maximumFractionDigits: 2 });

/** Stările pe care se mai poate decide ceva (legare, ignorare). */
const STARI_DE_DECIS = new Set([
  "fara_alimentare",
  "diferenta",
  "fara_foaie",
  "vehicul_necunoscut",
  "card_necunoscut",
  "necombustibil",
]);

/**
 * Tranzacțiile din extrasele de card, pe lună (0214, F12b): raportul de
 * nepotriviri sus, tabelul cu cursor keyset dedesubt, importurile lunii la final.
 *
 * Poarta e `vehicles:update = all`: tranzacțiile le vede doar `vehicles:read =
 * all` (`tranzactii_card_select`, implicita I-b3), iar acțiunile de pe rând cer
 * `vehicles:update = all`. Luna e obligatorie (implicit luna trecută): fără ea,
 * `max_rows` ar tăia tăcut răspunsul.
 */
export default async function PaginaTranzactiiCard({ searchParams }: ProprietatiPagina) {
  const { tenant } = await requireTenant();
  const [, permisiuni, parametri] = await Promise.all([
    requireFeature(tenant.organizationId, "fleet"),
    getPermissionMap(tenant.organizationId, tenant.role, tenant.memberId),
    searchParams,
  ]);

  if (!can(permisiuni, "vehicles:update", "all") || !can(permisiuni, "vehicles:read", "all")) {
    return (
      <AccesRestrictionat mesaj="Tranzacțiile din extrasele de card le vede doar administratorul parcului: leagă un șofer de un loc și o oră." />
    );
  }

  const lunaTrecuta = lunaMutata(lunaDinZi(todayInBucharest()), -1);
  const lunaCeruta = text(parametri["luna"]);
  const filtre = filtreTranzactiiSchema.parse({
    luna: lunaCeruta !== undefined && lunaValida(lunaCeruta) ? lunaCeruta : lunaTrecuta,
    stare: STARI_POTRIVIRE.find((s) => s === text(parametri["stare"])) ?? null,
    cursor: text(parametri["cursor"]) ?? null,
    limita: [25, 50, 100].find((l) => String(l) === text(parametri["limita"])) ?? 50,
  });

  const [lista, sumar, importuri] = await Promise.all([
    listeazaTranzactii(tenant.organizationId, filtre),
    sumarLuna(tenant.organizationId, filtre.luna),
    listeazaImporturi(tenant.organizationId),
  ]);
  const { randuri } = lista;
  const perechi = randuri
    .filter((r) => r.vehicle_id !== null && r.data_ro !== null && r.categorie === "combustibil")
    .map((r) => ({ vehicleId: r.vehicle_id ?? "", dataRo: r.data_ro ?? "" }));
  const [vehicule, candidati] = await Promise.all([
    vehiculeDupaId(
      tenant.organizationId,
      randuri.map((r) => r.vehicle_id).filter((v): v is string => v !== null),
    ),
    alimentariCandidate(tenant.organizationId, perechi),
  ]);

  function adresa(schimba: (p: URLSearchParams) => void): string {
    const p = new URLSearchParams();
    p.set("luna", filtre.luna);
    if (filtre.stare !== null) p.set("stare", filtre.stare);
    if (filtre.limita !== 50) p.set("limita", String(filtre.limita));
    schimba(p);
    return `/flota/carduri/tranzactii?${p.toString()}`;
  }

  const descriere = (r: RandTranzactie) =>
    `${r.card_ultimele_cifre === null ? (r.nr_inmatriculare_extras ?? "") : mascheaza(r.card_ultimele_cifre)} din ${formatDateTime(r.efectuat_la)}`;

  const coloane: readonly Coloana<RandTranzactie>[] = [
    {
      cheie: "moment",
      antet: "Data",
      peTelefon: "titlu",
      celula: (r) => (
        <>
          <span className="font-medium">
            {r.are_ora
              ? formatDateTime(r.efectuat_la)
              : r.data_ro === null
                ? "—"
                : formatDate(r.data_ro)}
          </span>
          <span className="text-muted-foreground text-nota block">
            {etichetaEmitent(r.emitent)}
            {r.card_ultimele_cifre === null ? "" : ` ${mascheaza(r.card_ultimele_cifre)}`}
          </span>
        </>
      ),
    },
    {
      cheie: "produs",
      antet: "Produs",
      peTelefon: "meta",
      celula: (r) => (
        <>
          {r.produs}
          <span className="text-muted-foreground text-nota block">
            {ETICHETE_CATEGORIE[r.categorie]}
            {r.statie === null ? "" : ` · ${r.statie}`}
          </span>
        </>
      ),
    },
    {
      cheie: "cantitate",
      antet: "Cantitate",
      numeric: true,
      peTelefon: "meta",
      celula: (r) => (r.cantitate === null ? "—" : `${LITRI.format(r.cantitate)} L`),
    },
    {
      cheie: "valoare",
      antet: "Valoare",
      numeric: true,
      peTelefon: "meta",
      celula: (r) => `${LEI.format(r.valoare_bruta)} ${r.moneda === "RON" ? "lei" : r.moneda}`,
    },
    {
      cheie: "vehicul",
      antet: "Vehicul / foaie",
      peTelefon: "meta",
      celula: (r) => {
        const v = r.vehicle_id === null ? undefined : vehicule.get(r.vehicle_id);
        return (
          <>
            {v === undefined ? (
              (r.nr_inmatriculare_extras ?? "—")
            ) : (
              <Link href={`/flota/${v.id}`} className="underline-offset-2 hover:underline">
                {v.nr_inmatriculare}
              </Link>
            )}
            {r.trip_sheet_id === null ? null : (
              <Link
                href={`/flota/foi/${r.trip_sheet_id}`}
                className="text-nota block underline-offset-2 hover:underline"
              >
                Foaia zilei
              </Link>
            )}
          </>
        );
      },
    },
    {
      cheie: "stare",
      antet: "Stare",
      peTelefon: "insigna",
      celula: (r) => (
        <>
          <Badge ton={TON_STARE_POTRIVIRE[r.stare_potrivire]}>
            {ETICHETE_STARE_POTRIVIRE[r.stare_potrivire]}
          </Badge>
          {r.motiv === null && r.nota === null ? null : (
            <span className="text-muted-foreground text-nota block max-w-prose">
              {[r.motiv, r.nota === null ? null : `Notă: ${r.nota}`].filter(Boolean).join(" ")}
            </span>
          )}
        </>
      ),
    },
    {
      cheie: "actiuni",
      antet: "Acțiuni",
      peTelefon: "actiuni",
      celula: (r) => {
        // F12b: ignorarea nu mai e un drum fără întoarcere.
        if (r.stare_potrivire === "ignorata") {
          return <ButonReactiveaza tranzactieId={r.id} descriere={descriere(r)} />;
        }
        if (!STARI_DE_DECIS.has(r.stare_potrivire)) return null;
        const optiuni =
          r.vehicle_id === null || r.data_ro === null
            ? []
            : (candidati.get(`${r.vehicle_id}|${r.data_ro}`) ?? []);
        return (
          <div className="flex gap-2">
            {r.categorie === "combustibil" && optiuni.length > 0 ? (
              <DialogLeaga tranzactieId={r.id} descriere={descriere(r)} candidati={optiuni} />
            ) : null}
            <DialogIgnora tranzactieId={r.id} descriere={descriere(r)} />
          </div>
        );
      },
    },
  ];

  const coloaneImport: readonly Coloana<RandImport>[] = [
    {
      cheie: "fisier",
      antet: "Fișier",
      peTelefon: "titlu",
      celula: (i) => (
        <>
          <span className="font-medium">{i.fisier_nume}</span>
          <span className="text-muted-foreground text-nota block">
            {etichetaEmitent(i.emitent)} · importat {formatDateTime(i.created_at)}
          </span>
        </>
      ),
    },
    {
      cheie: "perioada",
      antet: "Perioada",
      peTelefon: "meta",
      celula: (i) => `${formatDate(i.perioada_de_la)} – ${formatDate(i.perioada_pana_la)}`,
    },
    {
      cheie: "rezultat",
      antet: "Rezultat",
      peTelefon: "meta",
      celula: (i) =>
        i.finalizat_la === null
          ? "Neterminat: reluați importul"
          : `${String(i.importate)} importate, ${String(i.duplicate)} deja existente, ${String(i.respinse)} respinse`,
    },
    {
      cheie: "actiuni",
      antet: "Acțiuni",
      peTelefon: "actiuni",
      celula: (i) => <ButonAnuleazaImport importId={i.id} fisier={i.fisier_nume} />,
    },
  ];

  const stariCuRanduri = ORDINE_STARI.filter((s) => (sumar.get(s)?.numar ?? 0) > 0);
  const totalLuna = [...sumar.values()].reduce((s, x) => s + x.numar, 0);
  const etichetaLunii = etichetaLuna(filtre.luna);

  return (
    <div className="space-y-6">
      <AntetPagina
        titlu="Tranzacții de card"
        descriere="Ce au facturat cardurile de combustibil, comparat cu foile de parcurs: alimentări nedeclarate, bonuri fără tranzacție, alimentări în zile fără foaie."
        file={<FileModul eticheta="Navigare parc auto" file={FILE_FLOTA} tenant={tenant} />}
        actiuni={
          <div className="flex flex-wrap gap-2">
            <Link href="/flota/carduri/import" className={buton({ varianta: "primar" })}>
              <FileUp aria-hidden="true" className="size-4" />
              Import extras
            </Link>
            <ButonRepotriveste luna={filtre.luna} eticheta={etichetaLunii} />
            <a
              href={`/api/export/flota/carduri?luna=${filtre.luna}`}
              className={buton({ varianta: "secundar" })}
            >
              <Download aria-hidden="true" className="size-4" />
              Raportul de nepotriviri (CSV)
            </a>
          </div>
        }
      />

      <nav aria-label="Alege luna" className="flex flex-wrap items-center gap-2">
        <Link
          href={adresa((p) => {
            p.set("luna", lunaMutata(filtre.luna, -1));
            p.delete("cursor");
          })}
          className={buton({ varianta: "secundar" })}
        >
          Luna anterioară
        </Link>
        <span className="text-corp font-medium">{etichetaLunii}</span>
        <Link
          href={adresa((p) => {
            p.set("luna", lunaMutata(filtre.luna, 1));
            p.delete("cursor");
          })}
          className={buton({ varianta: "secundar" })}
        >
          Luna următoare
        </Link>
      </nav>

      <section aria-labelledby="sumar-luna" className="space-y-3">
        <h2 id="sumar-luna" className="text-sectiune font-semibold">
          Raportul lunii: {String(totalLuna)} tranzacții
        </h2>
        <nav aria-label="Filtrează după stare" className="flex flex-wrap gap-2">
          <Link
            href={adresa((p) => {
              p.delete("stare");
              p.delete("cursor");
            })}
            aria-current={filtre.stare === null ? "page" : undefined}
            className={buton({
              varianta: filtre.stare === null ? "primar" : "secundar",
            })}
          >
            Toate ({String(totalLuna)})
          </Link>
          {stariCuRanduri.map((s) => {
            const x = sumar.get(s);
            return (
              <Link
                key={s}
                href={adresa((p) => {
                  p.set("stare", s);
                  p.delete("cursor");
                })}
                aria-current={filtre.stare === s ? "page" : undefined}
                className={buton({
                  varianta: filtre.stare === s ? "primar" : "secundar",
                })}
              >
                {ETICHETE_STARE_POTRIVIRE[s]} ({String(x?.numar ?? 0)}
                {x === undefined || x.valoareRon === 0 ? "" : ` · ${LEI.format(x.valoareRon)} lei`})
              </Link>
            );
          })}
        </nav>
      </section>

      {randuri.length === 0 ? (
        <StareGoala
          fel={filtre.stare === null ? "initiala" : "filtrata"}
          pictograma={Receipt}
          titlu={
            filtre.stare === null
              ? `Nicio tranzacție în ${etichetaLunii}`
              : "Nicio tranzacție în starea aleasă"
          }
          descriere={
            filtre.stare === null
              ? "Importați extrasul lunii de la emitentul cardului: tranzacțiile se compară singure cu foile de parcurs."
              : "Alegeți altă stare sau toate tranzacțiile lunii."
          }
          actiune={
            filtre.stare === null
              ? { eticheta: "Importă un extras", href: "/flota/carduri/import" }
              : {
                  eticheta: "Toate tranzacțiile",
                  href: adresa((p) => p.delete("stare")),
                }
          }
        />
      ) : (
        <>
          <Tabel
            caption={`Tranzacțiile de card din ${etichetaLunii}, cu starea potrivirii pe foile de parcurs.`}
            coloane={coloane}
            randuri={randuri}
            cheieRand={(r) => r.id}
            densitate="compact"
            gol={null}
          />
          <Paginare
            afisate={randuri.length}
            total={lista.total}
            cursorUrmator={lista.urmatorulCursor}
            limita={filtre.limita}
            construiesteHref={({ cursor: c, limita: l }) =>
              adresa((p) => {
                p.set("limita", String(l));
                if (c === null) p.delete("cursor");
                else p.set("cursor", c);
              })
            }
          />
        </>
      )}

      <section aria-labelledby="importuri" className="space-y-3">
        <h2 id="importuri" className="text-sectiune font-semibold">
          Ultimele importuri
        </h2>
        {importuri.length === 0 ? (
          <p className="text-muted-foreground text-corp">Niciun extras importat încă.</p>
        ) : (
          <Tabel
            caption="Ultimele extrase importate, cu rezultatul fiecăruia. Un import greșit se anulează, apoi se reimportă fișierul corectat."
            coloane={coloaneImport}
            randuri={importuri}
            cheieRand={(i) => i.id}
            densitate="compact"
            gol={null}
          />
        )}
      </section>

      <p className="text-muted-foreground text-nota max-w-prose">
        Extrasul de card nu e document de deducere: documentul fiscal rămâne factura emitentului.
        Valorile în altă monedă se arată ca în extras, fără conversie.
      </p>
    </div>
  );
}
