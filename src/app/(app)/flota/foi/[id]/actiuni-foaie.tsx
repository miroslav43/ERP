"use client";

import { useCallback, useState, useTransition } from "react";
import { useRouter } from "next/navigation";

import { Buton } from "@/components/ui/buton";
import { Callout } from "@/components/ui/callout";
import { Camp } from "@/components/ui/camp";
import { Formular } from "@/components/ui/formular";
import type { ActionResult } from "@/lib/actions/types";
import { oraRomanieiPentruCamp } from "@/lib/format/date";
import type { StatusFoaie } from "@/schemas/fleet";

import { adaugaAlimentare, redeschideFoaie, trimiteFoaie } from "../../actions";

type FoaieInchisa = Readonly<{ id: string; anomalie: string | null }>;
type AlimentareAdaugata = Readonly<{ id: string }>;

/**
 * Refuz construit în client, în forma exactă a unui `ActionResult`, ca mesajul
 * să meargă pe aceeași cale ca al serverului și să ajungă lângă câmp, nu sub
 * buton. Aceeași formă ca în `flota/foi/dialog-foaie-noua.tsx`.
 */
function refuzDeClient(
  fieldErrors: Readonly<Record<string, readonly string[]>>,
): ActionResult<never> {
  return {
    ok: false,
    error: {
      code: "VALIDARE",
      message: "Datele introduse nu sunt valide.",
      fieldErrors,
      requestId: "client",
    },
  };
}

/** Casetele fiecărui formular — ce NU e aici n-are unde să-și arate eroarea. */
const CAMPURI_INCHIDERE: ReadonlySet<string> = new Set(["sosire_la", "km_sosire", "observatii"]);
const CAMPURI_ALIMENTARE: ReadonlySet<string> = new Set([
  "alimentat_la",
  "litri",
  "cost",
  "statie",
  "numar_bon",
  "observatii",
  "plin",
]);

/**
 * Erorile pe câmp care n-au casetă în formular, spuse ca mesaj general.
 *
 * `flota/erori.ts` pune refuzurile triggerelor pe câmpul lor după începutul
 * mesajului — „Kilometrajul de plecare …” pe `km_plecare`, „Vehiculul …” pe
 * `vehicle_id` —, dar formularele de aici n-au casetele acelea. Iar `<Formular>`
 * ascunde mesajul general de îndată ce `fieldErrors` are o cheie. Fără blocul
 * ăsta, refuzul nu apărea nicăieri: butonul revenea activ și ecranul tăcea.
 *
 * Local, nu în `<Formular>`: alte formulare (pragurile din salarizare, lista
 * de indicatori) își arată singure erorile pe chei fără casetă, iar o regulă
 * generală le-ar dubla mesajul.
 */
function ErorileFaraCamp({
  erori,
  campuri,
}: {
  readonly erori: Readonly<Record<string, readonly string[]>>;
  readonly campuri: ReadonlySet<string>;
}) {
  const mesaje = [
    ...new Set(
      Object.entries(erori)
        .filter(([cheie]) => !campuri.has(cheie))
        .flatMap(([, lista]) => lista),
    ),
  ];
  if (mesaje.length === 0) return null;
  return <Callout fel="eroare">{mesaje.join(" ")}</Callout>;
}

/**
 * Închiderea cursei, alimentările și redeschiderea foii respinse.
 *
 * O foaie aprobată nu se mai atinge: triggerul o refuză, cu mesaj în română.
 * Ascundem formularele ca omul să nu apese degeaba, dar regula rămâne în bază —
 * ascunderea nu e barieră.
 *
 * Ce arată fiecare stare urmează EXACT tranzițiile din
 * `internal.foi_parcurs_inainte`, nu o aproximare a lor:
 *   - `draft`: închiderea și alimentările;
 *   - `trimis`: doar alimentările (`alimentari_inainte` le acceptă până la decizie);
 *   - `respins`: doar „Redeschide”. Din `respins` baza nu permite trimiterea
 *     directă, iar alimentările le refuză. Înainte, ecranul arăta aici ambele
 *     formulare și amândouă cădeau cu P0001.
 *
 * ── DE CE `<Formular>`, NU `<form action>` BRUT ───────────────────────────
 * React 19 resetează un formular cu câmpuri necontrolate după ORICE acțiune de
 * formular — și după un refuz, și când pre-validarea de client iese sincron,
 * fără drum la server. Cu formulare brute, „Stație” și „Număr bon” completate
 * corect dispăreau odată cu erorile de pe „Când/Litri/Cost” (ADM-022), iar
 * omul relua totul de la zero la fiecare greșeală. `<Formular>` întoarce
 * `valoriTrimise`, pe care câmpurile le reiau ca `defaultValue`.
 *
 * Fiecare formular e un `<Formular>` propriu, cu starea și erorile lui: un
 * refuz la alimentare nu înroșește sosirea, iar butonul „Adaugă alimentarea”
 * nu se blochează cât timp se trimite foaia. Refuzurile triggerelor
 * (kilometraj mai mic, alimentare în afara cursei) sosesc prin `fieldErrors` —
 * vezi `flota/erori.ts` — și înroșesc caseta vinovată. Orele se arată și se
 * trimit în ora României (`oraRomanieiPentruCamp` / `dataOraRomania`).
 */
