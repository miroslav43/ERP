"use client";

import { useId, useState, useTransition, type ReactElement } from "react";
import { useRouter } from "next/navigation";
import { Copy } from "lucide-react";

import { Buton } from "@/components/ui/buton";
import { arataToast } from "@/components/ui/toast";

import { marcheazaDuplicat } from "../actions";

/**
 * „Marchează ca duplicat al…” — punctul de intrare care lipsea acțiunii.
 *
 * `marcheazaDuplicat` exista fără niciun apelant în interfață, deci
 * `parent_ticket_id` nu se putea scrie de nicăieri, iar rândul „Duplicat al”
 * de pe fișă n-avea ce arăta (analiza 2026-10-08, ticketing-L16/P13).
 * Candidații vin de pe server — tichetele deschise de același tip, care nu
 * sunt ele însele duplicate — ca omul să aleagă, nu să lipească un id.
 */
export function MarcheazaDuplicat({
  ticketId,
  candidati,
}: Readonly<{
  ticketId: string;
  candidati: readonly Readonly<{ id: string; numar_afisat: string; titlu: string }>[];
}>): ReactElement | null {
  const router = useRouter();
  const idSelect = useId();
  const [parinte, setParinte] = useState("");
  const [eroare, setEroare] = useState<string | null>(null);
  const [inCurs, porneste] = useTransition();

  if (candidati.length === 0) return null;

  function marcheaza(): void {
    if (parinte.length === 0) return;
    setEroare(null);
    porneste(async () => {
      const rezultat = await marcheazaDuplicat({ ticket_id: ticketId, parent_ticket_id: parinte });
      if (!rezultat.ok) {
        setEroare(rezultat.error.message);
        return;
      }
      const ales = candidati.find((c) => c.id === parinte);
      arataToast({
        fel: "reusita",
        text: `Tichetul e marcat ca duplicat al ${ales?.numar_afisat ?? "tichetului ales"}.`,
        actiune: {
          eticheta: "Deschide originalul",
          onClick: () => {
            router.push(`/ticketing/${parinte}`);
          },
        },
      });
      router.refresh();
    });
  }

  return (
    <div className="space-y-2">
      <label htmlFor={idSelect} className="text-corp block font-medium">
        Duplicat al…
      </label>
      <div className="flex flex-wrap items-center gap-2">
        <select
          id={idSelect}
          value={parinte}
          onChange={(e) => {
            setParinte(e.target.value);
          }}
          className="border-foreground/60 rounded-control text-corp min-w-0 flex-1 border px-3 py-2"
        >
          <option value="">Alegeți tichetul original</option>
          {candidati.map((c) => (
            <option key={c.id} value={c.id}>
              {c.numar_afisat} · {c.titlu}
            </option>
          ))}
        </select>
        <Buton
          varianta="secundar"
          disabled={parinte.length === 0 || inCurs}
          onClick={marcheaza}
          inCurs={inCurs}
          textInCurs="Se marchează…"
        >
          <Copy aria-hidden="true" className="size-4" />
          Marchează ca duplicat
        </Buton>
      </div>
      <p className="text-muted-foreground text-nota">
        Solicitantul primește răspunsurile de pe original; prioritatea originalului crește cu
        fiecare duplicat.
      </p>
      <div aria-live="polite">
        {eroare === null ? null : <p className="text-danger text-corp">{eroare}</p>}
      </div>
    </div>
  );
}
