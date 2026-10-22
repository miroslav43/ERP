// src/app/(app)/flota/foi/[id]/sectiune-curse.tsx
import type { ReactElement } from "react";

import { Callout } from "@/components/ui/callout";
import { Tabel, type Coloana } from "@/components/ui/tabel";
import { oraInBucharest } from "@/lib/format/date";
import {
  ordoneazaCurse,
  propunereCursaNoua,
  totaluriCurse,
  type SablonTraseu,
} from "@/domain/fleet/foaie";
import {
  PLAFON_CURSE_FOAIE,
  PLAFON_UIT_FOAIE,
  type Cursa,
  type UitCursa,
} from "@/lib/queries/fleet";
import {
  arataSectiuneaUit,
  avertismenteCursa,
  PRAG_MASA_E_TRANSPORT_KG,
  type AvertismentETransport,
} from "@/domain/fleet/uit";

import {
  AJUTOR_E_TRANSPORT,
  ETICHETE_E_TRANSPORT_SCURT,
  rezumatETransport,
  textAvertismentETransport,
} from "../../etichete";
import { ButonStergePeFoaie } from "./buton-sterge-pe-foaie";
import { DialogCursa } from "./dialog-cursa";
import { UitCursa as ListaUit } from "./uit-cursa";

/**
 * Foaia ca tabel de curse (0200): ora, de la → la, scopul, kilometrii.
 *
 * Aceeași secțiune pe `/flota/foi/[id]` și în portal (`/portal/masina-mea/foi/[id]`),
 * ca șoferul și aprobatorul să vadă exact același tabel. Componentă de server:
 * coloanele sunt FUNCȚII, care nu trec granița spre client (capul lui
 * `tabel.tsx`); butoanele de pe rând sunt componentele client.
 *
 * Kilometrii de bord ai zilei (ultima sosire − prima plecare) pot fi mai mulți
 * decât suma curselor: diferența e drum fără cursă scrisă. Baza n-o refuză
 * (kilometrajul trebuie să fie monoton, nu continuu), dar aprobatorul o vede.
 *
 * Coloana „e-Transport” (0217, F12f): încadrarea, codurile UIT cu starea lor în
 * ziua foii și avertismentele, care NU blochează nimic (decizia I-T2). Apare pe
 * cursele unde are sens (decizia I-f1, `arataSectiuneaUit`).
 */
type Proprietati = Readonly<{
  foaieId: string;
  curse: readonly Cursa[];
  /** Ciornă și apelantul o poate scrie. Altfel tabelul e doar de citit. */
  editabil: boolean;
  kmPlecareFoaie: number;
  sabloane: readonly SablonTraseu[];
  /** Ziua foii, `AAAA-LL-ZZ`. */
  ziuaFoii: string;
  uituri: readonly UitCursa[];
  /** Masa maximă din fișa vehiculului; `null` = necunoscută sau vehicul invizibil. */
  masaVehiculKg: number | null;
}>;

const km = (v: number | null): string => (v === null ? "—" : `${v.toLocaleString("ro-RO")} km`);