export function ActiuniFoaie({
  id,
  status,
  kmPlecare,
  plecareLa,
  sosireLa,
}: {
  readonly id: string;
  readonly status: StatusFoaie;
  readonly kmPlecare: number;
  readonly plecareLa: string;
  readonly sosireLa: string | null;
}) {
  const router = useRouter();
  const [avertisment, setAvertisment] = useState<string | null>(null);
  // Redeschiderea e un buton, nu un formular: rămâne pe `useTransition`.
  const [seRedeschide, pornesteRedeschiderea] = useTransition();
  const [eroareRedeschidere, setEroareRedeschidere] = useState<string | null>(null);

  const sePoateInchide = status === "draft";
  const sePoateAlimenta = status === "draft" || status === "trimis";
  const plecareCamp = oraRomanieiPentruCamp(plecareLa);
  const sosireCamp = sosireLa === null ? null : oraRomanieiPentruCamp(sosireLa);

  /*
   * Regulile pe care baza le refuză oricum se spun în client, pe câmp, înainte
   * de round-trip. Refuzul are forma unui `ActionResult`, deci `<Formular>` îl
   * tratează identic cu unul venit de la server: erori lângă câmp, valori
   * păstrate.
   */
  async function inchide(formular: FormData): Promise<ActionResult<FoaieInchisa>> {
    const sosire = String(formular.get("sosire_la") ?? "");
    const km = String(formular.get("km_sosire") ?? "").trim();
    const lipsa: Record<string, string[]> = {};
    if (sosire.length === 0) lipsa.sosire_la = ["Completați data și ora sosirii."];
    else if (sosire <= plecareCamp) {
      lipsa.sosire_la = ["Sosirea trebuie să fie după plecare."];
    }
    if (km.length === 0) lipsa.km_sosire = ["Scrieți kilometrajul la sosire, în km."];
    else if (Number(km) <= kmPlecare) {
      lipsa.km_sosire = [
        `Kilometrajul la sosire trebuie să fie mai mare decât cel de la plecare (${kmPlecare.toLocaleString("ro-RO")} km).`,
      ];
    }
    if (Object.keys(lipsa).length > 0) return refuzDeClient(lipsa);

    return await trimiteFoaie({
      id,
      sosire_la: sosire,
      km_sosire: Number(km),
      observatii: String(formular.get("observatii") ?? "").trim() || null,
    });
  }

  async function alimenteaza(formular: FormData): Promise<ActionResult<AlimentareAdaugata>> {
    const cand = String(formular.get("alimentat_la") ?? "");
    const litri = String(formular.get("litri") ?? "").trim();
    const cost = String(formular.get("cost") ?? "").trim();
    const lipsa: Record<string, string[]> = {};
    if (cand.length === 0) lipsa.alimentat_la = ["Completați data și ora alimentării."];
    else if (cand < plecareCamp || (sosireCamp !== null && cand > sosireCamp)) {
      lipsa.alimentat_la = [
        sosireCamp === null
          ? "Alimentarea nu poate fi înainte de plecarea cursei."
          : "Alimentarea trebuie să fie între plecarea și sosirea cursei.",
      ];
    }
    if (litri.length === 0 || Number(litri) <= 0) {
      lipsa.litri = ["Scrieți câți litri s-au alimentat (mai mult de zero)."];
    }
    if (cost.length === 0) lipsa.cost = ["Scrieți costul alimentării, în lei."];
    if (Object.keys(lipsa).length > 0) return refuzDeClient(lipsa);

    const rezultat = await adaugaAlimentare({
      trip_sheet_id: id,
      litri: Number(litri),
      cost: Number(cost),
      statie: String(formular.get("statie") ?? "").trim() || null,
      numar_bon: String(formular.get("numar_bon") ?? "").trim() || null,
      alimentat_la: cand,
      plin: formular.get("plin") === "on",
      observatii: String(formular.get("observatii") ?? "").trim() || null,
    });
    /*
     * Reîmprospătarea pleacă DE AICI, nu din `laReusita`. `<Formular>` aprinde
     * pentru `laReusita` voalul global de navigare, care se stinge doar la
     * schimbarea căii sau la demontarea formularului. După o alimentare nu se
     * întâmplă niciuna: `router.refresh()` rămâne pe aceeași cale, iar foaia e
     * tot `draft`/`trimis`, deci formularul rămâne pe ecran. Voalul ar fi stat
     * aprins, înghițind clicurile, până la plafonul de 30 s.
     */
    if (rezultat.ok) router.refresh();
    return rezultat;
  }

  // Stabil între randări: `laReusita` intră în dependențele efectului din
  // `<Formular>`, iar o funcție nouă la fiecare randare ar relua efectul —
  // `router.refresh()` și semnalul de navigare de două ori. Aici semnalul e
  // corect: după închidere foaia trece în `trimis`, formularul se demontează,
  // iar demontarea stinge voalul.
  const laInchidere = useCallback(
    (data: FoaieInchisa) => {
      // Saltul de kilometraj nu e o eroare — foaia s-a salvat. E o observație
      // pe care cineva trebuie să o explice, din ecranul de anomalii.
      setAvertisment(data.anomalie);
      router.refresh();
    },
    [router],
  );

  function redeschide(): void {
    setEroareRedeschidere(null);
    pornesteRedeschiderea(async () => {
      const rezultat = await redeschideFoaie({ id });
      if (!rezultat.ok) {
        setEroareRedeschidere(rezultat.error.message);
        return;
      }
      router.refresh();
    });
  }

  return (
    <section aria-label="Acțiuni" className="space-y-4">
      {avertisment === null ? null : (
        <p
          role="status"
          className="border-warning/40 bg-warning/12 text-foreground rounded-panou text-corp border p-3"
        >
          {avertisment}
        </p>
      )}

      {status === "respins" ? (
        <div className="border-border rounded-panou flex flex-wrap items-center gap-3 border p-4">
          <p className="text-corp grow">
            Foaia a fost respinsă. Redeschideți-o ca ciornă, corectați-o și trimiteți-o din nou.
          </p>
          <Buton
            type="button"
            varianta="primar"
            inCurs={seRedeschide}
            textInCurs="Se redeschide…"
            onClick={redeschide}
          >
            Redeschide foaia
          </Buton>
          {eroareRedeschidere === null ? null : (
            <p role="alert" className="text-danger text-corp w-full">
              {eroareRedeschidere}
            </p>
          )}
        </div>
      ) : null}

      {sePoateInchide ? (
        <Formular
          actiune={inchide}
          laReusita={laInchidere}
          className="border-border rounded-panou border p-4"
        >
          {(stare) => {
            // După o salvare reușită formularul repornește gol: `valoriTrimise`
            // se păstrează DOAR cât timp ultimul răspuns a fost un refuz.
            const trimise: Readonly<Record<string, string>> =
              stare.data === null ? stare.valoriTrimise : {};
            return (
              <>
                <p className="text-corp font-medium">Închide cursa și trimite spre aprobare</p>
                <ErorileFaraCamp erori={stare.erori} campuri={CAMPURI_INCHIDERE} />
                <div className="grid gap-3 sm:grid-cols-3">
                  <Camp
                    nume="sosire_la"
                    id="foaie-sosire"
                    eticheta="Sosire"
                    obligatoriu
                    erori={stare.erori["sosire_la"] ?? []}
                  >
                    {(a) => (
                      <input
                        {...a}
                        type="datetime-local"
                        min={plecareCamp}
                        defaultValue={trimise["sosire_la"] ?? sosireCamp ?? ""}
                      />
                    )}
                  </Camp>
                  <Camp
                    nume="km_sosire"
                    id="foaie-km-sosire"
                    eticheta="Kilometraj la sosire"
                    obligatoriu
                    ajutor={`La plecare: ${kmPlecare.toLocaleString("ro-RO")} km.`}
                    erori={stare.erori["km_sosire"] ?? []}
                  >
                    {(a) => (
                      <input
                        {...a}
                        type="number"
                        min={kmPlecare}
                        defaultValue={trimise["km_sosire"] ?? ""}
                      />
                    )}
                  </Camp>
                  <Camp
                    nume="observatii"
                    id="foaie-observatii"
                    eticheta="Observații"
                    fel="textarea"
                    ajutor="Ce s-a întâmplat pe drum: ocoluri, opriri, defecte. Gol = rămân cele de la plecare."
                    className="sm:col-span-3"
                    erori={stare.erori["observatii"] ?? []}
                  >
                    {(a) => (
                      <textarea
                        {...a}
                        maxLength={1000}
                        rows={2}
                        defaultValue={trimise["observatii"] ?? ""}
                      />
                    )}
                  </Camp>
                </div>
                <div className="flex flex-wrap items-end gap-3">
                  <Buton
                    type="submit"
                    varianta="primar"
                    inCurs={stare.inCurs}
                    textInCurs="Se trimite…"
                  >
                    Trimite spre aprobare
                  </Buton>
                </div>
              </>
            );
          }}
        </Formular>
      ) : null}

      {!sePoateAlimenta ? null : (
        <Formular actiune={alimenteaza} className="border-border rounded-panou border p-4">
          {(stare) => {
            const trimise: Readonly<Record<string, string>> =
              stare.data === null ? stare.valoriTrimise : {};
            return (
              <>
                <p className="text-corp font-medium">Adaugă o alimentare</p>
                <ErorileFaraCamp erori={stare.erori} campuri={CAMPURI_ALIMENTARE} />
                <div className="grid gap-3 sm:grid-cols-4">
                  {/* Baza respinge o alimentare din afara intervalului cursei;
                      `min` și `max` o spun din calendar, iar verificarea din
                      `alimenteaza` o spune în cuvinte, pe câmp. `max` se pune
                      doar când cursa e închisă: pentru una deschisă, „acum”
                      calculat în client ar diferi de randarea de pe server și
                      ar produce nepotrivire la hidratare. */}
                  <Camp
                    nume="alimentat_la"
                    id="alimentare-cand"
                    eticheta="Când"
                    obligatoriu
                    erori={stare.erori["alimentat_la"] ?? []}
                  >
                    {(a) => (
                      <input
                        {...a}
                        type="datetime-local"
                        min={plecareCamp}
                        {...(sosireCamp === null ? {} : { max: sosireCamp })}
                        defaultValue={trimise["alimentat_la"] ?? ""}
                      />
                    )}
                  </Camp>
                  <Camp
                    nume="litri"
                    id="alimentare-litri"
                    eticheta="Litri"
                    obligatoriu
                    erori={stare.erori["litri"] ?? []}
                  >
                    {(a) => (
                      <input
                        {...a}
                        type="number"
                        min="0.01"
                        step="0.01"
                        defaultValue={trimise["litri"] ?? ""}
                      />
                    )}
                  </Camp>
                  <Camp
                    nume="cost"
                    id="alimentare-cost"
                    eticheta="Cost (lei)"
                    obligatoriu
                    erori={stare.erori["cost"] ?? []}
                  >
                    {(a) => (
                      <input
                        {...a}
                        type="number"
                        min="0"
                        step="0.01"
                        defaultValue={trimise["cost"] ?? ""}
                      />
                    )}
                  </Camp>
                  <Camp
                    nume="statie"
                    id="alimentare-statie"
                    eticheta="Stație"
                    erori={stare.erori["statie"] ?? []}
                  >
                    {(a) => <input {...a} maxLength={120} defaultValue={trimise["statie"] ?? ""} />}
                  </Camp>
                  <Camp
                    nume="numar_bon"
                    id="alimentare-bon"
                    eticheta="Număr bon"
                    ajutor="Același bon nu se poate trece de două ori pe foaie."
                    erori={stare.erori["numar_bon"] ?? []}
                  >
                    {(a) => (
                      <input {...a} maxLength={60} defaultValue={trimise["numar_bon"] ?? ""} />
                    )}
                  </Camp>
                  <Camp
                    nume="observatii"
                    id="alimentare-observatii"
                    eticheta="Observații"
                    className="sm:col-span-2"
                    erori={stare.erori["observatii"] ?? []}
                  >
                    {(a) => (
                      <input {...a} maxLength={500} defaultValue={trimise["observatii"] ?? ""} />
                    )}
                  </Camp>
                  <label className="text-corp flex items-center gap-2 self-end pb-2">
                    {/* Bifa nebifată LIPSEȘTE din `FormData`, deci absența cheii
                        înseamnă „nebifat” — la fel ca `pool` în `valori-vehicul.ts`. */}
                    <input
                      type="checkbox"
                      name="plin"
                      className="size-4"
                      defaultChecked={trimise["plin"] === "on"}
                    />
                    Plin făcut
                  </label>
                </div>
                <div className="flex flex-wrap items-center gap-3">
                  <Buton
                    type="submit"
                    varianta="secundar"
                    inCurs={stare.inCurs}
                    textInCurs="Se salvează…"
                  >
                    Adaugă alimentarea
                  </Buton>
                </div>
              </>
            );
          }}
        </Formular>
      )}
    </section>
  );
}
