"use client";

import { useCallback } from "react";
import { useRouter } from "next/navigation";

import { Buton } from "@/components/ui/buton";
import { Camp } from "@/components/ui/camp";
import { Formular } from "@/components/ui/formular";
import { REZULTATE_VERIFICARE_STINGATOR, TIPURI_VERIFICARE_STINGATOR } from "@/schemas/ssm";

import { inregistreazaVerificareStingator } from "../../actions";
import { ETICHETE_REZULTAT_VERIFICARE, ETICHETE_TIP_VERIFICARE_STINGATOR } from "../../etichete";

/**
 * Se inserează DOAR în `fire_extinguisher_checks`. Triggerul AFTER
 * `internal.ssm_check_apply` actualizează singur `ultima_*` pe stingător (și,
 * prin triggerul lui BEFORE, scadențele) — formularul nu face al doilea UPDATE.
 *
 * ── CE S-A REPARAT ────────────────────────────────────────────────────────
 * Formularul stă sub fișa stingătorului și se completează la fiecare
 * verificare. Vechea variantă strângea toate mesajele lui
 * `verificareStingatorSchema` într-un singur `<p>` roșu sub buton, iar după
 * refuz React 19 golea cele șapte câmpuri. `<Formular>` întoarce
 * `valoriTrimise`, `<Camp>` duce mesajul lângă câmpul lui.
 *
 * ── CONTRACTUL DE NUME ────────────────────────────────────────────────────
 * `nume` din fiecare `<Camp>` e cheia din `verificareStingatorSchema`, literă
 * cu literă — inclusiv `data`, care e chiar așa numită în schemă, și
 * `tip_verificare`, nu `tip`. `extinguisher_id` NU e câmp de formular: vine din
 * proprietatea `extinguisherId`, adăugată peste valori înainte de apel.
 */
export function FormularVerificare({ extinguisherId }: { readonly extinguisherId: string }) {
  const router = useRouter();

  async function trimite(formular: FormData) {
    const text = (cheie: string) => {
      const v = String(formular.get(cheie) ?? "").trim();
      return v.length === 0 ? null : v;
    };
    const cost = text("cost");

    return await inregistreazaVerificareStingator({
      extinguisher_id: extinguisherId,
      tip_verificare: String(formular.get("tip_verificare") ?? ""),
      data: String(formular.get("data") ?? ""),
      executant: text("executant"),
      firma_autorizata: text("firma_autorizata"),
      rezultat: String(formular.get("rezultat") ?? "conform"),
      cost: cost === null ? null : Number(cost),
      observatii: text("observatii"),
    });
  }

  // Stabil între randări: `laReusita` intră în lista de dependențe a efectului
  // din `<Formular>`, iar o funcție nouă la fiecare randare ar relua efectul —
  // adică încă o notificare de reușită la fiecare re-randare.
  const laReusita = useCallback(() => {
    router.refresh();
  }, [router]);

  return (
    <Formular
      actiune={trimite}
      laReusita={laReusita}
      mesajReusita="Verificarea a fost înregistrată."
      className="border-border rounded-panou border p-4"
    >
      {(stare) => {
        // Formularul rămâne pe ecran după salvare, deci trebuie să repornească
        // gol: `valoriTrimise` se păstrează DOAR cât timp ultimul răspuns a
        // fost un refuz.
        const trimise: Readonly<Record<string, string>> =
          stare.data === null ? stare.valoriTrimise : {};

        return (
          <>
            <p className="text-corp font-medium">Înregistrează o verificare</p>

            <div className="grid gap-3 sm:grid-cols-2">
              <Camp
                nume="tip_verificare"
                eticheta="Tip"
                fel="select"
                obligatoriu
                erori={stare.erori["tip_verificare"] ?? []}
              >
                {(a) => (
                  <select {...a} defaultValue={trimise["tip_verificare"] ?? ""}>
                    {TIPURI_VERIFICARE_STINGATOR.map((t) => (
                      <option key={t} value={t}>
                        {ETICHETE_TIP_VERIFICARE_STINGATOR[t]}
                      </option>
                    ))}
                  </select>
                )}
              </Camp>

              <Camp nume="data" eticheta="Data" obligatoriu erori={stare.erori["data"] ?? []}>
                {(a) => <input {...a} type="date" defaultValue={trimise["data"] ?? ""} />}
              </Camp>

              <Camp
                nume="firma_autorizata"
                eticheta="Firmă autorizată"
                erori={stare.erori["firma_autorizata"] ?? []}
              >
                {(a) => (
                  <input {...a} maxLength={160} defaultValue={trimise["firma_autorizata"] ?? ""} />
                )}
              </Camp>

              <Camp nume="executant" eticheta="Executant" erori={stare.erori["executant"] ?? []}>
                {(a) => <input {...a} maxLength={120} defaultValue={trimise["executant"] ?? ""} />}
              </Camp>

              <Camp
                nume="rezultat"
                eticheta="Rezultat"
                fel="select"
                erori={stare.erori["rezultat"] ?? []}
              >
                {(a) => (
                  <select {...a} defaultValue={trimise["rezultat"] ?? "conform"}>
                    {REZULTATE_VERIFICARE_STINGATOR.map((r) => (
                      <option key={r} value={r}>
                        {ETICHETE_REZULTAT_VERIFICARE[r]}
                      </option>
                    ))}
                  </select>
                )}
              </Camp>

              <Camp nume="cost" eticheta="Cost (lei)" erori={stare.erori["cost"] ?? []}>
                {(a) => (
                  <input
                    {...a}
                    type="number"
                    min="0"
                    step="0.01"
                    defaultValue={trimise["cost"] ?? ""}
                  />
                )}
              </Camp>

              <Camp
                nume="observatii"
                eticheta="Observații"
                className="sm:col-span-2"
                erori={stare.erori["observatii"] ?? []}
              >
                {(a) => (
                  <input {...a} maxLength={1000} defaultValue={trimise["observatii"] ?? ""} />
                )}
              </Camp>
            </div>

            <div className="flex flex-wrap items-center gap-3">
              <Buton
                type="submit"
                varianta="primar"
                inCurs={stare.inCurs}
                textInCurs="Se salvează…"
              >
                Înregistrează verificarea
              </Buton>
            </div>
          </>
        );
      }}
    </Formular>
  );
}
