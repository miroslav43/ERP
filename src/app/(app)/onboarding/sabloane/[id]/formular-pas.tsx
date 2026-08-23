"use client";

import { useId, useState, useTransition } from "react";
import { useRouter } from "next/navigation";

import { Buton } from "@/components/ui/buton";
import {
  CHECKLIST_RESPONSABIL_TIP,
  CHECKLIST_TIP_DOVADA,
  CHECKLIST_VERIFICARE,
  ROLURI_RESPONSABIL,
} from "@/schemas/checklist";

import { actualizeazaPas, adaugaPas } from "../../actions";
import { ETICHETE_RESPONSABIL_TIP, ETICHETE_ROL, ETICHETE_TIP_DOVADA } from "../../etichete";

interface PasInitial {
  readonly id: string;
  readonly titlu: string;
  readonly descriere: string | null;
  readonly responsabil_tip: "rol" | "angajat" | "manager_direct";
  readonly responsabil_rol: "super_admin" | "org_admin" | "manager" | "hr" | "employee" | null;
  readonly responsabil_employee_id: string | null;
  readonly termen_zile_relativ: number;
  readonly obligatoriu: boolean;
  readonly tip_dovada: "niciuna" | "bifa" | "document" | "semnatura";
  readonly verificare_automata: "inventar_returnat" | "acces_revocat" | "documente_semnate" | null;
}

interface Proprietati {
  readonly templateId: string;
  /** Prezent ⇒ formularul editează un pas existent, în loc să adauge unul. */
  readonly initial?: PasInitial;
  readonly onGata?: () => void;
}

