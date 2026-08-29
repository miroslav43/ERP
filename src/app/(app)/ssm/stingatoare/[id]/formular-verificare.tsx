"use client";

import { Plus } from "lucide-react";

import { Camp } from "@/components/ui/camp";
import { FormularDialog } from "@/components/ui/formular-dialog";
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

  return (
    <FormularDialog
      declansator={{
        eticheta: "Înregistrează o verificare",
        varianta: "secundar",
        pictograma: <Plus aria-hidden="true" className="size-4" />,
      }}
      titlu="Verificare de stingător"
      descriere="Scadențele stingătorului se recalculează singure din data și tipul verificării — nu se scriu de mână nicăieri."
      marime="mare"
      actiune={trimite}
      mesajReusita="Verificarea a fost înregistrată."
      etichetaTrimite="Înregistrează verificarea"
      textInCurs="Se salvează…"
    >
      {(stare) => {
        // Formularul rămâne pe ecran după salvare, deci trebuie să repornească
        // gol: `valoriTrimise` se păstrează DOAR cât timp ultimul răspuns a
        // fost un refuz.
        const trimise: Readonly<Record<string, string>> =
          stare.data === null ? stare.valoriTrimise : {};

        return (
          <>
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
          </>
        );
      }}
    </FormularDialog>
  );
}
