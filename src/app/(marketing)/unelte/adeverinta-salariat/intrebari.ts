// src/app/(marketing)/unelte/adeverinta-salariat/intrebari.ts
import type { IntrebareUnealta } from "@/content/landing/intrebari-pontaj";

/** Citite pe Codul muncii consolidat la 27.04.2026: art. 34 alin. (3), (5), (5^1), (5^2). */
export const INTREBARI_ADEVERINTA: readonly IntrebareUnealta[] = [
  {
    q: "Angajatorul e obligat să dea adeverință de salariat?",
    a: "Da. La cererea salariatului sau a unui fost salariat, angajatorul e obligat să elibereze un document care atestă activitatea, durata ei, salariul și vechimea în muncă, în meserie și în specialitate.",
    temei: "art. 34 alin. (5) Codul muncii",
  },
  {
    q: "De ce formularul nu cere CNP-ul?",
    a: "Fiindcă tot ce scrii aici stă în adresa paginii, iar un CNP n-are ce căuta în istoricul browserului. Îl scrii de mână pe foaia tipărită sau în Word, după descărcare.",
  },
  {
    q: "Ce date trebuie să fie în adeverință?",
    a: "Cele din registrul general de evidență a salariaților: funcția, data angajării, tipul contractului, salariul. Salariatul își poate descărca singur un extras din registru, iar vechimea se poate dovedi și cu extrasul.",
    temei: "art. 34 alin. (3), (5^1) și (5^2) Codul muncii",
  },
  {
    q: "E bună pentru medicul de familie, spital, bancă sau grădiniță?",
    a: "Dacă instituția nu cere un formular anume, da: scrii destinația la „Pentru” și o semnezi. Când banca sau casa de asigurări au formularul lor, se completează acela.",
  },
  {
    q: "Cine o semnează?",
    a: "Reprezentantul legal al firmei sau cine e împuternicit de el. Modelul are două rânduri de semnătură: pentru reprezentant și pentru cine a întocmit-o.",
  },
];
