// src/app/(platform)/super-admin/organizatii/[orgId]/_components/actiuni-organizatie.tsx
"use client";

import { useRouter } from "next/navigation";
import { useId, useState, useTransition } from "react";

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

  const claseButon =
    "rounded-md border border-border px-3 py-2 text-sm font-medium hover:bg-surface disabled:cursor-not-allowed disabled:border-border disabled:bg-surface disabled:text-muted-foreground   ";

  return (
    <div className="w-full max-w-md space-y-3">
      <div className="flex flex-wrap justify-end gap-2">
        {(status === "pending" || status === "suspended") && (
          <button
            type="button"
            disabled={inCurs}
            onClick={() =>
              ruleaza(
                activeazaOrganizatie({ orgId }),
                status === "suspended"
                  ? "Organizația a fost reactivată."
                  : "Organizația a fost activată.",
              )
            }
            className="bg-primary text-primary-foreground hover:bg-primary-hover disabled:border-border disabled:bg-surface disabled:text-muted-foreground rounded-md px-3 py-2 text-sm font-medium disabled:cursor-not-allowed"
          >
            {status === "suspended" ? "Reactivează" : "Activează"}
          </button>
        )}
        {(status === "pending" || status === "active") && (
          <button
            type="button"
            disabled={inCurs}
            onClick={() => setFormularMotiv("suspendare")}
            className={`${claseButon} text-danger`}
          >
            Suspendă
          </button>
        )}
        {status !== "archived" && (
          <button
            type="button"
            disabled={inCurs}
            onClick={() => setFormularMotiv("arhivare")}
            className={claseButon}
          >
            Arhivează
          </button>
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
          className="border-border bg-surface rounded-lg border p-4"
        >
          <p className="text-danger text-sm font-medium">
            {membriActivi === 1
              ? "O persoană va pierde accesul imediat, la următoarea cerere."
              : `${membriActivi} persoane vor pierde accesul imediat, la următoarea cerere.`}
          </p>
          <label htmlFor={idMotiv} className="text-foreground mt-3 block text-sm font-medium">
            Motivul {formularMotiv === "suspendare" ? "suspendării" : "arhivării"} *
          </label>
          <textarea
            id={idMotiv}
            required
            rows={3}
            value={motiv}
            onChange={(eveniment) => setMotiv(eveniment.target.value)}
            className="border-border bg-background text-foreground mt-1 w-full rounded-md border px-3 py-2 text-sm"
          />
          <p className="text-muted-foreground mt-1 text-xs">
            Motivul se salvează în jurnalul de audit.
          </p>
          <div className="mt-3 flex gap-2">
            <button
              type="submit"
              disabled={inCurs}
              className="bg-primary text-primary-foreground hover:bg-primary-hover disabled:border-border disabled:bg-surface disabled:text-muted-foreground rounded-md px-3 py-2 text-sm font-medium disabled:cursor-not-allowed"
            >
              {inCurs ? "Se procesează…" : "Confirmă"}
            </button>
            <button
              type="button"
              onClick={() => {
                setFormularMotiv(null);
                setMotiv("");
              }}
              className={claseButon}
            >
              Renunță
            </button>
          </div>
        </form>
      )}

      <p
        aria-live="polite"
        role="status"
        className={`text-sm ${mesaj?.tip === "eroare" ? "text-danger" : "text-success"}`}
      >
        {mesaj?.text ?? ""}
      </p>
    </div>
  );
}