export function SectiuneCurse({
  foaieId,
  curse,
  editabil,
  kmPlecareFoaie,
  sabloane,
  ziuaFoii,
  uituri,
  masaVehiculKg,
}: Proprietati): ReactElement {
  const ordonate = ordoneazaCurse(curse);
  const totaluri = totaluriCurse(ordonate);
  const propunere = propunereCursaNoua(ordonate, kmPlecareFoaie);
  const ora = (moment: string): string => oraInBucharest(new Date(moment));

  // ── e-Transport (0217) ──
  const uituriPeCursa = new Map<string, UitCursa[]>();
  for (const u of uituri) {
    const lista = uituriPeCursa.get(u.cursa_id) ?? [];
    lista.push(u);
    uituriPeCursa.set(u.cursa_id, lista);
  }
  const uituriCursei = (c: Cursa): readonly UitCursa[] => uituriPeCursa.get(c.id) ?? [];
  const avertismente = new Map<string, readonly AvertismentETransport[]>(
    ordonate.map((c) => [c.id, avertismenteCursa(c, uituriCursei(c), ziuaFoii, masaVehiculKg)]),
  );
  const arataUit = (c: Cursa): boolean =>
    arataSectiuneaUit(masaVehiculKg, c, uituriCursei(c).length);
  // Pe o cursă nouă selectorul apare doar după vehicul: marcajul vine abia din casetă.
  const vehiculPestePrag = masaVehiculKg === null || masaVehiculKg >= PRAG_MASA_E_TRANSPORT_KG;
  const coloanaETransport = ordonate.some(arataUit);
  const rezumat = rezumatETransport([...avertismente.values()]);

  const coloane: Coloana<Cursa>[] = [
    {
      cheie: "nr",
      antet: "Nr.",
      latime: "ingusta",
      peTelefon: "meta",
      celula: (c) => String(ordonate.indexOf(c) + 1),
    },
    {
      cheie: "ruta",
      antet: "Cursa",
      peTelefon: "titlu",
      celula: (c) => (
        <>
          <span className="font-medium">
            {c.de_la_loc ?? "—"} → {c.pana_la_loc ?? "—"}
          </span>
          <span className="text-muted-foreground block text-xs">{c.scop ?? "Fără scop scris"}</span>
        </>
      ),
    },
    {
      cheie: "ora",
      antet: "Ora",
      peTelefon: "meta",
      celula: (c) =>
        c.sosire_la === null
          ? `${ora(c.plecare_la)} – pe drum`
          : `${ora(c.plecare_la)} – ${ora(c.sosire_la)}`,
    },
    {
      cheie: "bord",
      antet: "Kilometraj",
      numeric: true,
      peTelefon: "meta",
      celula: (c) =>
        `${c.km_plecare.toLocaleString("ro-RO")} – ${c.km_sosire === null ? "…" : c.km_sosire.toLocaleString("ro-RO")}`,
    },
    {
      cheie: "km",
      antet: "Parcurs",
      numeric: true,
      peTelefon: "meta",
      celula: (c) => km(c.km_parcursi),
    },
    ...(coloanaETransport
      ? ([
          {
            cheie: "etransport",
            antet: "e-Transport",
            peTelefon: "meta",
            celula: (c: Cursa) =>
              arataUit(c) ? (
                <div className="space-y-1">
                  {c.e_transport === "neaplicabil" ? null : (
                    <span className="block text-xs font-medium">
                      {ETICHETE_E_TRANSPORT_SCURT[c.e_transport]}
                    </span>
                  )}
                  <ListaUit
                    foaieId={foaieId}
                    cursaId={c.id}
                    ziuaFoii={ziuaFoii}
                    uituri={uituriCursei(c)}
                    editabil={editabil}
                  />
                  {(avertismente.get(c.id) ?? []).map((a) => (
                    <span
                      key={`${a.tip}-${"uit" in a ? a.uit : ""}`}
                      className="text-warning block text-xs"
                    >
                      {textAvertismentETransport(a)}
                    </span>
                  ))}
                </div>
              ) : (
                "—"
              ),
          },
        ] satisfies Coloana<Cursa>[])
      : []),
    ...(editabil
      ? ([
          {
            cheie: "actiuni",
            antet: "Acțiuni",
            peTelefon: "actiuni",
            celula: (c: Cursa) => (
              <span className="flex justify-end gap-1">
                <DialogCursa
                  foaieId={foaieId}
                  cursa={c}
                  propunere={propunere}
                  sabloane={[]}
                  arataETransport={arataUit(c)}
                />
                <ButonStergePeFoaie
                  fel="cursa"
                  id={c.id}
                  foaieId={foaieId}
                  descriere={`${c.de_la_loc ?? "—"} → ${c.pana_la_loc ?? "—"}, ${ora(c.plecare_la)}`}
                />
              </span>
            ),
          },
        ] satisfies Coloana<Cursa>[])
      : []),
  ];

  return (
    <section aria-labelledby="curse" className="space-y-3">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <h2 id="curse" className="text-sectiune font-semibold">
          Cursele zilei
        </h2>
        {editabil ? (
          <DialogCursa
            foaieId={foaieId}
            cursa={null}
            propunere={propunere}
            sabloane={sabloane}
            arataETransport={vehiculPestePrag}
          />
        ) : null}
      </div>
      {editabil && propunere.blocata ? (
        <p className="text-muted-foreground text-corp">
          Ultima cursă e încă pe drum. Completați-i sosirea înainte de a adăuga una nouă.
        </p>
      ) : null}
      {rezumat.length === 0 ? null : (
        // Nemodal: foaia se salvează și se trimite oricum (decizia I-T2). Obligația
        // de declarare e a furnizorului sau a beneficiarului, nu a șoferului.
        <Callout fel="atentie" titlu="e-Transport">
          {rezumat.join(" ")} {AJUTOR_E_TRANSPORT}
        </Callout>
      )}
      <Tabel
        caption="Cursele foii de parcurs, în ordinea zilei."
        coloane={coloane}
        randuri={ordonate}
        cheieRand={(c) => c.id}
        gol={
          <p className="text-muted-foreground text-corp">
            {editabil
              ? "Nicio cursă încă. Adăugați fiecare deplasare a zilei: de unde, până unde, scopul și kilometrii."
              : "Nicio cursă înregistrată pe această foaie."}
          </p>
        }
        subsol={
          ordonate.length === 0 ? undefined : (
            <tr>
              <td className="px-4 py-3" colSpan={4}>
                Total pe curse
              </td>
              <td className="px-4 py-3 text-right tabular-nums">{km(totaluri.kmCurse)}</td>
              {coloanaETransport ? <td className="px-4 py-3" /> : null}
              {editabil ? <td className="px-4 py-3" /> : null}
            </tr>
          )
        }
      />
      {totaluri.kmFaraCursa > 0 ? (
        <Callout
          fel="atentie"
          titlu={`${totaluri.kmFaraCursa.toLocaleString("ro-RO")} km fără cursă scrisă`}
        >
          Kilometrajul de bord al zilei a urcat cu {km(totaluri.kmBord)}, iar cursele însumează{" "}
          {km(totaluri.kmCurse)}. Diferența e drum pe care nicio cursă nu-l explică.
        </Callout>
      ) : null}
      {curse.length >= PLAFON_CURSE_FOAIE ? (
        <Callout fel="atentie" titlu="Lista e trunchiată">
          Foaia are cel puțin {PLAFON_CURSE_FOAIE} de curse și doar atâtea se arată.
        </Callout>
      ) : null}
      {uituri.length >= PLAFON_UIT_FOAIE ? (
        <Callout fel="atentie" titlu="Codurile UIT sunt trunchiate">
          Foaia are cel puțin {PLAFON_UIT_FOAIE} de coduri UIT și doar atâtea se arată.
        </Callout>
      ) : null}
    </section>
  );
}
