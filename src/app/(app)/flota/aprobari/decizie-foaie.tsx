"use client";

import { useCallback, useId, useState, useTransition } from "react";
import { useRouter } from "next/navigation";

import { Buton } from "@/components/ui/buton";
import { Camp } from "@/components/ui/camp";
import { Formular } from "@/components/ui/formular";
import type { ActionResult } from "@/lib/actions/types";

import { decideFoaie } from "../actions";

type FoaieDecisa = Readonly<{ id: string }>;

/**
 * Refuz construit în client, în forma exactă a unui `ActionResult`, ca mesajul
 * să meargă pe aceeași cale ca al serverului și să ajungă lângă câmp.
 */
function refuzDeClient(
  fieldErrors: Readonly<Record<string, readonly string[]>>,
): ActionResult<never> {
  return {
    ok: false,
    error: {
      code: "VALIDARE",
      message: "Datele introduse nu sunt valide.",
      fieldErrors,
      requestId: "client",
    },
  };
}

/**
 * Aprobarea sau respingerea unei foi.
 *
 * Respingerea cere motiv — validat și în acțiune, și aici, ca omul să afle
 * înainte de round-trip. Autoaprobarea NU se blochează în client: e refuzată de
 * un trigger, iar mesajul lui ajunge la utilizator prin `traduEroare`. Regula
 * trăiește într-un singur loc, cel care nu poate fi ocolit.
 *
 * Formularul motivului e un `<Formular>`, nu un `<form action>` brut: React 19
 * resetează formularul după orice acțiune, iar un motiv de trei rânduri scris
 * pentru șofer dispărea la primul refuz (aceeași clasă de defect ca ADM-022).
 * Aprobarea rămâne un buton pe `useTransition` — n-are câmpuri de pierdut.
 */
export function DecizieFoaie({ id }: { readonly id: string }) {
  const router = useRouter();
  const [inCurs, porneste] = useTransition();
  const [eroare, setEroare] = useState<string | null>(null);
  const [cereMotiv, setCereMotiv] = useState(false);
  const idMotiv = useId();

  function aproba(): void {
    setEroare(null);
    porneste(async () => {
      const rezultat = await decideFoaie({ id, decizie: "aprobat", motiv_respingere: null });
      if (!rezultat.ok) {
        setEroare(rezultat.error.message);
        return;
      }
      router.refresh();
    });
  }

  async function respinge(formular: FormData): Promise<ActionResult<FoaieDecisa>> {
    const motiv = String(formular.get("motiv") ?? "").trim();
    if (motiv.length === 0) {
      return refuzDeClient({
        motiv: ["Scrieți motivul: șoferul trebuie să știe ce anume să corecteze."],
      });
    }
    return await decideFoaie({ id, decizie: "respins", motiv_respingere: motiv });
  }

  // Stabil între randări: intră în dependențele efectului din `<Formular>`.
  const laRespingere = useCallback(() => {
    setCereMotiv(false);
    router.refresh();
  }, [router]);

  if (cereMotiv) {
    return (
      <Formular actiune={respinge} laReusita={laRespingere} className="w-full gap-2 sm:w-80">
        {(stare) => {
          const trimise: Readonly<Record<string, string>> =
            stare.data === null ? stare.valoriTrimise : {};
          return (
            <>
              <Camp
                nume="motiv"
                // Mai multe foi pe aceeași pagină, fiecare cu formularul ei:
                // identificatorul derivat din `nume` s-ar repeta.
                id={idMotiv}
                eticheta="Motivul respingerii"
                fel="textarea"
                obligatoriu
                erori={stare.erori["motiv"] ?? []}
              >
                {(a) => (
                  <textarea {...a} rows={2} maxLength={500} defaultValue={trimise["motiv"] ?? ""} />
                )}
              </Camp>
              <div className="flex gap-2">
                <Buton
                  type="submit"
                  varianta="distructiv"
                  inCurs={stare.inCurs}
                  textInCurs="Se trimite…"
                >
                  Respinge
                </Buton>
                <Buton
                  type="button"
                  varianta="secundar"
                  onClick={() => {
                    setCereMotiv(false);
                    setEroare(null);
                  }}
                >
                  Renunță
                </Buton>
              </div>
            </>
          );
        }}
      </Formular>
    );
  }

  return (
    <div className="space-y-2">
      <div className="flex gap-2">
        <Buton
          type="button"
          varianta="primar"
          inCurs={inCurs}
          textInCurs="Se trimite…"
          onClick={aproba}
        >
          Aprobă
        </Buton>
        <Buton
          type="button"
          varianta="secundar"
          disabled={inCurs}
          onClick={() => {
            setCereMotiv(true);
          }}
        >
          Respinge
        </Buton>
      </div>
      {eroare === null ? null : (
        <p role="alert" className="text-danger text-nota max-w-sm">
          {eroare}
        </p>
      )}
    </div>
  );
}
