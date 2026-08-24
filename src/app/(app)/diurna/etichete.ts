// src/app/(app)/diurna/etichete.ts
import type { TonStare } from "@/components/ui/badge";
import type {
  MijlocTransport,
  RegulaTrecereFrontiera,
  StatusDeplasare,
  TipCheltuiala,
} from "@/schemas/per-diem";

export const ETICHETE_STATUS_DEPLASARE: Readonly<Record<StatusDeplasare, string>> = {
  ciorna: "Ciornă",
  in_aprobare: "În aprobare",
  aprobata: "Aprobată",
  respinsa: "Respinsă",
  anulata: "Anulată",
  incheiata: "Încheiată",
  decontata: "Decontată",
};

export const TONURI_STATUS_DEPLASARE: Readonly<Record<StatusDeplasare, TonStare>> = {
  // Ciornă = deplasare începută, netrimisă încă — bulina goală spune exact asta.
  ciorna: "ciorna",
  // Trimisă spre decizie: cere acțiunea altcuiva, deci atenție, nu succes.
  in_aprobare: "atentie",
  aprobata: "succes",
  respinsa: "pericol",
  anulata: "neutru",
  // Deplasarea s-a terminat, dar banii n-au fost încă decontați: stare închisă,
  // fără conotație de reușită.
  incheiata: "neutru",
  // Starea finală reușită a fluxului (ciornă → aprobare → aprobată → decontată):
  // rămâne „succes”, deși culoarea veche era violet, ca să nu retrogradeze vizual
  // pasul care încheie cu bine dosarul.
  decontata: "succes",
};

export const ETICHETE_MIJLOC_TRANSPORT: Readonly<Record<MijlocTransport, string>> = {
  auto_serviciu: "Auto de serviciu",
  auto_personal: "Auto personal",
  tren: "Tren",
  avion: "Avion",
  autocar: "Autocar",
  naval: "Naval",
  mixt: "Mixt",
  altul: "Altul",
};

export const ETICHETE_TIP_CHELTUIALA: Readonly<Record<TipCheltuiala, string>> = {
  cazare: "Cazare",
  transport: "Transport",
  combustibil: "Combustibil",
  taxa_drum: "Taxă de drum",
  parcare: "Parcare",
  alta: "Altă cheltuială",
};

export const ETICHETE_REGULA_TRECERE: Readonly<Record<RegulaTrecereFrontiera, string>> = {
  tara_plecare: "Țara din care se pleacă în ziua trecerii",
  tara_sosire: "Țara în care se intră în ziua trecerii",
  tara_cu_valoare_mai_mare: "Țara cu baremul mai mare",
  durata_maxima: "Țara în care s-au petrecut cele mai multe ore",
};

/**
 * Numărul de zile de diurnă, scris ca în limba română.
 *
 * Modulul îl scria în trei locuri ca `${String(zile)} zile`: o zi apărea „1
 * zile”, iar o zi și jumătate — „1.5 zile”, cu PUNCT zecimal, lângă sume
 * formatate în convenția românească, în același rând de tabel și pe același
 * document tipărit.
 *
 * `de` intră peste 19: „20 de zile”, dar „101 zile” — regula se uită după
 * ultimele două cifre, nu după mărime.
 *
 * Formatorul are `maximumFractionDigits`, dar NU și `minimumFractionDigits`:
 * `formatAmount` forțează doi zecimali fiindcă e făcut pentru bani, iar cu el
 * o deplasare de trei zile scria „3,00 zile” pe decontul tipărit. Zilele nu
 * sunt o sumă — jumătatea de zi apare doar când există.
 */
const formatorZile = new Intl.NumberFormat("ro-RO", { maximumFractionDigits: 2 });

export function textZile(zile: number): string {
  const numar = formatorZile.format(zile);
  if (zile === 1) return `${numar} zi`;
  const ultimeleDoua = Math.floor(Math.abs(zile)) % 100;
  const cereDe = Math.abs(zile) >= 20 && (ultimeleDoua === 0 || ultimeleDoua >= 20);
  return cereDe ? `${numar} de zile` : `${numar} zile`;
}
