"use client";
// src/app/(app)/pontaj/buton-sincronizare-concedii.tsx
//
// „Sincronizează concediile" din antetul foii de prezență.
//
// Butonul exista doar în `/pontaj/aprobare`, sub aprobarea în bloc — adică pe
// ecranul pe care ajungi când vrei să APROBI, nu când vezi că o zi de concediu
// lipsește din foaie. Acolo se vede lipsa, deci acolo stă și reparația.
//
// Rezultatul iese ca notificare, nu în pagină: antetul n-are loc pentru un
// paragraf, iar `router.refresh()` arată oricum foaia schimbată.
import { useTransition, type ReactElement } from "react";
import { useRouter } from "next/navigation";
import { RefreshCw } from "lucide-react";

import { Buton } from "@/components/ui/buton";
import { arataToast } from "@/components/ui/toast";

import { sincronizeazaConcediile } from "./actions";

/** Ce spune o sincronizare încheiată — același text pe ambele ecrane. */
export function textSincronizare(
  r: Readonly<{ create: number; actualizate: number; inlocuite: number; pastrate: number }>,
): string {
  const bucati = [
    `${String(r.create)} zile noi`,
    `${String(r.actualizate)} actualizate`,
    `${String(r.inlocuite)} zile pontate trecute pe concediu`,
  ];
  if (r.pastrate > 0) bucati.push(`${String(r.pastrate)} păstrate neschimbate`);
  return `${bucati.join(", ")}.`;
}

export function ButonSincronizareConcedii({
  an,
  luna,
}: Readonly<{ an: number; luna: number }>): ReactElement {
  const router = useRouter();
  const [inCurs, porneste] = useTransition();

  function sincronizeaza(): void {
    porneste(async () => {
      const rezultat = await sincronizeazaConcediile({ an, luna });
      if (!rezultat.ok) {
        arataToast({ fel: "eroare", text: rezultat.error.message });
        return;
      }
      arataToast({ fel: "reusita", text: textSincronizare(rezultat.data) });
      router.refresh();
    });
  }

  return (
    <Buton
      varianta="secundar"
      onClick={sincronizeaza}
      inCurs={inCurs}
      textInCurs="Se sincronizează…"
    >
      <RefreshCw aria-hidden="true" className="size-4" />
      Sincronizează concediile aprobate
    </Buton>
  );
}
