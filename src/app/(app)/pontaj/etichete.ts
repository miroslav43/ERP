// src/app/(app)/pontaj/etichete.ts
import type { StatusPerioada, SursaIntrare, TipZi } from "@/schemas/attendance";

export const ETICHETE_TIP_ZI: Readonly<Record<TipZi, string>> = {
  lucratoare: "Lucrătoare",
  weekend: "Weekend",
  sarbatoare: "Sărbătoare",
  concediu: "Concediu",
  medical: "Medical",
  absenta_nemotivata: "Absență nemotivată",
  delegatie: "Delegație",
};

/** Marcaj de fundal per tip de zi — folosit ÎMPREUNĂ cu text, niciodată singur. */
export const CLASE_TIP_ZI: Readonly<Record<TipZi, string>> = {
  lucratoare: "",
  weekend: "bg-zinc-100 dark:bg-zinc-800",
  sarbatoare: "bg-amber-50 dark:bg-amber-950",
  concediu: "bg-blue-50 dark:bg-blue-950",
  medical: "bg-purple-50 dark:bg-purple-950",
  absenta_nemotivata: "bg-red-50 dark:bg-red-950",
  delegatie: "bg-emerald-50 dark:bg-emerald-950",
};

export const ETICHETE_STATUS_PERIOADA: Readonly<Record<StatusPerioada, string>> = {
  deschisa: "Deschisă",
  in_aprobare: "În aprobare",
  blocata: "Blocată",
};

export const CLASE_STATUS_PERIOADA: Readonly<Record<StatusPerioada, string>> = {
  deschisa: "bg-emerald-100 text-emerald-900 dark:bg-emerald-950 dark:text-emerald-100",
  in_aprobare: "bg-amber-100 text-amber-900 dark:bg-amber-950 dark:text-amber-100",
  blocata: "bg-zinc-200 text-zinc-800 dark:bg-zinc-800 dark:text-zinc-100",
};

export const ETICHETE_SURSA: Readonly<Record<SursaIntrare, string>> = {
  manuala: "Manuală",
  import: "Import",
  sincronizare_concedii: "Din concediu",
};

/** ISO-dow ca la Postgres: luni = 1 … duminică = 7. Comparație pe șir, fără fus orar. */
function isoDow(data: string): number {
  const ziuaJs = new Date(`${data}T00:00:00Z`).getUTCDay();
  return ziuaJs === 0 ? 7 : ziuaJs;
}

/**
 * Copie EXACTĂ a `app.este_zi_lucratoare` (0016_fix_izolare_module.sql):
 * `zi_recuperare` se verifică ÎNAINTEA weekendului — o sâmbătă lucrată în
 * locul unei zile de punte trebuie să rămână lucrătoare. Ordinea contează.
 */
export function esteZiLucratoare(
  data: string,
  sarbatoriNationale: ReadonlySet<string>,
  zileRecuperare: ReadonlySet<string>,
  liberSuplimentar: ReadonlySet<string>,
): boolean {
  if (zileRecuperare.has(data)) return true;
  if (isoDow(data) >= 6) return false;
  if (sarbatoriNationale.has(data)) return false;
  if (liberSuplimentar.has(data)) return false;
  return true;
}

/**
 * Tipul zilei atunci când nimeni nu alege unul explicit — COPIE a derivării
 * din `internal.pontaj_intrare_pregateste` (0013_attendance.sql).
 *
 * Trebuie ținută identică cu trigerul: `salveazaZiPontaj` (actions.ts) o
 * folosește ca să satisfacă tipul generat, care marchează `tip_zi` obligatoriu
 * și nenul (coloana e NOT NULL fără DEFAULT), deși triggerul l-ar deriva
 * singur la `null`. Folosită și aici, în UI, pentru colorarea coloanelor de
 * calendar ale zilelor fără nicio intrare încă.
 */
export function tipZiAutomat(
  data: string,
  sarbatoriNationale: ReadonlySet<string>,
  zileRecuperare: ReadonlySet<string>,
  liberSuplimentar: ReadonlySet<string>,
): TipZi {
  if (esteZiLucratoare(data, sarbatoriNationale, zileRecuperare, liberSuplimentar)) {
    return "lucratoare";
  }
  return isoDow(data) >= 6 ? "weekend" : "sarbatoare";
}
