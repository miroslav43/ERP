// src/config/versiune.ts
//
// Numele și versiunea programului, pentru antetul listărilor.
//
// ── DE CE EXISTĂ FIȘIERUL ĂSTA ──────────────────────────────────────────────
// OMFP 2634/2015, Anexa 1, pct. 58 lit. k) cere ca programul informatic „să
// asigure listări clare, inteligibile și complete, care să conțină următoarele
// elemente de identificare, în antet sau pe fiecare pagină": tipul documentului
// · denumirea entității · perioada · datarea listărilor · paginarea cronologică
// · **precizarea programului informatic și a versiunii utilizate**.
//
// Ultimul element e singurul pe care aplicația nu-l avea nicăieri: versiunea
// trăia doar în `package.json` și nu ajungea în niciun ecran.
//
// ── DE CE IMPORT DIN `package.json`, NU O CONSTANTĂ SCRISĂ DE MÂNĂ ──────────
// O constantă ar fi îngheţat la prima valoare și ar fi minţit pe fiecare
// listare de după prima creştere de versiune — exact felul de neadevăr pe care
// o listare cerută de un organ de control n-are voie să-l poarte. `tsconfig`
// are deja `resolveJsonModule`, deci sursa rămâne una singură.
//
// A se folosi DOAR din componente de server: importul aduce în bundle întregul
// `package.json` dacă ajunge într-o componentă de client.

import { version } from "../../package.json";

export const NUME_PROGRAM = "Administrativo";

export const VERSIUNE_PROGRAM: string = version;

/** Forma cerută în antet: „Administrativo v0.1.0". */
export const PROGRAM_SI_VERSIUNE = `${NUME_PROGRAM} v${VERSIUNE_PROGRAM}`;
