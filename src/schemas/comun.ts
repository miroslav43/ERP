// src/schemas/comun.ts
// Ajutoarele de validare folosite de toate schemele. Un singur exemplar,
// deliberat: aici a stat cel mai scump defect al proiectului.
//
// ── CE S-A ÎNTÂMPLAT ────────────────────────────────────────────────────────
// `optional()` a trăit copiat în ȘAPTE fișiere de scheme, octet cu octet
// identic. Uniunea lui accepta `""` și `undefined`, dar NU `null`:
//
//     z.union([schema, z.literal(""), z.undefined()])
//
// Formularele proiectului trimit însă `null` — e valoarea firească pentru „acest
// câmp nu se aplică”, iar `exactOptionalPropertyTypes` face ca omiterea cheii să
// fie mai greu de scris decât trimiterea ei ca `null`. Rezultatul, măsurat:
//
//   · modulul de cursuri era MORT la scriere pe toate drumurile lui — material,
//     versiune de fișier, atribuire, regulă. Zero rânduri, întotdeauna.
//   · `bifeazaPas` din modulul de integrare respingea orice pas fără document
//     atașat, fiindcă `dovada_document_id` e `string | null` în bază și pleca
//     spre `optional(z.uuid())` ca `null`.
//
// Și era TĂCUT. `z.coerce.number()` pe `null` dă `Number(null) === 0`, deci
// mesajul care ieșea era plafonul câmpului („Termenul are cel puțin o zi.”), pe
// un câmp adesea nerandat — iar `Formular` nu are unde să-l pună.
//
// ── DE CE UN SINGUR FIȘIER ─────────────────────────────────────────────────
// Capcana fusese deja descoperită o dată, documentată la locul faptei și
// ocolită prin disciplină (`onboarding/sabloane/nou/formular-sablon.tsx` trimite
// `""` cu un comentariu care explică de ce). Modulul următor a copiat ajutorul
// fără să copieze disciplina. Un al treilea l-ar copia pe cel reparat de aici,
// sau pe cel stricat de dincolo — la noroc.
//
// `comun.test.ts` refuză declararea unui `const optional` local oriunde în
// `src/schemas/`. Fără poarta aia, nimic din ce scrie mai sus nu ține.

import { z } from "zod";

/**
 * Un câmp opțional venit dintr-un formular sau dintr-un query string.
 *
 * Cele TREI forme ale absenței, toate acceptate și toate normalizate la `null`:
 *   · `undefined` — cheia lipsește din obiect (câmp absent din `FormData`)
 *   · `""`        — controlul există dar e golit (`FormData.get()` pe un input
 *                   randat întoarce ȘIRUL GOL, niciodată `null`)
 *   · `null`      — apelantul spune explicit „nu se aplică”
 *
 * `.default(null as never)` se aplică doar peste `undefined`; celelalte două
 * trec prin uniune și apoi prin `transform`. Ordinea din uniune contează:
 * `schema` prima, ca o valoare validă să nu fie înghițită de o ramură laxă.
 */
export const optional = <T extends z.ZodTypeAny>(schema: T) =>
  z
    .union([schema, z.literal(""), z.null(), z.undefined()])
    .transform((v) => (v === "" || v === undefined || v === null ? null : v))
    .default(null as never);

/**
 * Text opțional venit dintr-un formular (nu din URL): șirul gol devine `null`.
 *
 * `.nullable()` acceptă deja `null`, deci ajutorul ăsta n-a fost niciodată
 * stricat. Trăiește aici ca să nu se mai copieze, nu ca să se repare.
 */
export const textOptional = (maxim: number) =>
  z
    .string()
    .trim()
    .max(maxim, `Textul nu poate depăși ${String(maxim)} de caractere.`)
    .nullable()
    .default(null)
    .transform((v) => (v === null || v.length === 0 ? null : v));

/**
 * Un `<select>` opțional: opțiunea „— Niciunul —” trimite `""`, nu `null`.
 *
 * `z.enum(X).nullable()` RESPINGE șirul gol — verificat rulând zod-ul din
 * depozit, nu dedus. În asistentul de înrolare asta se vedea ca un buton
 * „Continuă” mort: `register()` trimite valoarea brută a controlului, validarea
 * pica pe `special_regime` și pe `stare_civila`, iar niciunul dintre cele două
 * câmpuri nu randa vreun mesaj. Trei ecrane trăiesc azi cu câte un ocol scris
 * de mână (`stareCivila === "" ? null : …`); ocolul se mută aici o dată.
 *
 * MESAJUL SE DĂ DE DOUĂ ORI, deliberat — amândouă căile au fost măsurate:
 *  · pe `z.enum(...)`, fiindcă `zodResolver` desface `invalid_union` și
 *    raportează mesajul RAMURII (probă: întoarce „MESAJ-ENUM”, nu al uniunii);
 *  · pe `z.union(...)`, fiindcă `z.flattenError` din `create-action.ts` citește
 *    mesajul de la NIVELUL uniunii (probă: `fieldErrors` conține „MESAJ-UNIUNE”).
 * Cu unul singur, una dintre cele două căi scapă textul englezesc al lui zod.
 *
 * `z.preprocess` ar fi fost mai scurt, dar face `z.input<>` să fie `unknown`,
 * iar `useForm<z.input<typeof schema>>` și-ar pierde tipul pe fiecare enum.
 */
