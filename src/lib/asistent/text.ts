// src/lib/asistent/text.ts
/**
 * Randor minim pentru textul modelului: paragrafe, liste cu liniuță, îngroșat.
 *
 * Nu `react-markdown`, nu `marked`, nu `remark`. Nu din economie de kilobytes, ci
 * fiindcă promptul CERE modelului exact aceste trei lucruri și nimic altceva.
 * O librărie de markdown ar aduce în plus titluri, tabele, blocuri de cod,
 * imagini și HTML brut — adică o suprafață pe care nu o vrem: un răspuns care
 * conține din greșeală `<img src=x onerror=…>` n-ar trebui nici măcar să poată
 * ajunge în DOM ca altceva decât text.
 *
 * Aici nu poate. Ieșirea e o structură de date cu două forme și un singur
 * atribut de stil; componenta o desenează cu `{text}`, deci totul e text.
 * Injecția nu e prevenită prin curățare, ci prin faptul că nu există drum.
 */

export type Parte = Readonly<{ text: string; ingrosat: boolean }>;

export type Bloc =
  | Readonly<{ tip: "paragraf"; parti: readonly Parte[] }>
  | Readonly<{ tip: "lista"; elemente: readonly (readonly Parte[])[] }>;

const INGROSAT = /\*\*([^*]+)\*\*/g;

/** Taie un rând în bucăți normale și îngroșate. */
export function imparteParti(rand: string): readonly Parte[] {
  const parti: Parte[] = [];
  let pozitie = 0;
  for (const potrivire of rand.matchAll(INGROSAT)) {
    const continut = potrivire[1];
    if (continut === undefined) continue;
    if (potrivire.index > pozitie) {
      parti.push({ text: rand.slice(pozitie, potrivire.index), ingrosat: false });
    }
    parti.push({ text: continut, ingrosat: true });
    pozitie = potrivire.index + potrivire[0].length;
  }
  if (pozitie < rand.length) parti.push({ text: rand.slice(pozitie), ingrosat: false });
  return parti;
}

const esteElement = (rand: string): boolean => /^\s*[-*•]\s+/.test(rand);

export function imparteText(text: string): readonly Bloc[] {
  const blocuri: Bloc[] = [];
  let paragraf: string[] = [];
  let lista: string[] = [];

  const inchideParagraf = (): void => {
    if (paragraf.length === 0) return;
    // Rândurile unui paragraf se lipesc cu spațiu: modelul rupe frazele la
    // lățimea lui, nu la a noastră.
    blocuri.push({ tip: "paragraf", parti: imparteParti(paragraf.join(" ")) });
    paragraf = [];
  };
  const inchideLista = (): void => {
    if (lista.length === 0) return;
    blocuri.push({ tip: "lista", elemente: lista.map((rand) => imparteParti(rand)) });
    lista = [];
  };

  for (const randBrut of text.split("\n")) {
    const rand = randBrut.trim();
    if (rand === "") {
      inchideParagraf();
      inchideLista();
      continue;
    }
    if (esteElement(rand)) {
      inchideParagraf();
      lista.push(rand.replace(/^\s*[-*•]\s+/, ""));
      continue;
    }
    inchideLista();
    paragraf.push(rand);
  }
  inchideParagraf();
  inchideLista();

  return blocuri;
}
