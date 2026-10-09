// src/app/(marketing)/unelte/calculator-zile-lucratoare/intrebari.ts
import type { IntrebareUnealta } from "@/content/landing/intrebari-pontaj";
import { calendarulAnului } from "@/content/legal/zile-libere";

import { zileLucratoareText } from "../cerere-concediu-de-odihna/text-zile";

/**
 * Întrebările paginii. Articolele sunt citite pe forma consolidată a Codului
 * muncii la 27.04.2026 (legislatie.just.ro, DetaliiDocument/309240):
 * art. 139 alin. (1), art. 145 alin. (1), art. 81 alin. (4), art. 75 alin. (1);
 * RIL nr. 8/2024 e citat acolo, sub art. 75. Totalurile anuale vin din
 * `calendarulAnului`, nu se scriu: anul viitor ar fi rămas cu cifra de azi.
 */
export function intrebariZileLucratoare(an: number): readonly IntrebareUnealta[] {
  const curent = calendarulAnului(an);
  const urmator = calendarulAnului(an + 1);
  return [
    {
      q: "Ce zile nu sunt lucrătoare?",
      a: "Sâmbăta, duminica și cele 17 sărbători legale: 1 și 2 ianuarie, 6 și 7 ianuarie, 24 ianuarie, Vinerea Mare, prima și a doua zi de Paște, 1 mai, 1 iunie, prima și a doua zi de Rusalii, 15 august, 30 noiembrie, 1 decembrie, 25 și 26 decembrie. Paștele e cel ortodox, deci Vinerea Mare și Rusaliile se mută în fiecare an.",
      temei: "art. 139 alin. (1) Codul muncii",
    },
    {
      q: `Câte zile lucrătoare are anul ${String(an)}?`,
      a: `${zileLucratoareText(curent.zileLucratoare)} în ${String(an)} și ${zileLucratoareText(urmator.zileLucratoare)} în ${String(an + 1)}. Pe fiecare lună le găsești în ghidul zilelor libere.`,
      legatura: {
        href: "/ghid/zile-libere",
        eticheta: "Zilele libere și zilele lucrătoare pe luni",
      },
    },
    {
      q: "Se numără și ziua de început?",
      a: "Între două date, da: ambele capete intră, ca într-o cerere de concediu. Peste un număr de zile lucrătoare, nu: numărătoarea începe a doua zi. Așa a stabilit Înalta Curte pentru preaviz — termenul curge din ziua următoare comunicării și se împlinește în ultima lui zi.",
      temei: "RIL nr. 8/2024 (ÎCCJ), pentru art. 75 alin. (1) Codul muncii",
    },
    {
      q: "Zilele libere date de firmă se scad?",
      a: "Nu aici. Zilele libere din contractul colectiv sau din regulamentul intern sunt ale fiecărei firme; calculatorul folosește doar sărbătorile legale. Dacă firma ta are o zi liberă în plus în interval, o scazi din rezultat.",
    },
    {
      q: "Unde contează zilele lucrătoare?",
      a: "La concediul de odihnă, care are cel puțin 20 de zile lucrătoare pe an. La preavizul la demisie, de cel mult 20 de zile lucrătoare pentru funcțiile de execuție și 45 pentru cele de conducere. La preavizul la concediere, de cel puțin 20 de zile lucrătoare. Și la norma lunară: zilele lucrătoare înmulțite cu orele pe zi.",
      temei: "art. 145 alin. (1), art. 81 alin. (4), art. 75 alin. (1) Codul muncii",
    },
  ];
}
