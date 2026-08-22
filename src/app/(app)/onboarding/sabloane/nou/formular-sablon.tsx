"use client";

import { useId, useState, useTransition } from "react";
import { useRouter } from "next/navigation";

import { CHECKLIST_TIP } from "@/schemas/checklist";

import { actualizeazaSablon, creeazaSablon } from "../../actions";
import { ETICHETE_TIP } from "../../etichete";

interface OptiuneDenumita {
  readonly id: string;
  readonly denumire: string;
}

interface SablonInitial {
  readonly id: string;
  readonly denumire: string;
  readonly tip: "onboarding" | "offboarding" | "transfer" | "altul";
  readonly descriere: string | null;
  readonly department_id: string | null;
  readonly job_position_id: string | null;
  readonly activ: boolean;
  readonly valabil_de_la: string;
  readonly valabil_pana_la: string | null;
}

interface Proprietati {
  readonly departamente: readonly OptiuneDenumita[];
  readonly posturi: readonly OptiuneDenumita[];
  readonly astazi: string;
  /** Prezent ⇒ formularul editează un șablon existent, în loc să creeze unul. */
  readonly initial?: SablonInitial;
}

export function FormularSablon({ departamente, posturi, astazi, initial }: Proprietati) {
  const router = useRouter();
  const [inCurs, porneste] = useTransition();
  const [eroare, setEroare] = useState<string | null>(null);

  const id = {
    denumire: useId(),
    tip: useId(),
    descriere: useId(),
    departament: useId(),
    post: useId(),
    activ: useId(),
    deLa: useId(),
    panaLa: useId(),
  };

  function trimite(formular: FormData): void {
    setEroare(null);
    const text = (cheie: string) => {
      const v = String(formular.get(cheie) ?? "").trim();
      return v.length === 0 ? null : v;
    };

    porneste(async () => {
      const campuri = {
        denumire: String(formular.get("denumire") ?? "").trim(),
        tip: String(formular.get("tip") ?? "onboarding"),
        descriere: text("descriere"),
        department_id: text("department_id"),
        job_position_id: text("job_position_id"),
        activ: formular.get("activ") === "on",
        valabil_de_la: String(formular.get("valabil_de_la") ?? ""),
        valabil_pana_la: text("valabil_pana_la"),
      };

      const rezultat =
        initial === undefined
          ? await creeazaSablon(campuri)
          : await actualizeazaSablon({ ...campuri, id: initial.id });

      if (!rezultat.ok) {
        setEroare(rezultat.error.message);
        return;
      }
      router.push(`/onboarding/sabloane/${rezultat.data.id}`);
      router.refresh();
    });
  }

  return (
    <form action={trimite} className="space-y-4">
      <div className="grid gap-4 sm:grid-cols-2">
        <div className="flex flex-col gap-1 sm:col-span-2">
          <label htmlFor={id.denumire} className="text-sm font-medium">
            Denumire
          </label>
          <input
            id={id.denumire}
            name="denumire"
            required
            minLength={2}
            maxLength={160}
            defaultValue={initial?.denumire}
            className="border-foreground/60 rounded-md border px-3 py-2 text-sm"
          />
        </div>

        <div className="flex flex-col gap-1">
          <label htmlFor={id.tip} className="text-sm font-medium">
            Tip
          </label>
          <select
            id={id.tip}
            name="tip"
            defaultValue={initial?.tip ?? "onboarding"}
            className="border-foreground/60 rounded-md border px-3 py-2 text-sm"
          >
            {CHECKLIST_TIP.map((t) => (
              <option key={t} value={t}>
                {ETICHETE_TIP[t]}
              </option>
            ))}
          </select>
        </div>

        <div className="flex items-end gap-2 pb-2">
          <input
            id={id.activ}
            name="activ"
            type="checkbox"
            defaultChecked={initial?.activ ?? true}
            className="border-foreground/60 size-4 rounded"
          />
          <label htmlFor={id.activ} className="text-sm font-medium">
            Activ
          </label>
        </div>

        {departamente.length === 0 ? null : (
          <div className="flex flex-col gap-1">
            <label htmlFor={id.departament} className="text-sm font-medium">
              Restrâns la departament
            </label>
            <select
              id={id.departament}
              name="department_id"
              defaultValue={initial?.department_id ?? ""}
              className="border-foreground/60 rounded-md border px-3 py-2 text-sm"
            >
              <option value="">Toate departamentele</option>
              {departamente.map((d) => (
                <option key={d.id} value={d.id}>
                  {d.denumire}
                </option>
              ))}
            </select>
          </div>
        )}

        {posturi.length === 0 ? null : (
          <div className="flex flex-col gap-1">
            <label htmlFor={id.post} className="text-sm font-medium">
              Restrâns la post
            </label>
            <select
              id={id.post}
              name="job_position_id"
              defaultValue={initial?.job_position_id ?? ""}
              className="border-foreground/60 rounded-md border px-3 py-2 text-sm"
            >
              <option value="">Toate posturile</option>
              {posturi.map((p) => (
                <option key={p.id} value={p.id}>
                  {p.denumire}
                </option>
              ))}
            </select>
          </div>
        )}

        <div className="flex flex-col gap-1">
          <label htmlFor={id.deLa} className="text-sm font-medium">
            Valabil de la
          </label>
          <input
            id={id.deLa}
            name="valabil_de_la"
            type="date"
            required
            defaultValue={initial?.valabil_de_la ?? astazi}
            className="border-foreground/60 rounded-md border px-3 py-2 text-sm"
          />
        </div>

        <div className="flex flex-col gap-1">
          <label htmlFor={id.panaLa} className="text-sm font-medium">
            Valabil până la
          </label>
          <input
            id={id.panaLa}
            name="valabil_pana_la"
            type="date"
            defaultValue={initial?.valabil_pana_la ?? ""}
            className="border-foreground/60 rounded-md border px-3 py-2 text-sm"
          />
        </div>

        <div className="flex flex-col gap-1 sm:col-span-2">
          <label htmlFor={id.descriere} className="text-sm font-medium">
            Descriere
          </label>
          <textarea
            id={id.descriere}
            name="descriere"
            rows={3}
            maxLength={2000}
            defaultValue={initial?.descriere ?? ""}
            className="border-foreground/60 rounded-md border px-3 py-2 text-sm"
          />
        </div>
      </div>

      <div className="flex flex-wrap items-center gap-3">
        <button
          type="submit"
          disabled={inCurs}
          className="bg-primary text-primary-foreground hover:bg-primary-hover disabled:border-border disabled:bg-surface disabled:text-muted-foreground rounded-md px-4 py-2 text-sm font-medium disabled:cursor-not-allowed"
        >
          {inCurs
            ? "Se salvează…"
            : initial === undefined
              ? "Creează șablonul"
              : "Salvează modificările"}
        </button>
        {eroare === null ? null : (
          <p role="alert" className="text-danger text-sm">
            {eroare}
          </p>
        )}
      </div>
    </form>
  );
}
