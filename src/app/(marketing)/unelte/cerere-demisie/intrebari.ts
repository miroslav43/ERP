// src/app/(marketing)/unelte/cerere-demisie/intrebari.ts
import type { IntrebareUnealta } from "@/content/landing/intrebari-pontaj";

/**
 * Întrebările despre demisie, în ordinea în care se caută (completarea
 * automată Google, 8 oct 2026). Fiecare răspuns e citit pe Codul muncii
 * consolidat la 27.04.2026; regula de numărare a preavizului e prin analogie
 * cu RIL nr. 8/2024 și o spunem așa.
 */
export const INTREBARI_DEMISIE: readonly IntrebareUnealta[] = [
  {
    q: "Preavizul la demisie e în zile lucrătoare sau calendaristice?",
    a: "Plafonul din lege e în zile lucrătoare: preavizul e cel din contractul individual sau din contractul colectiv, dar nu mai mult de 20 de zile lucrătoare pentru funcțiile de execuție și 45 pentru cele de conducere. Dacă în contract scrie un număr de zile lucrătoare, sâmbetele, duminicile și sărbătorile legale nu intră în numărătoare. Dacă scrie zile calendaristice, se numără așa, dar fără să treacă de plafon. Unealta numără doar zile lucrătoare.",
    temei: "art. 81 alin. (4) Codul muncii",
  },
  {
    q: "De când începe să curgă preavizul?",
    a: "Din ziua următoare înregistrării demisiei. Pentru preavizul la concediere, Înalta Curte a stabilit exact asta: termenul curge din ziua următoare comunicării și se împlinește în ultima lui zi. Codul nu spune altceva pentru demisie, iar unealta aplică aceeași regulă. Dacă firma numără altfel, ultima zi se mută cu o zi.",
    temei: "art. 81 alin. (1) și (7); RIL nr. 8/2024 (ÎCCJ), pentru art. 75",
  },
  {
    q: "Pot pleca la zi, fără preaviz?",
    a: "Da, în trei situații: angajatorul renunță la preaviz, total sau parțial; angajatorul nu își îndeplinește obligațiile din contract; ești în perioada de probă. Altfel, plecarea la o dată aleasă de amândoi e acordul părților, pe care angajatorul trebuie să-l semneze.",
    temei: "art. 81 alin. (7) și (8), art. 31 alin. (3), art. 55 lit. b) Codul muncii",
  },
  {
    q: "Ce se întâmplă cu preavizul dacă intru în concediu medical?",
    a: "Concediul pentru incapacitate temporară de muncă suspendă contractul de drept, iar preavizul se suspendă odată cu el. Ultima zi se mută mai târziu, cu perioada suspendării.",
    temei: "art. 50 lit. b) și art. 81 alin. (6) Codul muncii",
  },
  {
    q: "Pot să-mi iau concediu de odihnă în preaviz?",
    a: "Codul nu interzice. Pe durata preavizului contractul își produce toate efectele, deci concediul se ia ca oricând, cu programarea sau acordul angajatorului. Concediul de odihnă nu e un caz de suspendare a contractului, așa că nu mută ultima zi; concediul medical o mută.",
    temei: "art. 81 alin. (5) Codul muncii",
  },
  {
    q: "Trebuie să motivez demisia?",
    a: "Nu. Salariatul are dreptul să nu își motiveze demisia, iar modelul de aici nu are un rând pentru motiv.",
    temei: "art. 81 alin. (3) Codul muncii",
  },
  {
    q: "Ce fac dacă angajatorul refuză să înregistreze demisia?",
    a: "Angajatorul e obligat s-o înregistreze. Dacă refuză, o poți dovedi prin orice mijloc de probă — de exemplu, o trimiți prin poștă cu confirmare de primire și păstrezi dovada.",
    temei: "art. 81 alin. (2) Codul muncii",
  },
];
