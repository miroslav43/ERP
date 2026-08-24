// src/app/(platform)/super-admin/organizatii/_components/filtre-organizatii.tsx
"use client";

import { useRouter } from "next/navigation";
import { useId, useState, useTransition } from "react";
import { Search } from "lucide-react";

import { Buton } from "@/components/ui/buton";
import { STATUSURI_ORGANIZATIE } from "@/schemas/organization";

const ETICHETE: Record<(typeof STATUSURI_ORGANIZATIE)[number], string> = {
  pending: "În așteptare",
  active: "Active",
  suspended: "Suspendate",
  archived: "Arhivate",
};

export function FiltreOrganizatii({
  cautareInitiala,
  statusInitial,
}: {
  cautareInitiala: string;
  statusInitial: string;
}) {
  const router = useRouter();
  const [inCurs, porneste] = useTransition();
  const [cautare, setCautare] = useState(cautareInitiala);
  const [status, setStatus] = useState(statusInitial);
  const idCautare = useId();
  const idStatus = useId();

  const navigheaza = (valoriCautare: string, valoareStatus: string) => {
    const parametri = new URLSearchParams();
    if (valoriCautare.trim()) parametri.set("cautare", valoriCautare.trim());
    if (valoareStatus) parametri.set("status", valoareStatus);
    porneste(() =>
      router.push(
        `/super-admin/organizatii${parametri.size > 0 ? `?${parametri.toString()}` : ""}`,
      ),
    );
  };

  return (
    <form
      role="search"
      onSubmit={(eveniment) => {
        eveniment.preventDefault();
        navigheaza(cautare, status);
      }}
      className="border-border bg-surface rounded-panou flex flex-wrap items-end gap-3 border p-4"
    >
      <div className="min-w-56 flex-1">
        <label htmlFor={idCautare} className="text-foreground text-corp block font-medium">
          Caută după denumire sau CUI
        </label>
        <input
          id={idCautare}
          type="search"
          value={cautare}
          onChange={(eveniment) => setCautare(eveniment.target.value)}
          placeholder="ex. Firma Mea sau RO 14399840"
          className="border-border bg-background text-foreground rounded-control text-corp mt-1 w-full border px-3 py-2"
        />
      </div>

      <div>
        <label htmlFor={idStatus} className="text-foreground text-corp block font-medium">
          Status
        </label>
        <select
          id={idStatus}
          value={status}
          onChange={(eveniment) => {
            setStatus(eveniment.target.value);
            navigheaza(cautare, eveniment.target.value);
          }}
          className="border-border bg-background text-foreground rounded-control text-corp mt-1 border px-3 py-2"
        >
          <option value="">Toate</option>
          {STATUSURI_ORGANIZATIE.map((valoare) => (
            <option key={valoare} value={valoare}>
              {ETICHETE[valoare]}
            </option>
          ))}
        </select>
      </div>

      <Buton type="submit" varianta="primar">
        <Search aria-hidden="true" className="size-4" />
        Caută
      </Buton>

      <p aria-live="polite" className="sr-only">
        {inCurs ? "Se aplică filtrele…" : ""}
      </p>
    </form>
  );
}
