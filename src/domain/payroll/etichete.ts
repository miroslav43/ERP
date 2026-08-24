// src/domain/payroll/etichete.ts
// Etichete pentru tipurile de bonus/reținere (enum-uri `payroll_bonus_type` /
// `payroll_deduction_type`). Neutru — importabil atât din `(app)/salarizare`
// cât și din `components/payroll/fluturas.tsx`, montată și în `(portal)`.

import type { Enums } from "@/types/database";

/**
 * ── DE CE `satisfies` PESTE UN TIP DECLARAT MAI LARG ──────────────────────
 * Cele două hărți sunt singurul loc unde un identificator Postgres devine
 * românește. Diacriticele nu pot sta într-o valoare de enum — „Primă de
 * performanță” nu poate exista în bază — deci traducerea NU are unde să fie
 * decât aici, iar o cheie lipsă nu are cum să fie prinsă de bază.
 *
 * Consumatorul lor, `components/payroll/fluturas.tsx:190`, scrie
 * `ETICHETE_TIP_PRIMA[b.tip] ?? b.tip`. Fallback-ul acela tipărește pe un
 * FLUTURAȘ DE SALARIU identificatorul brut din enum — „prima_performanta”, cu
 * liniuță de subliniere și fără diacritice — pe documentul pe care angajatul îl
 * primește ca dovadă a plății. Nicio eroare, nicăieri: nici la compilare, nici
 * la rulare, nici în jurnal.
 *
 * Cele două adnotări fac lucruri diferite și amândouă sunt necesare:
 *
 * · `satisfies Readonly<Record<Enums<"payroll_bonus_type">, string>>` verifică
 *   la COMPILARE că fiecare valoare din enum are un cuvânt. O migrare care
 *   adaugă `prima_fidelitate` sparge `pnpm typecheck` în loc să lase un
 *   identificator brut pe fluturaș.
 * · tipul declarat rămâne `Record<string, string>`, deci indexarea întoarce
 *   `string | undefined` (`noUncheckedIndexedAccess`) și `?? b.tip` din
 *   fluturaș rămâne o ramură vie. Contează fiindcă `database.ts` se generează
 *   separat de bază: dacă baza e ÎNAINTEA tipurilor, valoarea nouă ajunge la
 *   runtime înainte ca uniunea s-o cunoască, iar plasa de siguranță trebuie să
 *   existe. Compilatorul apără cazul obișnuit; fallback-ul apără decalajul.
 */
export const ETICHETE_TIP_PRIMA: Readonly<Record<string, string>> = {
  prima_performanta: "Primă de performanță",
  prima_proiect: "Primă de proiect",
  prima_vacanta: "Primă de vacanță",
  spor_conditii: "Spor condiții de muncă",
  alta: "Altă primă",
} satisfies Readonly<Record<Enums<"payroll_bonus_type">, string>>;

export const ETICHETE_TIP_RETINERE: Readonly<Record<string, string>> = {
  avans: "Avans",
  poprire: "Poprire",
  imputatie: "Imputație",
  rata_interna: "Rată internă",
  retinere_sindicat: "Reținere sindicat",
  alta: "Altă reținere",
} satisfies Readonly<Record<Enums<"payroll_deduction_type">, string>>;
