"use client";

// src/app/(app)/flota/[id]/iesire/dialog-obligatie.tsx
//
// Închiderea unui termen de ieșire (0218, F12h): „Făcut la …” cu data și o notă,
// sau „Nu se aplică”. Datele le judecă baza: nu în viitor, nu înaintea ieșirii
// (la păstrarea numărului, nu înaintea achiziției). „Nu se aplică” pe radiere,
// cât timp termenele care curg din ea sunt deschise, e refuzat: o radiere din
// oficiu se marchează „Făcut” cu data ei.
import type { ReactElement } from "react";

import { Camp } from "@/components/ui/camp";
import { FormularDialog } from "@/components/ui/formular-dialog";

import { finalizeazaObligatia } from "./actions";

interface Proprietati {
  readonly fel: "facut" | "nu_se_aplica";
  readonly termenId: string;
  readonly vehiculId: string;
  readonly denumire: string;
  /** Nota de pe rând (explicația copiată la creare); se poate completa. */
  readonly nota: string | null;
  /** `min` pe dată: ziua ieșirii, sau achiziția la păstrarea numărului. */
  readonly dataMinima: string | null;
  readonly azi: string;
}

export function DialogObligatie({
  fel,
  termenId,
  vehiculId,
  denumire,
  nota,
  dataMinima,
  azi,
}: Proprietati): ReactElement {
  const facut = fel === "facut";
  return (
    <FormularDialog
      declansator={{
        eticheta: facut ? "Făcut" : "Nu se aplică",
        varianta: "tertiar",
        marime: "implicit",
      }}
      titlu={facut ? `Făcut: ${denumire}` : `Nu se aplică: ${denumire}`}
      descriere={
        facut
          ? "Termenul iese din alerte. Dacă de el depind alte termene, ele primesc data lor de la ziua aleasă aici."
          : "Termenul iese din alerte fără o dată. Folosiți-l doar când pasul chiar nu privește firma."
      }
      actiune={(date) =>
        finalizeazaObligatia({
          id: termenId,
          vehicle_id: vehiculId,
          stare: fel,
          finalizat_la: facut ? String(date.get("finalizat_la") ?? "").trim() : null,
          nota: String(date.get("nota") ?? "").trim() || null,
        })
      }
      mesajReusita={
        facut ? "Termenul a fost marcat făcut." : "Termenul a fost marcat „nu se aplică”."
      }
      etichetaTrimite={facut ? "Marchează făcut" : "Nu se aplică"}
      textInCurs="Se salvează…"
    >
      {(stare, idc) => (
        <div className="grid gap-4">
          {facut ? (
            <Camp
              nume="finalizat_la"
              id={idc("finalizat_la")}
              eticheta="Făcut la"
              obligatoriu
              erori={stare.erori["finalizat_la"] ?? []}
            >
              {(a) => (
                <input
                  {...a}
                  type="date"
                  max={azi}
                  min={dataMinima ?? undefined}
                  defaultValue={stare.valoriTrimise["finalizat_la"] ?? azi}
                />
              )}
            </Camp>
          ) : null}
          <Camp
            nume="nota"
            id={idc("nota")}
            eticheta="Notă"
            fel="textarea"
            ajutor="Explicația termenului e deja aici; completați, de exemplu, numărul de înregistrare."
            erori={stare.erori["nota"] ?? []}
          >
            {(a) => (
              <textarea
                {...a}
                maxLength={1000}
                rows={3}
                defaultValue={stare.valoriTrimise["nota"] ?? nota ?? ""}
              />
            )}
          </Camp>
        </div>
      )}
    </FormularDialog>
  );
}
