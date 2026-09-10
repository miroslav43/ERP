// src/app/(app)/panou/coada.ts
// Coada panoului: din contori în rânduri, și din rânduri în cifra din antet.
//
// ┌ De ce e fișier separat de `page.tsx` ────────────────────────────────────
// │ Ca să poată fi TESTAT. Cât timp construcția rândurilor stătea în pagină,
// │ nimic n-o putea verifica: `page.tsx` trage după el `queries/panou.ts`, care
// │ începe cu `import "server-only"` — deci un test care ar fi importat-o ar fi
// │ căzut la încărcare, nu la aserțiune.
// │
// │ Aici singurul import e un TIP, iar tipurile se șterg la compilare. Fișierul
// │ e pur: contori în, rânduri afară.
// └──────────────────────────────────────────────────────────────────────────
//
// ┌ Ce păzește testul de alături ────────────────────────────────────────────
// │ Că fiecare contor din `CoadaPanou` produce un rând. Defectul care a impus
// │ despărțirea: `regesDeTransmis` s-a adăugat la contori fără rândul lui, iar
// │ antetul — care își făcea atunci propria sumă, în `queries/panou.ts` — a
// │ anunțat „5" peste o listă de două rânduri. Trei obligații numărate și
// │ nicăieri de văzut.
// └──────────────────────────────────────────────────────────────────────────
import type { ContoarePanou } from "@/lib/queries/panou";

/** Ordinea din coadă: cine mă așteaptă pe mine, apoi ce are termen, apoi ce e blocat. */
export type IntrareCoada = Readonly<{
  cheie: string;
  numar: number;
  titlu: string;
  detaliu: string;
  href: string;
  actiune: string;
  urgent?: boolean;
}>;

/**
 * „3 zile · 1 fișă" — despărțit, fiindcă se aprobă din două blocuri diferite
 * ale aceluiași ecran, iar omul trebuie să știe ce-l așteaptă înainte să intre.
 */
function detaliulPontajului(zile: number, fise: number, luni: number): string {
  const bucati: string[] = [];
  if (zile > 0) {
    const numite = zile === 1 ? "o zi" : `${String(zile)} zile`;
    // „din 2 luni" e avertismentul că un singur ecran nu le arată pe toate:
    // `/pontaj/aprobare` lucrează pe o lună, iar linkul duce în prima.
    bucati.push(luni > 1 ? `${numite} din ${String(luni)} luni` : numite);
  }
  if (fise > 0) bucati.push(fise === 1 ? "o fișă săptămânală" : `${String(fise)} fișe săptămânale`);
  return bucati.join(" · ");
}

