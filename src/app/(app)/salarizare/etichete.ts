// src/app/(app)/salarizare/etichete.ts
import type { TonStare } from "@/components/ui/badge";
import type { Enums } from "@/types/database";

/**
 * Uniunea se ia din tipurile bazei, nu se rescrie de mână. Rescrisă, ea era o
 * A DOUA definiție a lui `payroll_period_status`, care putea rămâne în urmă
 * fără ca nimic s-o observe.
 */
type StatusPerioada = Enums<"payroll_period_status">;

/**
 * Tipul declarat rămâne larg (`Record<string, string>`) ca `?? p.status` din
 * `salarizare/page.tsx:64` să rămână o ramură vie când baza o ia înaintea
 * tipurilor generate; `satisfies` de dedesubt cere însă la COMPILARE un cuvânt
 * românesc pentru fiecare valoare a enumului. Fără el, o stare nouă ajungea pe
 * ecran ca identificator brut de Postgres — „in_recalculare” — fără nicio
 * eroare nicăieri.
 */
export const ETICHETE_STATUS_PERIOADA: Readonly<Record<string, string>> = {
  draft: "Ciornă",
  calculat: "Calculat",
  aprobat: "Aprobat",
  inchis: "Închis",
} satisfies Readonly<Record<StatusPerioada, string>>;

export const TONURI_STATUS_PERIOADA: Readonly<Record<StatusPerioada, TonStare>> = {
  draft: "ciorna",
  // Calculat = cifrele există, dar nimeni nu le-a aprobat încă; e o etapă care
  // AȘTEAPTĂ o decizie, nu un rezultat bun — de aceea atenție, nu succes.
  calculat: "atentie",
  aprobat: "succes",
  // Închis = perioadă încheiată, nu eroare — de aceea neutru, nu pericol.
  inchis: "neutru",
};

export const LUNI_RO = [
  "ianuarie",
  "februarie",
  "martie",
  "aprilie",
  "mai",
  "iunie",
  "iulie",
  "august",
  "septembrie",
  "octombrie",
  "noiembrie",
  "decembrie",
] as const;

export function numeLuna(luna: number): string {
  return LUNI_RO[luna - 1] ?? String(luna);
}

/**
 * Avertismentul obligatoriu — pe fiecare ecran al modulului și în footer-ul
 * oricărui fluturaș exportat. Modulul nu e certificat: vezi
 * `domain/payroll/calc.ts` pentru ce anume s-a simplificat și de ce.
 */
export const AVERTISMENT_SALARIZARE =
  "Modulul Salarizare este un instrument intern de calcul și evidență. NU este software de salarizare certificat și nu înlocuiește statul de plată oficial, declarația D112 sau avizul contabilului. Toate cotele se configurează per organizație și se verifică de contabilul autorizat înainte de plată.";