export function FormularPas({ templateId, initial, onGata }: Proprietati) {
  const router = useRouter();
  const [inCurs, porneste] = useTransition();
  const [eroare, setEroare] = useState<string | null>(null);
  const [responsabilTip, setResponsabilTip] = useState(initial?.responsabil_tip ?? "rol");

  const id = {
    titlu: useId(),
    descriere: useId(),
    responsabilTip: useId(),
    responsabilRol: useId(),
    responsabilAngajat: useId(),
    termen: useId(),
    obligatoriu: useId(),
    tipDovada: useId(),
    verificare: useId(),
  };

  function trimite(formular: FormData): void {
    setEroare(null);
    const text = (cheie: string) => {
      const v = String(formular.get(cheie) ?? "").trim();
      return v.length === 0 ? null : v;
    };

    porneste(async () => {
      const campuri = {
        titlu: String(formular.get("titlu") ?? "").trim(),
        descriere: text("descriere"),
        responsabil_tip: String(formular.get("responsabil_tip") ?? "rol"),
        responsabil_rol: responsabilTip === "rol" ? text("responsabil_rol") : null,
        responsabil_employee_id:
          responsabilTip === "angajat" ? text("responsabil_employee_id") : null,
        termen_zile_relativ: Number(formular.get("termen_zile_relativ") ?? 0),
        obligatoriu: formular.get("obligatoriu") === "on",
        tip_dovada: String(formular.get("tip_dovada") ?? "bifa"),
        verificare_automata: text("verificare_automata"),
      };

      const rezultat =
        initial === undefined
          ? await adaugaPas({ ...campuri, template_id: templateId })
          : await actualizeazaPas({ ...campuri, id: initial.id });

      if (!rezultat.ok) {
        setEroare(rezultat.error.message);
        return;
      }
      router.refresh();
      onGata?.();
    });
  }

  return (
    <form action={trimite} className="border-border rounded-panou space-y-3 border p-4">
      <div className="grid gap-3 sm:grid-cols-2">
        <div className="flex flex-col gap-1 sm:col-span-2">
          <label htmlFor={id.titlu} className="text-corp font-medium">
            Titlu
          </label>
          <input
            id={id.titlu}
            name="titlu"
            required
            minLength={2}
            maxLength={200}
            defaultValue={initial?.titlu}
            className="border-foreground/60 rounded-control text-corp border px-3 py-2"
          />
        </div>

        <div className="flex flex-col gap-1 sm:col-span-2">
          <label htmlFor={id.descriere} className="text-corp font-medium">
            Descriere
          </label>
          <textarea
            id={id.descriere}
            name="descriere"
            rows={2}
            maxLength={2000}
            defaultValue={initial?.descriere ?? ""}
            className="border-foreground/60 rounded-control text-corp border px-3 py-2"
          />
        </div>

        <div className="flex flex-col gap-1">
          <label htmlFor={id.responsabilTip} className="text-corp font-medium">
            Responsabil
          </label>
          <select
            id={id.responsabilTip}
            name="responsabil_tip"
            value={responsabilTip}
            onChange={(e) => {
              setResponsabilTip(e.target.value as typeof responsabilTip);
            }}
            className="border-foreground/60 rounded-control text-corp border px-3 py-2"
          >
            {CHECKLIST_RESPONSABIL_TIP.map((r) => (
              <option key={r} value={r}>
                {ETICHETE_RESPONSABIL_TIP[r]}
              </option>
            ))}
          </select>
        </div>

        {responsabilTip === "rol" ? (
          <div className="flex flex-col gap-1">
            <label htmlFor={id.responsabilRol} className="text-corp font-medium">
              Rol
            </label>
            <select
              id={id.responsabilRol}
              name="responsabil_rol"
              defaultValue={initial?.responsabil_rol ?? ""}
              className="border-foreground/60 rounded-control text-corp border px-3 py-2"
            >
              <option value="">Alegeți rolul</option>
              {ROLURI_RESPONSABIL.map((r) => (
                <option key={r} value={r}>
                  {ETICHETE_ROL[r]}
                </option>
              ))}
            </select>
          </div>
        ) : null}

        {responsabilTip === "angajat" ? (
          <div className="flex flex-col gap-1">
            <label htmlFor={id.responsabilAngajat} className="text-corp font-medium">
              Id-ul angajatului
            </label>
            <input
              id={id.responsabilAngajat}
              name="responsabil_employee_id"
              defaultValue={initial?.responsabil_employee_id ?? ""}
              placeholder="id-ul angajatului"
              className="border-foreground/60 rounded-control text-corp border px-3 py-2"
            />
          </div>
        ) : null}

        <div className="flex flex-col gap-1">
          <label htmlFor={id.termen} className="text-corp font-medium">
            Termen (zile față de data de referință)
          </label>
          <input
            id={id.termen}
            name="termen_zile_relativ"
            type="number"
            min={-365}
            max={365}
            defaultValue={initial?.termen_zile_relativ ?? 0}
            className="border-foreground/60 rounded-control text-corp border px-3 py-2"
          />
        </div>

        <div className="flex items-end gap-2 pb-2">
          <input
            id={id.obligatoriu}
            name="obligatoriu"
            type="checkbox"
            defaultChecked={initial?.obligatoriu ?? true}
            className="border-foreground/60 size-4 rounded"
          />
          <label htmlFor={id.obligatoriu} className="text-corp font-medium">
            Obligatoriu
          </label>
        </div>

        <div className="flex flex-col gap-1">
          <label htmlFor={id.tipDovada} className="text-corp font-medium">
            Dovadă cerută
          </label>
          <select
            id={id.tipDovada}
            name="tip_dovada"
            defaultValue={initial?.tip_dovada ?? "bifa"}
            className="border-foreground/60 rounded-control text-corp border px-3 py-2"
          >
            {CHECKLIST_TIP_DOVADA.map((t) => (
              <option key={t} value={t}>
                {ETICHETE_TIP_DOVADA[t]}
              </option>
            ))}
          </select>
        </div>

        <div className="flex flex-col gap-1">
          <label htmlFor={id.verificare} className="text-corp font-medium">
            Verificare automată
          </label>
          <select
            id={id.verificare}
            name="verificare_automata"
            defaultValue={initial?.verificare_automata ?? ""}
            aria-describedby={`${id.verificare}-ajutor`}
            className="border-foreground/60 rounded-control text-corp border px-3 py-2"
          >
            <option value="">Fără</option>
            {CHECKLIST_VERIFICARE.map((v) => (
              <option key={v} value={v}>
                {v}
              </option>
            ))}
          </select>
          <p id={`${id.verificare}-ajutor`} className="text-muted-foreground text-nota">
            Cere pasul obligatoriu și cu dovadă de tip „bifă”; se bifează singur, de sistem.
          </p>
        </div>
      </div>

      <div className="flex flex-wrap items-center gap-3">
        <Buton type="submit" varianta="primar" inCurs={inCurs} textInCurs="Se salvează…">
          {initial === undefined ? "Adaugă pasul" : "Salvează pasul"}
        </Buton>
        {onGata === undefined ? null : (
          <Buton varianta="secundar" onClick={onGata}>
            Renunță
          </Buton>
        )}
        {eroare === null ? null : (
          <p role="alert" className="text-danger text-corp">
            {eroare}
          </p>
        )}
      </div>
    </form>
  );
}
