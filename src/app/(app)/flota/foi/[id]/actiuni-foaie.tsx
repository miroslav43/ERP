"use client";

import { useCallback, useRef, useState, useTransition } from "react";
import { useRouter } from "next/navigation";

import { ButonCitesteBonul, type PropunereCitita } from "@/components/flota/buton-citeste-bonul";
import { Buton } from "@/components/ui/buton";
import { Callout } from "@/components/ui/callout";
import { Camp } from "@/components/ui/camp";
import { ConfirmareActiune } from "@/components/ui/dialog";
import { Formular } from "@/components/ui/formular";
import { arataToast } from "@/components/ui/toast";
import type { ActionResult } from "@/lib/actions/types";
import { oraRomanieiPentruCamp } from "@/lib/format/date";
import type { StatusFoaie } from "@/schemas/fleet";

import {
  adaugaAlimentare,
  redeschideFoaie,
  retrageFoaie,
  stergeFoaie,
  trimiteFoaie,
} from "../../actions";
import { PozaBonAlimentare, type BonUrcat } from "./poza-bon-alimentare";

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
const CAMPURI_INCHIDERE: ReadonlySet<string> = new Set(["observatii"]);
const CAMPURI_ALIMENTARE: ReadonlySet<string> = new Set([
  "alimentat_la",
  "litri",
  "cost",
  "statie",
  "numar_bon",
  "cui_statie",
  "observatii",
  "plin",
]);

/** Câmpurile pe care le poate completa citirea bonului (F12a), în ordinea formularului. */
const CAMPURI_DIN_BON = [
  "alimentat_la",
  "litri",
  "cost",
  "statie",
  "numar_bon",
  "cui_statie",
] as const;
type CampDinBon = (typeof CAMPURI_DIN_BON)[number];

/** Valoarea pentru `<input>`: `type="number"` cere punct zecimal, nu virgulă. */
function valoareCamp(propunere: PropunereCitita["propunere"], camp: CampDinBon): string | null {
  const valoare = propunere[camp];
  if (valoare === null) return null;
  return typeof valoare === "number" ? String(valoare) : valoare;
}

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
 * Trimiterea, retragerea, redeschiderea și ștergerea foii zilnice, plus
 * alimentările.
 *
 * Ce arată fiecare stare urmează EXACT regulile din
 * `internal.foi_parcurs_inainte` după 0200 (§D1), nu o aproximare a lor:
 *   - `draft`: trimiterea, alimentarea, ștergerea ciornei. Ciorna care are
 *     deja număr (a fost trimisă și retrasă) e un document emis: n-o mai
 *     șterge decât cine scrie orice foaie, ca ANULARE vizibilă în registru
 *     (0200 §E4); celorlalți li se spune cui să ceară;
 *   - `trimis`: doar „Retrage în ciornă”. Baza nu mai lasă nimic altceva pe o
 *     foaie în aprobare — nici alimentări, nici curse —, ca aprobatorul să
 *     semneze cifrele pe care le vede;
 *   - `respins`: doar „Redeschide”. Din `respins` baza nu permite trimiterea
 *     directă și nicio corectură înainte de revenirea în ciornă.
 * Ascunderea nu e barieră: regula rămâne în bază.
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
 * refuz la alimentare nu înroșește trimiterea, iar butonul „Adaugă alimentarea”
 * nu se blochează cât timp se trimite foaia. Orele se arată și se trimit în ora
 * României (`oraRomanieiPentruCamp` / `dataOraRomania`).
 *
 * Trimiterea nu mai cere sosirea: o dau cursele (0200). Un refuz al bazei la
 * trimitere (cursă neîncheiată, regres de kilometraj) se arată ca TEXT, nu „pe
 * câmp”: câmpurile vinovate sunt în casetele curselor, nu în formularul ăsta.
 * `flota/erori.ts` le pune totuși pe câmpul lor (`km_plecare`, `vehicle_id`), iar
 * `<Formular>` ascunde mesajul general când există o cheie — de aici
 * `ErorileFaraCamp`, care le spune întregi sub titlu.
 */
