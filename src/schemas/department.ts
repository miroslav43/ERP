// src/schemas/department.ts
import { z } from "zod";

const textOptional = (maxim: number) =>
  z
    .string()
    .trim()
    .max(maxim, `Textul nu poate depăși ${String(maxim)} de caractere.`)
    .nullable()
    .default(null)
    .transform((valoare) => (valoare === null || valoare.length === 0 ? null : valoare));

const uuidOptional = z
  .string()
  .trim()
  .nullable()
  .default(null)
  .transform((valoare) => (valoare === null || valoare.length === 0 ? null : valoare))
  .refine(
    (valoare) => valoare === null || z.uuid().safeParse(valoare).success,
    "Departamentul superior selectat nu este valid.",
  );

/**
 * Consimțământul pentru mutarea managerului în departamentul pe care îl preia.
 *
 * ── DE CE IMPLICITUL E `false`, DEȘI BIFA APARE PORNITĂ ───────────────────
 * Bifa din formular vine pornită, fiindcă asta așteaptă omul: cine conduce un
 * departament face parte din el. Dar implicitul SCHEMEI e opusul, și diferența
 * nu e o scăpare.
 *
 * Câmpul dezleagă o scriere pe fișa ALTCUIVA — un angajat pleacă dintr-un
 * departament și intră în altul, iar efectivul vechi scade. Un apelant care
 * omite câmpul (un POST direct către acțiune, un test, codul de peste șase luni)
 * n-are voie să declanșeze mutarea din tăcere. Consimțământul se TRIMITE, nu se
 * presupune; interfața îl trimite explicit, după ce a arătat unde e omul acum.
 *
 * Cazul „manager nerepartizat" nu trece pe aici deloc: acolo nu se pierde nicio
 * apartenență, deci `decideApartenentaManagerului` repartizează fără să întrebe.
 */
const consimtamantMutareManager = z
  .union([z.boolean(), z.literal("on"), z.literal("")])
  .default(false)
  .transform((valoare) => valoare === true || valoare === "on");

/**
 * Codul departamentului e OPȚIONAL, și asta nu e o scăpare de validare.
 *
 * Multe firme nu au nicio nomenclatură internă de departamente: spun
 * „Contabilitate", nu „CTB". Obligate să inventeze un cod, îl scriau o dată și
 * apoi îl vedeau, cu font monospațiat, lângă fiecare denumire din listă și din
 * organigramă — zgomot pentru toată lumea, pentru totdeauna.
 *
 * Câmpul gol devine `null`, nu șirul vid. Diferența contează în bază: indexul
 * unic `departments_org_cod_uniq` e pe `lower(cod)`, iar Postgres consideră
 * fiecare NULL distinct de oricare altul — deci oricâte departamente fără cod
 * coexistă. Două șiruri vide, în schimb, s-ar fi ciocnit la al doilea
 * departament, cu o eroare de unicitate pe un câmp pe care omul l-a lăsat gol
 * intenționat. Vezi `0139_cod_departament_optional.sql`.
 */
const codOptional = z
  .string()
  .trim()
  .max(32, "Codul nu poate depăși 32 de caractere.")
  .nullable()
  .default(null)
  .transform((valoare) => (valoare === null || valoare.length === 0 ? null : valoare));

export const creeazaDepartamentSchema = z.object({
  cod: codOptional,
  denumire: z.string().trim().min(2, "Denumirea trebuie să aibă cel puțin 2 caractere.").max(160),
  descriere: textOptional(1000),
  parent_id: uuidOptional,
  manager_employee_id: uuidOptional,
  cost_center: textOptional(40),
  muta_managerul_in_departament: consimtamantMutareManager,
});

/**
 * Codul NU mai e omis aici, cum era cât timp a fost obligatoriu la creare.
 * Cine a creat departamentele fără cod și abia peste un an își face o
 * nomenclatură trebuie să le poată completa; altfel singura cale ar fi fost să
 * dezactiveze departamentul și să-l refacă, pierzând istoricul.
 *
 * Consecința de reținut: `lower(cod) = 'conducere'` e cheia după care
 * triggerele din `0107_departamentul_conducere.sql` recunosc conducerea firmei.
 * Cine schimbă acel cod pierde repartizarea automată — comportament, nu defect,
 * și același cu cel descris în `panou-departament.tsx`.
 */
export const actualizeazaDepartamentSchema = creeazaDepartamentSchema.extend({
  id: z.uuid("Departamentul selectat nu este valid."),
});

export const mutaDepartamentSchema = z.object({
  id: z.uuid("Departamentul selectat nu este valid."),
  parent_id: uuidOptional,
});

export const dezactiveazaDepartamentSchema = z.object({
  id: z.uuid("Departamentul selectat nu este valid."),
});
