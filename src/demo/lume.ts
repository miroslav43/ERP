/**
 * Firma fictivă a demonstrațiilor — una singură, pentru toate modulele.
 *
 * ── DE CE O SINGURĂ LUME ──────────────────────────────────────────────────
 * Nouăsprezece seturi de fixture-uri independente ar fi arătat ca nouăsprezece
 * capturi de pe site-uri diferite. Aici același Popescu Ion apare în pontaj, în
 * concedii și pe fluturaș: vizitatorul care deschide două module vede aceeași
 * firmă, iar demonstrația capătă o poveste.
 *
 * ── DE CE TOTUL E RELATIV LA „AZI" ────────────────────────────────────────
 * `calendar/page.tsx` ancorează grila pe `todayInBucharest()` și marchează
 * coloana zilei curente. Un fixture cu date scrise literal („12 mai") arată o
 * lună moartă peste trei luni — demo-ul îmbătrânește TĂCUT pe pagina publică,
 * fără nicio eroare. De aceea absențele se descriu prin ziua din lună, iar luna
 * o dă parametrul.
 *
 * Numele sunt inventate. Nu corespund niciunui angajat real al vreunui client.
 */
import { cheieCelula, type AbsentaCelula } from "@/domain/leave/planificator";

import type { RandAngajatPlanificator } from "@/app/(app)/concedii/calendar/planificator-concedii";

export const ANGAJATI: readonly RandAngajatPlanificator[] = [
  { id: "d1", nume: "Popescu Ion", marca: "A-001" },
  { id: "d2", nume: "Ionescu Ana", marca: "A-002" },
  { id: "d3", nume: "Marin Vasile", marca: "A-003" },
  { id: "d4", nume: "Dobre Elena", marca: "A-004" },
  { id: "d5", nume: "Stan Mihai", marca: "A-005" },
  { id: "d6", nume: "Radu Cristina", marca: "A-006" },
  { id: "d7", nume: "Neagu Andrei", marca: "A-007" },
  { id: "d8", nume: "Toma Gabriela", marca: "A-008" },
];

export const TIPURI: readonly Readonly<{ id: string; denumire: string; culoare: string }>[] = [
  { id: "t-odihna", denumire: "Odihnă", culoare: "#2563EB" },
  { id: "t-medical", denumire: "Medical", culoare: "#DC2626" },
  { id: "t-fara-plata", denumire: "Fără plată", culoare: "#B4802A" },
];

export type Absenta = Readonly<{
  employeeId: string;
  deLaZiuaLunii: number;
  panaLaZiuaLunii: number;
  tipId: string;
  stare: "aprobata" | "in_aprobare";
}>;

/**
 * Absențele lunii, descrise prin ziua din lună. Deliberat sub pragul de
 * absenți simultani pe majoritatea zilelor, cu O SINGURĂ suprapunere — ea e
 * argumentul modulului, deci trebuie să se vadă.
 */
const ABSENTE: readonly Absenta[] = [
  { employeeId: "d1", deLaZiuaLunii: 4, panaLaZiuaLunii: 8, tipId: "t-odihna", stare: "aprobata" },
  { employeeId: "d2", deLaZiuaLunii: 6, panaLaZiuaLunii: 7, tipId: "t-medical", stare: "aprobata" },
  {
    employeeId: "d3",
    deLaZiuaLunii: 12,
    panaLaZiuaLunii: 16,
    tipId: "t-odihna",
    stare: "in_aprobare",
  },
  {
    employeeId: "d5",
    deLaZiuaLunii: 19,
    panaLaZiuaLunii: 21,
    tipId: "t-fara-plata",
    stare: "aprobata",
  },
  {
    employeeId: "d7",
    deLaZiuaLunii: 24,
    panaLaZiuaLunii: 26,
    tipId: "t-odihna",
    stare: "in_aprobare",
  },
];

function ziuaIso(an: number, luna: number, zi: number): string {
  return `${String(an)}-${String(luna).padStart(2, "0")}-${String(zi).padStart(2, "0")}`;
}

/** Câte zile are luna — `new Date(an, luna, 0)` dă ultima zi a lunii `luna`. */
function zileInLuna(an: number, luna: number): number {
  return new Date(an, luna, 0).getDate();
}

/**
 * Celulele planificatorului pentru luna în care cade `azi` (ISO, `YYYY-MM-DD`).
 * Cheia e cea produsă de `cheieCelula`, nu una construită de mână: dacă
 * formatul ei se schimbă, demo-ul se schimbă odată cu el.
 */
export function absenteLunii(azi: string): Readonly<Record<string, readonly AbsentaCelula[]>> {
  const an = Number(azi.slice(0, 4));
  const luna = Number(azi.slice(5, 7));
  const ultima = zileInLuna(an, luna);
  const harta = new Map<string, AbsentaCelula[]>();

  for (const absenta of ABSENTE) {
    const tip = TIPURI.find((t) => t.id === absenta.tipId);
    if (tip === undefined) continue;
    for (let zi = absenta.deLaZiuaLunii; zi <= Math.min(absenta.panaLaZiuaLunii, ultima); zi += 1) {
      const cheie = cheieCelula(absenta.employeeId, ziuaIso(an, luna, zi));
      const celula: AbsentaCelula = {
        tipId: tip.id,
        tipDenumire: tip.denumire,
        tipCuloare: tip.culoare,
        stare: absenta.stare,
      };
      const existent = harta.get(cheie);
      if (existent === undefined) harta.set(cheie, [celula]);
      else existent.push(celula);
    }
  }

  return Object.fromEntries(harta);
}
