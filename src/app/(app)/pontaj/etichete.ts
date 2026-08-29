// src/app/(app)/pontaj/etichete.ts
import type { TonStare } from "@/components/ui/badge";
import type { ConfigZi } from "@/domain/attendance/calcul-ore";
import { formatOre } from "@/lib/format/ore";
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
 * Codul scris ÎN celula matricei, când ziua n-are ore lucrate.
 *
 * Înainte, celula afișa `ETICHETE_TIP_ZI[tip].slice(0, 3)` — o tăiere oarbă
 * care producea „Wee”, „Săr”, „Con”, „Luc”. „Wee” nu e un cuvânt românesc, iar
 * „Luc” apărea pe o zi lucrătoare cu 0 ore ÎNREGISTRATE, care e altceva decât
 * o zi fără nicio intrare (aceea rămâne „—”): cifra `0` spune exact asta.
 * Restul sunt codurile de pontaj consacrate din practica românească.
 */
export const CODURI_TIP_ZI: Readonly<Record<TipZi, string>> = {
  lucratoare: "0",
  weekend: "L",
  sarbatoare: "SL",
  concediu: "CO",
  medical: "CM",
  absenta_nemotivata: "AN",
  delegatie: "D",
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

/**
 * Regula de pontaj a firmei, scrisă într-o propoziție, pentru ziua pontată.
 *
 * ── DE CE EXISTĂ ──────────────────────────────────────────────────────────
 * Ecranul angajatului arăta trei cifre — interval, ore lucrate, din care
 * suplimentare — și niciun cuvânt despre regula după care au ieșit. Când
 * pauza NU se scade, în rezumat nu apare niciun rând de pauză, deci ecranul
 * arată identic pentru o firmă care n-a configurat nimic și pentru una cu
 * pauză de 30 de minute plătită. Un om care vede 8:30 lucrate în loc de 8:00
 * nu are cum să afle dacă e o regulă a firmei sau un defect.
 *
 * Contează mai ales fiindcă `attendance_settings` are ISTORIC
 * (`valabil_de_la`): o regulă schimbată azi și pusă în vigoare de luna
 * viitoare NU se aplică zilei de azi. Fără propoziția asta, diferența e
 * invizibilă pe ecranul pe care se vede.
 *
 * `areSetari` e separat de valorile din `config`: fără el, o firmă
 * neconfigurată și una configurată exact pe valorile de rezervă ar da același
 * text, iar prima trebuie să afle că merge pe implicit.
 */
export function rezumatRegulaPontaj(config: ConfigZi, areSetari: boolean): string {
  const norma = `normă ${formatOre(config.orePeZi)} h/zi`;

  const pauza =
    config.pauzaMinute === 0
      ? "fără pauză de masă configurată"
      : config.pauzaInclusaInProgram
        ? `pauza de ${String(config.pauzaMinute)} min e inclusă în programul plătit, deci NU se scade`
        : `pauza de ${String(config.pauzaMinute)} min se scade peste ${formatOre(config.pauzaObligatoriePesteOre)} h lucrate`;

  return areSetari
    ? `Regula firmei: ${norma} · ${pauza}.`
    : `Firma n-a configurat încă regulile de pontaj, deci se aplică ${norma} · ${pauza}.`;
}

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
