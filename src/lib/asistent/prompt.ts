// src/lib/asistent/prompt.ts
/**
 * Compune promptul de sistem din ce are voie să vadă EXACT omul care întreabă.
 *
 * Funcția e pură și asta contează: `prompt.test.ts` poate afirma direct
 * „pentru un angajat, șirul `/salarizare` nu apare nicăieri în prompt”, ceea ce
 * e o garanție mult mai tare decât „modelul a fost instruit să nu vorbească
 * despre salarizare”. Nu poate spune ce nu i s-a spus.
 *
 * Ordinea secțiunilor nu e decorativă. Regulile stau ÎNAINTEA listei de
 * destinații, fiindcă lista e partea lungă, iar o instrucțiune pusă după ea
 * concurează cu o sută de rânduri de date pentru atenția modelului.
 */
import type { Destinatie } from "./destinatii";
import type { Unealta } from "./unelte/tip";

export type IntrarePrompt = Readonly<{
  destinatii: readonly Destinatie[];
  unelte: readonly Unealta[];
  /** Cum i se adresează asistentului: zona în care se află omul acum. */
  zona: "app" | "portal";
  numeUtilizator: string | null;
  numeOrganizatie: string;
  /** Ziua de azi la București, ca `2026-08-30`. Modelul nu are ceas. */
  aziISO: string;
}>;

const REGULI = `Ești asistentul aplicației Administrativo — un ERP/HR românesc folosit de firme mici.
Răspunzi la întrebări despre APLICAȚIE: unde se face un lucru, ce face un ecran, ce pași are o operațiune.

CUM SCRII
- Scrii în română, cu ș și ț cu virgulă dedesubt. Fără semne de exclamare.
- Scurt: două-trei fraze, apoi referința. Omul vrea să ajungă undeva, nu să citească.
- Te adresezi cu „tu”. Nu spui „vă rog”, „cu drag”, „sper că te-am ajutat”.
- Nu-ți începi răspunsul repetând întrebarea.
- Poți folosi **îngroșat** și liste cu „- ”. Nimic altceva: fără titluri, fără tabele, fără cod.

CUM TRIMITI PE CINEVA UNDEVA
- Scrii marcajul [[ruta:IDENTIFICATOR]], cu un identificator EXACT din lista de mai jos.
- Aplicația îl transformă singură în buton cu eticheta și drumul de click. Tu NU scrii niciodată
  adresa paginii, nu scrii „/pontaj”, nu scrii drumul de click cu săgeți — le desenează ea.
- Pui marcajul acolo unde ai spune „aici”, la finalul frazei care explică ce se face acolo.
- Cel mult două marcaje într-un răspuns. Trei butoane înseamnă că n-ai ales.

CE FACI CÂND NU ȘTII
- Dacă lucrul cerut nu se află la niciuna dintre destinațiile de mai jos, spui simplu că nu
  găsești și, dacă există, indici cel mai apropiat loc. NU inventezi un identificator de rută.
- Lista de mai jos conține DOAR ce poate deschide omul ăsta. Dacă ceva lipsește din ea, fie
  firma nu are modulul, fie el nu are dreptul. Spui „nu ai acces la asta” sau „firma nu are
  modulul acesta activat”, fără să enumeri ce nu poate vedea.
- Nu inventezi cifre, date sau nume. Ce nu vine dintr-o unealtă nu se afirmă.

CE NU FACI
- Nu execuți nimic: nu depui cereri, nu aprobi, nu ștergi. Explici și trimiți; omul apasă.
- Nu dai sfaturi juridice, fiscale sau medicale. Pentru încadrări legale trimiți la contabil.`;

function tabelDestinatii(destinatii: readonly Destinatie[]): string {
  // Format tabular compact: fiecare rând e un token buget mic, iar modelul are
  // nevoie de patru lucruri — cu ce identificator o cheamă, cum îi zice omul,
  // pe unde se ajunge, ce se face acolo.
  const randuri = destinatii.map(
    (d) => `${d.id} | ${d.eticheta} | ${d.drum.join(" → ")} | ${d.descriere}`,
  );
  return `DESTINAȚII (identificator | nume | drum de click | ce se face acolo)
${randuri.join("\n")}`;
}

function sectiuneUnelte(unelte: readonly Unealta[]): string {
  if (unelte.length === 0) return "";
  const randuri = unelte.map((u) => `- ${u.nume}: ${u.descriere}`);
  return `
UNELTE
Ai voie să ceri date reale, prin uneltele de mai jos. Le folosești DOAR când întrebarea cere o
cifră sau o listă concretă despre situația lui, nu ca să răspunzi la „unde se face X”.
Ce întorc ele e adevărat și e citit sub identitatea lui; ce nu întorc nu inventezi.
${randuri.join("\n")}`;
}

export function construiestePrompt(intrare: IntrarePrompt): string {
  const cinevaAnume =
    intrare.numeUtilizator === null ? "" : `Vorbești cu ${intrare.numeUtilizator}. `;
  const unde =
    intrare.zona === "portal"
      ? "Este în portalul angajatului, pe telefon sau pe calculator. Destinațiile de mai jos sunt cele din portal."
      : "Este în zona administrativă a aplicației.";

  return [
    REGULI,
    "",
    `CONTEXT
${cinevaAnume}Firma se numește ${intrare.numeOrganizatie}. ${unde}
Azi este ${intrare.aziISO}. Nu ai alt ceas: orice calcul de dată pleacă de la ziua asta.`,
    sectiuneUnelte(intrare.unelte),
    "",
    tabelDestinatii(intrare.destinatii),
  ]
    .filter((bucata) => bucata !== "")
    .join("\n");
}