export function ActiuniFoaie({
  id,
  status,
  numar,
  poateAnula,
  plecareLa,
  sosireLa,
  areCurse,
  bazaFoi,
  poateCitiBonul,
}: {
  readonly id: string;
  readonly status: StatusFoaie;
  /** Numărul `FP-AAAA-NNNNN`, dat la prima trimitere; `null` cât n-a plecat niciodată. */
  readonly numar: string | null;
  /** `trip_sheets:update = all`: singurul care anulează o foaie numerotată (0200 §E4). */
  readonly poateAnula: boolean;
  readonly plecareLa: string;
  readonly sosireLa: string | null;
  /** Foaia are cel puțin o cursă. Fără ele baza refuză trimiterea. */
  readonly areCurse: boolean;
  /** Unde duce lista după ștergerea ciornei: `/flota/foi` sau `/portal/masina-mea`. */
  readonly bazaFoi: string;
  /**
   * Citirea automată a bonului (F12a): cheia OpenRouter, modulul `asistent` și
   * `trip_sheets:update`, calculate pe server. `serverEnv` nu ajunge în client.
   */
  readonly poateCitiBonul: boolean;
}) {
  const router = useRouter();
  const [avertisment, setAvertisment] = useState<string | null>(null);
  // Redeschiderea e un buton, nu un formular: rămâne pe `useTransition`.
  const [seRedeschide, pornesteRedeschiderea] = useTransition();
  const [eroareRedeschidere, setEroareRedeschidere] = useState<string | null>(null);
  const [seSterge, pornesteStergerea] = useTransition();
  const [confirmaStergerea, setConfirmaStergerea] = useState(false);
  // Poza bonului urcată înainte de salvare și, după citire, jetonul și
  // câmpurile completate din bon (F12a). La schimbarea pozei, jetonul se
  // golește: el e legat de calea citită.
  const [bon, setBon] = useState<BonUrcat | null>(null);
  const [jeton, setJeton] = useState<string | null>(null);
  const [dinBon, setDinBon] = useState<ReadonlySet<CampDinBon>>(new Set());
  const [rundaBon, setRundaBon] = useState(0);
  const ancoraAlimentare = useRef<HTMLDivElement | null>(null);

  const sePoateTrimite = status === "draft";
  // 0200 §D1: alimentările urmează starea foii, deci doar pe ciornă.
  const sePoateAlimenta = status === "draft";
  // 0200 §E4: ciorna numerotată nu se șterge, se anulează — și doar sub `all`.
  const eNumerotata = numar !== null;
  const sePoateSterge = !eNumerotata || poateAnula;
  const plecareCamp = oraRomanieiPentruCamp(plecareLa);
  const sosireCamp = sosireLa === null ? null : oraRomanieiPentruCamp(sosireLa);

  /*
   * Trimiterea nu are reguli de client în afară de „există curse”: ora și
   * kilometrajul zilei vin din curse, iar restul îl judecă baza. Refuzul are
   * forma unui `ActionResult`, deci `<Formular>` îl tratează identic cu unul
   * venit de la server: eroare lângă câmp, valori păstrate.
   */
  async function inchide(formular: FormData): Promise<ActionResult<FoaieInchisa>> {
    setAvertisment(null);
    if (!areCurse) {
      return refuzDeClient({
        curse: [
          "Adăugați cursele zilei (de unde, până unde, scopul și kilometrii) înainte de a trimite foaia.",
        ],
      });
    }
    // Mesajul bazei rămâne întreg: „Încheiați toate cursele…”, „Kilometrajul de
    // plecare (9000 km) este mai mic…”. Câmpul lui nu e în formularul ăsta.
    return await trimiteFoaie({
      id,
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
      cui_statie: String(formular.get("cui_statie") ?? "").trim() || null,
      alimentat_la: cand,
      plin: formular.get("plin") === "on",
      observatii: String(formular.get("observatii") ?? "").trim() || null,
      fisier_bon_path: bon?.cale ?? null,
      ocr_jeton: jeton,
    });
    /*
     * Reîmprospătarea pleacă DE AICI, nu din `laReusita`. `<Formular>` aprinde
     * pentru `laReusita` voalul global de navigare, care se stinge doar la
     * schimbarea căii sau la demontarea formularului. După o alimentare nu se
     * întâmplă niciuna: `router.refresh()` rămâne pe aceeași cale, iar foaia e
     * tot `draft`/`trimis`, deci formularul rămâne pe ecran. Voalul ar fi stat
     * aprins, înghițind clicurile, până la plafonul de 30 s.
     */
    if (rezultat.ok) {
      // Formularul se golește singur; poza, jetonul și etichetele „din bon” țin
      // de alimentarea salvată, nu de următoarea.
      setBon(null);
      setJeton(null);
      setDinBon(new Set());
      setRundaBon((r) => r + 1);
      router.refresh();
    }
    return rezultat;
  }

  function schimbaPoza(nou: BonUrcat | null): void {
    setBon(nou);
    setJeton(null);
    setDinBon(new Set());
  }

  /*
   * Propunerea citită completează DOAR câmpurile goale (F12a D10): ce a scris
   * omul nu se suprascrie. Câmpurile sunt necontrolate (`Camp` +
   * `defaultValue`), deci scrierea directă în DOM e corectă; un remount cu
   * `key` ar pierde ce s-a tastat.
   */
  function aplicaPropunerea(citit: PropunereCitita): void {
    setJeton(citit.jeton);
    const formular = ancoraAlimentare.current?.closest("form") ?? null;
    if (formular === null) return;
    const completate = new Set<CampDinBon>();
    for (const camp of CAMPURI_DIN_BON) {
      const valoare = valoareCamp(citit.propunere, camp);
      const element = formular.elements.namedItem(camp);
      if (valoare === null || !(element instanceof HTMLInputElement)) continue;
      if (element.value !== "") continue;
      element.value = valoare;
      completate.add(camp);
    }
    // Se ADAUGĂ la ce a completat o citire anterioară a ACELEIAȘI poze: la a
    // doua apăsare câmpurile sunt deja pline, deci `completate` iese gol, dar
    // valorile tot de pe bon vin. La schimbarea pozei, `schimbaPoza` golește.
    setDinBon((anterioare) => new Set([...anterioare, ...completate]));
  }

  const eticheta = (text: string, camp: CampDinBon): string =>
    dinBon.has(camp) ? `${text} (din bon)` : text;

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
      // Aceeași casetă pentru cele două drumuri înapoi în ciornă: din
      // `respins` (redeschiderea) și din `trimis` (retragerea).
      const rezultat =
        status === "trimis" ? await retrageFoaie({ id }) : await redeschideFoaie({ id });
      if (!rezultat.ok) {
        setEroareRedeschidere(rezultat.error.message);
        return;
      }
      router.refresh();
    });
  }

  function sterge(): void {
    pornesteStergerea(async () => {
      const rezultat = await stergeFoaie({ id });
      if (!rezultat.ok) {
        arataToast({ fel: "eroare", text: rezultat.error.message });
        return;
      }
      setConfirmaStergerea(false);
      arataToast({
        fel: "reusita",
        text: eNumerotata ? `Foaia ${numar} a fost anulată.` : "Ciorna a fost ștearsă.",
      });
      router.push(bazaFoi);
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

      {status === "respins" || status === "trimis" ? (
        <div className="border-border rounded-panou flex flex-wrap items-center gap-3 border p-4">
          <p className="text-corp grow">
            {status === "respins"
              ? "Foaia a fost respinsă. Redeschideți-o ca ciornă, corectați-o și trimiteți-o din nou."
              : "Foaia așteaptă aprobarea și nu se mai modifică. Dacă ați greșit ceva, retrageți-o în ciornă, corectați-o și trimiteți-o din nou; numărul ei rămâne același."}
          </p>
          <Buton
            type="button"
            varianta={status === "respins" ? "primar" : "secundar"}
            inCurs={seRedeschide}
            textInCurs={status === "respins" ? "Se redeschide…" : "Se retrage…"}
            onClick={redeschide}
          >
            {status === "respins" ? "Redeschide foaia" : "Retrage în ciornă"}
          </Buton>
          {eroareRedeschidere === null ? null : (
            <p role="alert" className="text-danger text-corp w-full">
              {eroareRedeschidere}
            </p>
          )}
        </div>
      ) : null}

      {sePoateTrimite ? (
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
                <p className="text-corp font-medium">Trimite foaia zilei spre aprobare</p>
                <p className="text-muted-foreground text-corp">
                  Ora și kilometrajul zilei vin din curse. După trimitere foaia primește număr și nu
                  se mai modifică decât retrasă în ciornă.
                </p>
                <ErorileFaraCamp erori={stare.erori} campuri={CAMPURI_INCHIDERE} />
                <Camp
                  nume="observatii"
                  id="foaie-observatii"
                  eticheta="Observații"
                  fel="textarea"
                  ajutor="Ce s-a întâmplat pe drum: ocoluri, opriri, defecte. Gol = rămân cele de la plecare."
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
                <div className="flex flex-wrap items-end gap-3">
                  <Buton
                    type="submit"
                    varianta="primar"
                    inCurs={stare.inCurs}
                    textInCurs="Se trimite…"
                  >
                    Trimite spre aprobare
                  </Buton>
                  {sePoateSterge ? (
                    <Buton
                      type="button"
                      varianta="tertiar"
                      onClick={() => {
                        setConfirmaStergerea(true);
                      }}
                    >
                      {eNumerotata ? "Anulează foaia" : "Șterge ciorna"}
                    </Buton>
                  ) : null}
                </div>
                {sePoateSterge ? null : (
                  <p className="text-muted-foreground text-corp">
                    Foaia are deja numărul {numar}, deci nu se mai șterge. Dacă nu mai e nevoie de
                    ea, cereți administratorului flotei s-o anuleze.
                  </p>
                )}
              </>
            );
          }}
        </Formular>
      ) : null}

      <ConfirmareActiune
        deschis={confirmaStergerea}
        laInchidere={() => {
          setConfirmaStergerea(false);
        }}
        titlu={eNumerotata ? `Anulați foaia ${numar}?` : "Ștergeți ciorna?"}
        consecinta={
          eNumerotata
            ? `Numărul ${numar} rămâne consumat, iar registrul arată foaia anulată. Foaia, cu cursele și alimentările ei, nu se mai poate readuce; ziua rămâne liberă pentru o foaie nouă pe acest vehicul.`
            : "Foaia, cu cursele și alimentările ei, iese din listă și nu se mai poate readuce. Ziua rămâne liberă pentru o foaie nouă pe acest vehicul."
        }
        etichetaConfirmare={eNumerotata ? "Anulează foaia" : "Șterge ciorna"}
        distructiv
        inCurs={seSterge}
        laConfirmare={sterge}
      />

      {!sePoateAlimenta ? null : (
        <Formular actiune={alimenteaza} className="border-border rounded-panou border p-4">
          {(stare) => {
            const trimise: Readonly<Record<string, string>> =
              stare.data === null ? stare.valoriTrimise : {};
            return (
              <>
                <p className="text-corp font-medium">Adaugă o alimentare</p>
                <ErorileFaraCamp erori={stare.erori} campuri={CAMPURI_ALIMENTARE} />
                <div ref={ancoraAlimentare} className="grid gap-3 sm:grid-cols-2">
                  <PozaBonAlimentare key={rundaBon} foaieId={id} laSchimbare={schimbaPoza} />
                  {poateCitiBonul ? (
                    <ButonCitesteBonul
                      key={bon?.cale ?? "fara-poza"}
                      tripSheetId={id}
                      cale={bon?.cale ?? null}
                      onPropunere={aplicaPropunerea}
                    />
                  ) : null}
                </div>
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
                    eticheta={eticheta("Când", "alimentat_la")}
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
                    eticheta={eticheta("Litri", "litri")}
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
                    eticheta={eticheta("Cost (lei)", "cost")}
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
                    eticheta={eticheta("Stație", "statie")}
                    erori={stare.erori["statie"] ?? []}
                  >
                    {(a) => <input {...a} maxLength={120} defaultValue={trimise["statie"] ?? ""} />}
                  </Camp>
                  <Camp
                    nume="numar_bon"
                    id="alimentare-bon"
                    eticheta={eticheta("Număr bon", "numar_bon")}
                    ajutor="Același bon nu se poate trece de două ori pe foaie."
                    erori={stare.erori["numar_bon"] ?? []}
                  >
                    {(a) => (
                      <input {...a} maxLength={60} defaultValue={trimise["numar_bon"] ?? ""} />
                    )}
                  </Camp>
                  <Camp
                    nume="cui_statie"
                    id="alimentare-cui-statie"
                    eticheta={eticheta("CUI stație", "cui_statie")}
                    ajutor="Codul fiscal al stației, de pe bon. Opțional."
                    erori={stare.erori["cui_statie"] ?? []}
                  >
                    {(a) => (
                      <input
                        {...a}
                        maxLength={20}
                        inputMode="numeric"
                        defaultValue={trimise["cui_statie"] ?? ""}
                      />
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
