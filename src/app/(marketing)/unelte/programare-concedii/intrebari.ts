// src/app/(marketing)/unelte/programare-concedii/intrebari.ts
import type { IntrebareUnealta } from "@/content/landing/intrebari-pontaj";

/** Citite pe Codul muncii consolidat la 27.04.2026: art. 145, 147, 148, 149. */
export const INTREBARI_PROGRAMARE: readonly IntrebareUnealta[] = [
  {
    q: "Până când se face programarea concediilor?",
    a: "Până la sfârșitul anului, pentru anul următor. Programarea pe 2027 se face, deci, cel târziu în decembrie 2026.",
    temei: "art. 148 alin. (1) Codul muncii",
  },
  {
    q: "Cine stabilește programarea?",
    a: "Angajatorul. Pentru programarea colectivă consultă sindicatul sau, unde nu există, reprezentanții salariaților; pentru cea individuală, salariatul.",
    temei: "art. 148 alin. (1) Codul muncii",
  },
  {
    q: "Cât de lungă poate fi perioada programată?",
    a: "Programarea colectivă stabilește perioade de cel puțin 3 luni, pe categorii de personal sau locuri de muncă; cea individuală, o dată sau o perioadă de cel mult 3 luni. În perioada stabilită, salariatul poate cere concediul cu cel puțin 60 de zile înainte.",
    temei: "art. 148 alin. (2)–(4) Codul muncii",
  },
  {
    q: "Se poate împărți concediul în mai multe bucăți?",
    a: "Da, dar fiecare salariat trebuie să aibă în an cel puțin 10 zile lucrătoare de concediu neîntrerupt.",
    temei: "art. 148 alin. (5) Codul muncii",
  },
  {
    q: "Câte zile de concediu se trec în tabel?",
    a: "Cel puțin 20 de zile lucrătoare pe an, plus cele din contractul individual sau colectiv. Cine lucrează în condiții grele, periculoase sau vătămătoare, nevăzătorii, alte persoane cu handicap și tinerii sub 18 ani au cel puțin 3 zile suplimentare.",
    temei: "art. 145 alin. (1) și art. 147 alin. (1) Codul muncii",
    legatura: {
      href: "/unelte/calculator-zile-concediu",
      eticheta: "Calculatorul de zile de concediu",
    },
  },
  {
    q: "Salariatul e obligat să ia concediul în perioada programată?",
    a: "Da, cu excepțiile prevăzute de lege sau când, din motive obiective, concediul nu poate fi efectuat.",
    temei: "art. 149 Codul muncii",
  },
];
