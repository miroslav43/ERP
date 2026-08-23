"use client";

import { useTransition } from "react";
import { useRouter } from "next/navigation";

import { arataToast } from "@/components/ui/toast";
import type { ActionResult } from "@/lib/actions/types";

/**
 * O scriere pornită dintr-un rând de tabel: EIP returnat, semnătură
 * confirmată, autorizație suspendată.
 *
 * ── DE CE NU `<Formular>` ─────────────────────────────────────────────────
 * `<Formular>` e construit pentru un formular cu câmpuri și erori pe câmp; aici
 * intrarea e o singură valoare (o dată sau un boolean) și rezultatul trebuie
 * anunțat fără să mute focusul din tabel. Ce împrumută de la el e regula care
 * contează: rezultatul se ANUNȚĂ, iar un refuz nu se pierde tăcut.
 *
 * ── DE CE `router.refresh()` DUPĂ FIECARE REUȘITĂ ─────────────────────────
 * Acțiunile declară `revalidate`, dar asta invalidează cache-ul de pe server;
 * arborele deja randat în browser rămâne pe valorile vechi până la o
 * reîmprospătare. Fără ea, rândul ar continua să spună „Nesemnat" după ce baza
 * a scris `true` — exact felul de dezacord care face pe cineva să apese a doua
 * oară.
 */
export function useActiuneRand(): Readonly<{
  inCurs: boolean;
  ruleaza: <T>(
    lucru: () => Promise<ActionResult<T>>,
    mesajReusita: string,
    laReusita?: () => void,
  ) => void;
}> {
  const router = useRouter();
  const [inCurs, porneste] = useTransition();

  function ruleaza<T>(
    lucru: () => Promise<ActionResult<T>>,
    mesajReusita: string,
    laReusita?: () => void,
  ): void {
    porneste(async () => {
      const rezultat = await lucru();
      if (!rezultat.ok) {
        arataToast({ fel: "eroare", text: rezultat.error.message });
        return;
      }
      arataToast({ fel: "reusita", text: mesajReusita });
      laReusita?.();
      router.refresh();
    });
  }

  return { inCurs, ruleaza };
}
