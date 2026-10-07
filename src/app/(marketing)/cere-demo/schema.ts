// src/app/(marketing)/cere-demo/schema.ts
import { z } from "zod";

import {
  BENZI_ANGAJATI,
  MESAJE_RO,
  TIPAR_TELEFON,
  type CereDemoInput,
  type MesajeCereDemo,
} from "./campuri";

/**
 * Schema cererii de demonstrație — DOAR pe server.
 *
 * O folosește numai `actions.ts`. Constantele, mesajele și validarea din client
 * stau în `campuri.ts`, fără Zod: importată de formular, schema aducea Zod în
 * JavaScript-ul paginii de start (auditul din 7 oct 2026). Mesajele rămân
 * parametru, cu implicit românesc: aici ajung în jurnal.
 */

export function creeazaSchemaCereDemo(mesaje: MesajeCereDemo = MESAJE_RO) {
  return z.object({
    nume: z.string().trim().min(3, mesaje.numeMin).max(120, mesaje.numeMax),
    firma: z.string().trim().min(2, mesaje.firmaMin).max(160, mesaje.firmaMax),
    email: z.email(mesaje.email).max(254, mesaje.emailMax),
    telefon: z
      .string()
      .trim()
      .max(32, mesaje.telefonMax)
      .refine(
        (valoare) => valoare.length === 0 || TIPAR_TELEFON.test(valoare),
        mesaje.telefonFormat,
      ),
    nrAngajati: z.enum(BENZI_ANGAJATI, mesaje.nrAngajati),
    mesaj: z.string().trim().max(2000, mesaje.mesajMax),
  });
}

export const schemaCereDemo = creeazaSchemaCereDemo();

/**
 * Tipul scris de mână în `campuri.ts` și cel dedus aici nu au voie să se
 * despartă: o diferență oprește `tsc`.
 */
type Egal<A, B> = [A] extends [B] ? ([B] extends [A] ? true : false) : false;
export const ACELASI_TIP: Egal<z.infer<typeof schemaCereDemo>, CereDemoInput> = true;