export const enumOptional = <const T extends readonly [string, ...string[]]>(
  valori: T,
  mesaj: string,
) =>
  z
    .union([z.enum(valori, mesaj), z.literal(""), z.null(), z.undefined()], mesaj)
    .transform((v): T[number] | null =>
      v === "" || v === undefined || v === null ? null : (v as T[number]),
    )
    .default(null as never);

/**
 * Cele patru forme ale câmpului numeric neatins.
 *
 * `"   "` intră aici; `0` NU — un zero tastat de om e o valoare, nu o absență.
 */
const numarGol = (v: unknown): boolean =>
  v === null || v === undefined || (typeof v === "string" && v.trim() === "");

/**
 * Ce trimite efectiv un control numeric: `FormData` dă șiruri, un apel direct
 * de Server Action dă numere, iar react-hook-form dă `""` pe un `<input
 * type="number">` golit — fiindcă nu se folosește `valueAsNumber`.
 */
const numarBrut = (mesaj: string) =>
  z.union([z.string(), z.number(), z.null(), z.undefined()], mesaj);

/** Configurarea comună a celor trei ajutoare numerice. */
type OptiuniNumar = Readonly<{
  min: number;
  max: number;
  /** Mesajul pentru „nu e un număr”. */
  mesaj: string;
  /** Mesajul pentru „în afara intervalului”. */
  interval: string;
  /**
   * Coloana din bază e întreagă (`smallint`, `integer`).
   *
   * Fără el, „30,5 zile de preaviz” trece de Zod și ajunge la Postgres, care
   * ROTUNJEȘTE tăcut la inserare într-un `smallint` — omul vede altă valoare
   * decât a scris, fără niciun mesaj.
   */
  intreg?: boolean;
}>;

/** Miezul comun: coerciția și cele două praguri, cu mesajele lor distincte. */
const miezNumar = (optiuni: OptiuniNumar) => {
  const baza = z.coerce.number(optiuni.mesaj);
  return (optiuni.intreg === true ? baza.int(optiuni.interval) : baza)
    .min(optiuni.min, optiuni.interval)
    .max(optiuni.max, optiuni.interval);
};

/**
 * Un câmp numeric opțional.
 *
 * ── DE CE `.transform(...).pipe(...)` ȘI NU O UNIUNE ──────────────────────
 * `z.coerce.number()` pe `""` dă `Number("") === 0`, iar pe `null` dă tot `0`.
 * Ajutorul local pe care îl înlocuiește (`z.union([z.coerce.number(), z.null()])`)
 * suferea de exact asta: un câmp lăsat gol nu producea „lipsește”, ci plafonul
 * câmpului, calculat pe zero. Golul se scoate ÎNAINTE de coerciție.
 *
 * Conducta păstrează mesajele interioare, deci se poate deosebi „nu e număr” de
 * „în afara intervalului”. O uniune le-ar fi colapsat pe amândouă într-unul.
 */
export const numarOptional = (optiuni: OptiuniNumar) =>
  numarBrut(optiuni.mesaj)
    .transform((v): unknown => (numarGol(v) ? null : v))
    .pipe(miezNumar(optiuni).nullable())
    .default(null as never);

/**
 * Un câmp numeric obligatoriu, care spune „lipsește” în loc să tacă pe zero.
 *
 * Cazul real: „Salariu de bază” golit se scria 0 RON fără niciun mesaj, iar
 * „Normă (ore/săptămână)” golită pica `min(0.5)` cu textul englezesc al lui zod
 * („Too small: expected number to be >=0.5”), pe un câmp care nu randa erori.
 */
export const numarObligatoriu = (optiuni: OptiuniNumar & Readonly<{ lipsa: string }>) =>
  numarBrut(optiuni.mesaj)
    .transform((v, ctx): unknown => {
      if (numarGol(v)) {
        ctx.addIssue({ code: "custom", message: optiuni.lipsa });
        return z.NEVER;
      }
      return v;
    })
    .pipe(miezNumar(optiuni));

/**
 * Un câmp numeric cu implicit: golit, revine la valoarea din configurare.
 *
 * Pentru normă și pentru zilele de concediu — un om care golește câmpul vrea
 * „cât e normal”, nu o eroare.
 */
export const numarCuImplicit = (optiuni: OptiuniNumar & Readonly<{ implicit: number }>) =>
  numarBrut(optiuni.mesaj)
    .transform((v): unknown => (numarGol(v) ? optiuni.implicit : v))
    .pipe(miezNumar(optiuni))
    .default(optiuni.implicit as never);
