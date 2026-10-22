// src/config/file-module.ts
/**
 * Filele fiecărui modul, scrise O SINGURĂ DATĂ.
 *
 * Nicio condiție de permisiune aici: `FileModul` filtrează fiecare filă prin
 * `poateDeschide()` din registrul porților de rută, adică prin poarta paginii
 * pe care fila o deschide. Un modul care vrea o filă nouă adaugă un rând; cine
 * poate să o vadă se decide din `porti-ruta.ts`, nu de aici.
 */
import type { FilaModul } from "@/components/ui/file-client";

export const FILE_FLOTA: readonly FilaModul[] = [
  { href: "/flota", eticheta: "Vehicule" },
  { href: "/flota/foi", eticheta: "Foi de parcurs" },
  { href: "/flota/aprobari", eticheta: "De aprobat" },
  { href: "/flota/anomalii", eticheta: "Anomalii de kilometraj" },
  // 0200: rutele recurente; fila apare doar pentru `trip_sheets:update = all`.
  { href: "/flota/foi/sabloane", eticheta: "Șabloane de traseu" },
  // 0201: responsabilii, pragul de salt și pragurile de alertă; fila apare doar
  // pentru `vehicles:update = all`, poarta politicilor `fleet_settings`.
  // F8: costul pe vehicul, consumul față de normă, kilometrii pe șofer și descărcarea
  // pentru contabil; fila apare doar cu `vehicles:read = all` (poarta rutei).
  { href: "/flota/rapoarte", eticheta: "Rapoarte" },
  { href: "/flota/setari", eticheta: "Setări" },
  // 0202: nomenclatorul de documente al firmei; aceeași poartă ca setările.
  { href: "/flota/setari/documente", eticheta: "Tipuri de document" },
  // 0205: regimul fiscal al vehiculelor și luna fiscală; fila apare doar pentru
  // `vehicles:read = all`, poarta politicilor tabelelor fiscale.
  { href: "/flota/fiscal", eticheta: "Fiscal" },
  // 0206: amenzile primite pe vehicule și incidentele / dauna; filele apar doar
  // pentru `vehicle_fines:read = all` / `vehicle_incidents:read = all`, poarta
  // politicilor lor (seedate doar pentru `org_admin`).
  { href: "/flota/amenzi", eticheta: "Amenzi" },
  { href: "/flota/incidente", eticheta: "Incidente" },
  // F12b (0214): cardurile de combustibil; fila apare pentru `vehicles:read = team`
  // (poarta paginii). Importul și tranzacțiile se deschid din pagina cardurilor.
  { href: "/flota/carduri", eticheta: "Carduri" },
];

export function fileEvaluari(contoare: Readonly<{ sabloane?: number }> = {}): readonly FilaModul[] {
  return [
    { href: "/evaluari", eticheta: "Evaluări" },
    { href: "/evaluari/kpi", eticheta: "KPI lunar" },
    {
      href: "/evaluari/sabloane",
      eticheta: "Șabloane",
      ...(contoare.sabloane === undefined ? {} : { contor: contoare.sabloane }),
    },
    // Pentru cei evaluați care nu intră în portal: manager, HR, administrator.
    { href: "/evaluari/ale-mele", eticheta: "Ale mele" },
  ];
}

export const FILE_MENTENANTA: readonly FilaModul[] = [
  { href: "/mentenanta", eticheta: "Panou" },
  { href: "/mentenanta/echipamente", eticheta: "Echipamente" },
  { href: "/mentenanta/contoare", eticheta: "Contoare" },
  { href: "/mentenanta/planuri", eticheta: "Planuri" },
  { href: "/mentenanta/interventii", eticheta: "Intervenții" },
  // ── Mentenanță M7 ──
  { href: "/mentenanta/iscir", eticheta: "ISCIR" },
  // ── sfârșit M7 ──
  { href: "/mentenanta/sesizari", eticheta: "Sesizări" },
  // ── Mentenanță M8 ──
  { href: "/mentenanta/rapoarte", eticheta: "Rapoarte" },
  // ── sfârșit M8 ──
  { href: "/mentenanta/setari", eticheta: "Setări" },
];

/**
 * „Pontarea" salvează un rând per firmă; „Regulile de timp" creează o VERSIUNE
 * nouă, ca o lună deja calculată să rămână explicabilă. „Coduri QR" stă aici
 * fiindcă omul îl caută în pontaj, nu în puncte de lucru; poarta lui e însă a
 * punctului de lucru (`departments:update`), și registrul o știe.
 */
export const FILE_SETARI_PONTAJ: readonly FilaModul[] = [
  { href: "/pontaj/setari", eticheta: "Pontarea" },
  { href: "/pontaj/setari/reguli", eticheta: "Regulile de timp" },
  { href: "/pontaj/setari/coduri-qr", eticheta: "Coduri QR" },
];

export const FILE_TICKETING: readonly FilaModul[] = [
  { href: "/ticketing", eticheta: "Tichetele mele" },
  { href: "/ticketing/coada", eticheta: "Coada echipei" },
];

export const FILE_SETARI: readonly FilaModul[] = [
  { href: "/setari/organizatie", eticheta: "Organizație" },
  { href: "/setari/membri", eticheta: "Membri și invitații" },
  { href: "/setari/audit", eticheta: "Jurnal de audit" },
];
