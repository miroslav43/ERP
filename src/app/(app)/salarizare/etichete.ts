// src/app/(app)/salarizare/etichete.ts

export const ETICHETE_STATUS_PERIOADA: Record<string, string> = {
  draft: "Ciornă",
  calculat: "Calculat",
  aprobat: "Aprobat",
  inchis: "Închis",
};

export const CLASE_STATUS_PERIOADA: Record<string, string> = {
  draft: "bg-surface text-muted-foreground",
  calculat: "bg-warning/12 text-foreground",
  aprobat: "bg-success/12 text-foreground",
  inchis: "bg-primary/10 text-primary",
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
