import "server-only";

import { valideazaCnp } from "@/domain/employee/cnp";
import { catreBytea, encrypt, versiuneCaNumar } from "@/lib/crypto/aes-gcm";

/**
 * Doar scriere + citire mascată. Spre deosebire de `sensitive-data.ts`
 * (angajați), acest plan nu are UI care decriptează CNP-ul reprezentantului
 * legal — dacă apare nevoia, se adaugă atunci o funcție de citire completă,
 * cu jurnalizare explicită, ca la angajați.
 */
export class EroareCnpReprezentant extends Error {
  constructor(mesaj: string) {
    super(mesaj);
    this.name = "EroareCnpReprezentant";
  }
}

export interface PayloadCnpReprezentant {
  readonly cnp_ciphertext: string | null;
  readonly cnp_iv: string | null;
  readonly cnp_tag: string | null;
  readonly cnp_key_version: number | null;
  readonly cnp_last4: string | null;
}

export function pregatestePayloadCnp(cnpBrut: string | null): PayloadCnpReprezentant {
  if (cnpBrut === null || cnpBrut.trim().length === 0) {
    return {
      cnp_ciphertext: null,
      cnp_iv: null,
      cnp_tag: null,
      cnp_key_version: null,
      cnp_last4: null,
    };
  }
  const rezultat = valideazaCnp(cnpBrut);
  if (!rezultat.valid) {
    throw new EroareCnpReprezentant(rezultat.mesaj);
  }
  const criptat = encrypt(rezultat.cnp);
  return {
    cnp_ciphertext: catreBytea(criptat.ciphertext),
    cnp_iv: catreBytea(criptat.iv),
    cnp_tag: catreBytea(criptat.tag),
    cnp_key_version: versiuneCaNumar(criptat.keyVersion),
    cnp_last4: rezultat.cnp.slice(-4),
  };
}

/** Mascare pentru afișare — niciodată ciphertext-ul, doar ultimele 4 cifre. */
export function cnpMascatReprezentant(ultimele4: string | null): string | null {
  if (ultimele4 === null) return null;
  return `${"*".repeat(9)}${ultimele4}`;
}