export function coadaDinContoare(c: ContoarePanou): readonly IntrareCoada[] {
  const { coada } = c;
  const intrari: IntrareCoada[] = [];

  if (coada.cereriConcediu !== null && coada.cereriConcediu > 0) {
    /*
     * Rândul ducea la `/concedii/aprobari`, dar contorul nu numără același
     * lucru: ecranul acela listează sarcinile atribuite MIE
     * (`deAprobat` filtrează `approval_tasks.approver_user_id = userId`), în
     * timp ce cifra numără CERERILE în curs pe care le văd, oricine ar fi
     * aprobatorul lor. Un `org_admin` care nu e în lanțul de aprobare citea
     * „5 cereri" și deschidea un ecran gol — contorul nu urma lista, exact
     * defectul pe care `queries/panou.ts` îl interzice în capul fișierului.
     * Acum duce la lista filtrată pe aceleași stări, prin aceeași politică
     * RLS, deci cifra și rândurile nu se mai pot contrazice.
     */
    intrari.push({
      cheie: "concedii",
      numar: coada.cereriConcediu,
      titlu: "Cereri de concediu care așteaptă o decizie",
      detaliu: coada.cereriConcediu === 1 ? "cerere trimisă" : "cereri trimise",
      href: "/concedii/echipa?status=trimisa,in_aprobare",
      actiune: "Deschide",
    });
  }
  /*
   * Rândul spunea „Perioade de pontaj trimise spre aprobare — 1 perioadă", și
   * niciun cuvânt nu era adevărat: număra luni în starea `in_aprobare`, în care
   * luna intră când aprobatorul aprobă primul lot — deci APĂREA DUPĂ ce se
   * lucrase, nu se golea niciodată aprobând (doar blocarea o scoate de acolo),
   * și rata restanțele reale, care stăteau în lunile `deschisa`.
   *
   * Acum numără ce se aprobă efectiv, în cuvintele ecranului de dincolo: zile
   * și fișe săptămânale. Linkul poartă luna primei restanțe, fiindcă
   * `/pontaj/aprobare` lucrează pe o singură lună și se deschide implicit pe cea
   * curentă — fără ea, cifra ar fi numărat octombrie și ecranul ar fi arătat
   * septembrie.
   */
  if (coada.pontaj !== null) {
    const { zile, fise, luni, an, luna } = coada.pontaj;
    intrari.push({
      cheie: "pontaj",
      numar: zile + fise,
      titlu: "Pontaj care așteaptă aprobare",
      detaliu: detaliulPontajului(zile, fise, luni),
      href: `/pontaj/aprobare?an=${String(an)}&luna=${String(luna)}`,
      actiune: "Aprobă",
    });
  }
  if (coada.deplasari !== null && coada.deplasari > 0) {
    intrari.push({
      cheie: "diurna",
      numar: coada.deplasari,
      titlu: "Deplasări care așteaptă aprobare",
      detaliu: coada.deplasari === 1 ? "deplasare" : "deplasări",
      href: "/diurna/aprobari",
      actiune: "Aprobă",
    });
  }
  if (coada.foiParcurs !== null && coada.foiParcurs > 0) {
    intrari.push({
      cheie: "foi",
      numar: coada.foiParcurs,
      titlu: "Foi de parcurs trimise spre aprobare",
      detaliu: coada.foiParcurs === 1 ? "foaie" : "foi",
      href: "/flota/aprobari",
      actiune: "Aprobă",
    });
  }
  if (coada.tichete !== null && coada.tichete > 0) {
    intrari.push({
      cheie: "tichete",
      numar: coada.tichete,
      titlu: "Tichete care așteaptă decizia ta",
      detaliu: coada.tichete === 1 ? "tichet" : "tichete",
      href: "/ticketing/coada",
      actiune: "Deschide",
    });
  }
  /*
   * Anomaliile de kilometraj erau citite la fiecare încărcare de panou și
   * aruncate: `contorAnomaliiKm` intra în `Promise.all`, ajungea în
   * `scadente.anomaliiKm` și nicio componentă nu-l citea. Un drum la bază pe
   * fiecare afișare, pentru o cifră care nu apărea nicăieri — și, în același
   * timp, singurul semnal că cineva a scris un kilometraj imposibil rămânea
   * invizibil până când intra cineva anume în `/flota/anomalii`.
   */
  if (coada.anomaliiKm !== null && coada.anomaliiKm > 0) {
    intrari.push({
      cheie: "anomalii",
      numar: coada.anomaliiKm,
      titlu: "Anomalii de kilometraj neconfirmate",
      detaliu: coada.anomaliiKm === 1 ? "citire de contor" : "citiri de contor",
      href: "/flota/anomalii",
      actiune: "Verifică",
    });
  }
  /*
   * REGES ultimul, dar `urgent`: e singura intrare din coadă al cărei termen e
   * prevăzut de lege, cu amendă separată pentru fiecare salariat neînregistrat
   * la timp. Restul cozii întârzie o decizie internă; asta întârzie o
   * declarație către Inspecția Muncii.
   *
   * Contorul e ZERO cât timp firma n-are credențiale — `contorRegesDeTransmis`
   * spune de ce — deci rândul nu apare într-un modul care încă nu poate
   * transmite nimic.
   */
  if (coada.regesDeTransmis !== null && coada.regesDeTransmis > 0) {
    intrari.push({
      cheie: "reges",
      numar: coada.regesDeTransmis,
      titlu: "Evenimente de transmis în REGES",
      detaliu: coada.regesDeTransmis === 1 ? "eveniment" : "evenimente",
      href: "/reges",
      actiune: "Transmite",
      urgent: true,
    });
  }
  return intrari;
}

/**
 * Cifra din antetul cozii — suma RÂNDURILOR, nu a contorilor.
 *
 * Distincția e tot ce împiedică antetul să mintă. Cât timp totalul se calcula
 * în `queries/panou.ts`, peste `CoadaPanou`, un contor adăugat fără rând intra
 * în cifră și nu apărea pe ecran: `regesDeTransmis` a făcut exact asta, iar
 * panoul a anunțat „5" deasupra a două rânduri.
 *
 * Aici nu se mai poate întâmpla — ce nu s-a construit nu se numără.
 */
export function numarulDinAntet(intrari: readonly IntrareCoada[]): number {
  return intrari.reduce((suma, intrare) => suma + intrare.numar, 0);
}
