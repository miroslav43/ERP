// src/app/(platform)/super-admin/organizatii/[orgId]/_components/actiuni-organizatie.tsx
"use client";

import { useRouter } from "next/navigation";
import { useId, useState, useTransition } from "react";

import { Buton } from "@/components/ui/buton";

import type { StatusOrganizatie } from "../../../_components/insigne";
import { activeazaOrganizatie, arhiveazaOrganizatie, suspendaOrganizatie } from "../../actions";

type Motiv = "suspendare" | "arhivare";

export function ActiuniOrganizatie({
  orgId,
  status,
  membriActivi,
}: {
  orgId: string;
  status: StatusOrganizatie;
  membriActivi: number;
}) {
  const router = useRouter();
  const [inCurs, porneste] = useTransition();
  const [formularMotiv, setFormularMotiv] = useState<Motiv | null>(null);
  const [motiv, setMotiv] = useState("");
  const [mesaj, setMesaj] = useState<{ tip: "ok" | "eroare"; text: string } | null>(null);
  const idMotiv = useId();

  const ruleaza = (
    promisiune: Promise<{ ok: boolean; error?: { message: string } }>,
    textSucces: string,
  ) => {
    porneste(async () => {
      const rezultat = await promisiune;
      if (rezultat.ok) {
        setMesaj({ tip: "ok", text: textSucces });
        setFormularMotiv(null);
        setMotiv("");
        router.refresh();
      } else {
        setMesaj({
          tip: "eroare",
          text: rezultat.error?.message ?? "Acțiunea nu a putut fi finalizată.",
        });
      }
    });
  };

  return (
    <div className="w-full max-w-md space-y-3">
      <div className="flex flex-wrap justify-end gap-2">
        {(status === "pending" || status === "suspended") && (
          <Buton
            varianta="primar"
            disabled={inCurs}
            onClick={() =>
              ruleaza(
                activeazaOrganizatie({ orgId }),
                status === "suspended"
                  ? "Organizația a fost reactivată."
                  : "Organizația a fost activată.",
              )
            }
          >
            {status === "suspended" ? "Reactivează" : "Activează"}
          </Buton>
        )}
        {(status === "pending" || status === "active") && (
          <Buton
            varianta="distructiv"
            disabled={inCurs}
            onClick={() => setFormularMotiv("suspendare")}
          >
            Suspendă
          </Buton>
        )}
        {status !== "archived" && (
          <Buton varianta="secundar" disabled={inCurs} onClick={() => setFormularMotiv("arhivare")}>
            Arhivează
          </Buton>
        )}
      </div>

      {formularMotiv && (
        <form
          onSubmit={(eveniment) => {
            eveniment.preventDefault();
            if (motiv.trim().length < 10) {
              setMesaj({ tip: "eroare", text: "Descrieți motivul în cel puțin 10 caractere." });
              return;
            }
            ruleaza(
              formularMotiv === "suspendare"
                ? suspendaOrganizatie({ orgId, motiv })
                : arhiveazaOrganizatie({ orgId, motiv }),
              formularMotiv === "suspendare"
                ? "Organizația a fost suspendată."
                : "Organizația a fost arhivată.",
            );
          }}
          className="border-border bg-surface rounded-panou border p-4"
        >
          <p className="text-danger text-corp font-medium">
            {membriActivi === 1
              ? "O persoană va pierde accesul imediat, la următoarea cerere."
              : `${membriActivi} persoane vor pierde accesul imediat, la următoarea cerere.`}
          </p>
          <label htmlFor={idMotiv} className="text-foreground text-corp mt-3 block font-medium">
            Motivul {formularMotiv === "suspendare" ? "suspendării" : "arhivării"} *
          </label>
          <textarea
            id={idMotiv}
            required
            rows={3}
            value={motiv}
            onChange={(eveniment) => setMotiv(eveniment.target.value)}
            className="border-border bg-background text-foreground rounded-control text-corp mt-1 w-full border px-3 py-2"
          />
          <p className="text-muted-foreground text-nota mt-1">
            Motivul se salvează în jurnalul de audit.
          </p>
          <div className="mt-3 flex gap-2">
            <Buton type="submit" varianta="primar" inCurs={inCurs} textInCurs="Se procesează…">
              Confirmă
            </Buton>
            <Buton
              varianta="secundar"
              onClick={() => {
                setFormularMotiv(null);
                setMotiv("");
              }}
            >
              Renunță
            </Buton>
          </div>
        </form>
      )}

      <p
        aria-live="polite"
        role="status"
        className={`text-corp ${mesaj?.tip === "eroare" ? "text-danger" : "text-success"}`}
      >
        {mesaj?.text ?? ""}
      </p>
    </div>
  );
}
