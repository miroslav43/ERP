// src/app/(app)/diurna/etichete.ts
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

export const CLASE_STATUS_DEPLASARE: Readonly<Record<StatusDeplasare, string>> = {
  ciorna: "bg-zinc-200 text-zinc-800",
  in_aprobare: "bg-amber-100 text-amber-900",
  aprobata: "bg-emerald-100 text-emerald-900",
  respinsa: "bg-red-100 text-red-900",
  anulata: "bg-zinc-200 text-zinc-500",
  incheiata: "bg-blue-100 text-blue-900",
  decontata: "bg-violet-100 text-violet-900",
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
