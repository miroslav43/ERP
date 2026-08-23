// src/app/(app)/pontaj/etichete.ts
import type { TonStare } from "@/components/ui/badge";
import type {
  StareSaptamanaPontaj,
  StatusPerioada,
  SursaIntrare,
  TipPrezenta,
  TipZi,
} from "@/schemas/attendance";

export const ETICHETE_TIP_PREZENTA: Readonly<Record<TipPrezenta, string>> = {
  birou: "La birou",
  homeoffice: "Homeoffice",
  deplasare: "Deplasare",
  delegatie: "Delegație",
};

export const ETICHETE_STARE_SAPTAMANA: Readonly<Record<StareSaptamanaPontaj, string>> = {
  ciorna: "Ciornă",
  trimisa: "Trimisă, în așteptare",
  aprobata: "Aprobată",
  respinsa: "Respinsă",
};

export const TONURI_STARE_SAPTAMANA: Readonly<Record<StareSaptamanaPontaj, TonStare>> = {
  ciorna: "ciorna",
  // Trimisă = se așteaptă decizia altcuiva, nu e încă un succes.
  trimisa: "atentie",
  aprobata: "succes",
  respinsa: "pericol",
};

export const ETICHETE_TIP_ZI: Readonly<Record<TipZi, string>> = {
  lucratoare: "Lucrătoare",
  weekend: "Weekend",
  sarbatoare: "Sărbătoare",
  concediu: "Concediu",
  medical: "Medical",
  absenta_nemotivata: "Absență nemotivată",
  delegatie: "Delegație",
};

/**
 * Fundal de celulă în matricea foii colective — NU o pastilă, deci nu trece
 * prin `<Badge>`: aici se colorează celula, nu se pune o etichetă în ea.
 *
 * Șirurile goale sunt intenționate (docs/design/stari-de-interactiune.md,
 * tabelul 1b): codul de trei litere din celulă e deja purtătorul înțelesului,
 * culoarea doar îl repeta — și se pierdea oricum la tipărire. Rămân colorate
 * doar sărbătoarea (singura apariție a auriului din tot sistemul, `bg-accent/25`)
 * și absența nemotivată, singura care merită alarmă.
 */
export const CLASE_TIP_ZI: Readonly<Record<TipZi, string>> = {
  lucratoare: "",
  weekend: "bg-surface",
  sarbatoare: "bg-accent/25",
  concediu: "",
  medical: "",
  absenta_nemotivata: "bg-danger/8",
  delegatie: "",
};

export const ETICHETE_STATUS_PERIOADA: Readonly<Record<StatusPerioada, string>> = {
  deschisa: "Deschisă",
  in_aprobare: "În aprobare",
  blocata: "Blocată",
};

export const TONURI_STATUS_PERIOADA: Readonly<Record<StatusPerioada, TonStare>> = {
  deschisa: "succes",
  // În aprobare = luna se închide, dar nu s-a închis încă.
  in_aprobare: "atentie",
  // Blocată = perioadă încheiată, nu eroare — de aceea neutru, nu pericol.
  blocata: "neutru",
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
