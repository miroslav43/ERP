"use client";

import { Plus } from "lucide-react";
import { useCallback } from "react";

import { Camp, clasaBifa } from "@/components/ui/camp";
import { FormularDialog } from "@/components/ui/formular-dialog";
import { arataToast } from "@/components/ui/toast";
import { TIPURI_CONTOR } from "@/schemas/maintenance";
import { ETICHETE_TIP_CONTOR } from "../../etichete";
import { inregistreazaContor } from "../../actions";

interface Optiune {
  readonly id: string;
  readonly nume: string;
}

/**
 * Citirea de contor, pe `<Formular>` + `<Camp>`.
 *
 * ── CE S-A REPARAT ────────────────────────────────────────────────────────
 * Cu `<form action={trimite}>` și câmpuri necontrolate, React 19 resetează
 * formularul după ce acțiunea se încheie. Aici pierderea era concretă: garda
 * `ssm_meter_guard` respinge o citire în regres, iar omul rămânea cu formularul
 * gol și cu un mesaj sub buton, deci retasta data și valoarea ca să o corecteze.
 * `<Formular>` întoarce valorile prin `valoriTrimise`.
 *
 * `fieldErrors` de la `contorNouSchema` erau aruncate — se afișa doar
 * `error.message`. Acum mesajul stă lângă câmpul lui.
 *
 * `avertismentSalt` nu mai are stare proprie: succesul poartă datele acțiunii
 * în `stare.data`, deci avertismentul se citește de acolo.
 *
 * ── DE CE `id` EXPLICIT ───────────────────────────────────────────────────
 * Fișa echipamentului randează cinci formulare simultan; `tip` apare în patru
 * dintre ele, `observatii` în două. `Camp` derivă identificatorul din `nume`,
 * deci fiecare formular îl prefixează cu un `useId()` propriu.
 */
export function FormularContor({
  equipmentId,
  angajati,
}: {
  readonly equipmentId: string;
  readonly angajati: readonly Optiune[];
}) {
  const trimite = useCallback(
    async (formular: FormData) => {
      const gol = (cheie: string): string | null => {
        const v = String(formular.get(cheie) ?? "").trim();
        return v.length === 0 ? null : v;
      };

      return await inregistreazaContor({
        equipment_id: equipmentId,
        tip: String(formular.get("tip") ?? ""),
        citire: Number(formular.get("citire") ?? "0"),
        data_citirii: String(formular.get("data_citirii") ?? ""),
        resetare_contor: formular.get("resetare_contor") === "on",
        sursa: gol("sursa") ?? "manual",
        citit_de_employee_id: gol("citit_de_employee_id"),
        observatii: gol("observatii"),
      });
    },
    [equipmentId],
  );

  /**
   * Avertismentul de salt trece prin notificare, fiindcă acum caseta se închide.
   *
   * `inregistreazaContor` întoarce `avertismentSalt` când citirea a sărit
   * neverosimil față de precedenta — garda `ssm_meter_guard` respinge regresul,
   * dar un salt înainte trece și e doar semnalat. Înainte, propoziția rămânea
   * sub formularul deschis; într-o casetă care se închide la reușită, ar fi
   * dispărut fără s-o vadă nimeni.
   */
  const laReusita = useCallback((date: { avertismentSalt: string | null }): void => {
    if (date.avertismentSalt !== null) {
      arataToast({ fel: "informativ", text: date.avertismentSalt });
    }
  }, []);

  return (
    <FormularDialog
      declansator={{
        eticheta: "Înregistrează o citire",
        varianta: "secundar",
        pictograma: <Plus aria-hidden="true" className="size-4" />,
      }}
      titlu="Citire de contor"
      descriere="Citirile merg numai înainte: baza respinge o valoare mai mică decât ultima înregistrată. Pentru un contor înlocuit, bifați „Resetare contor”."
      marime="mare"
      actiune={trimite}
      laReusita={laReusita}
      mesajReusita="Citirea a fost înregistrată."
      etichetaTrimite="Salvează citirea"
      textInCurs="Se salvează…"
    >
      {(stare, idc) => {
        // Formularul rămâne pe ecran după salvare, deci trebuie să
        // repornească gol: React 19 resetează un `<form action>` necontrolat
        // după acțiune, iar resetul pune înapoi `defaultValue` — adică exact
        // citirea tocmai înregistrată, pe care un al doilea clic ar
        // înregistra-o din nou. `valoriTrimise` se păstrează DOAR cât timp
        // ultimul răspuns a fost un refuz.
        const trimise: Readonly<Record<string, string>> =
          stare.data === null ? stare.valoriTrimise : {};

        // Bifa nu apare deloc în `FormData` când e nebifată, deci
        // `trimise["resetare_contor"]` nu distinge „nebifat” de „încă
        // netrimis”. Se întreabă întâi dacă formularul a fost trimis vreodată.
        const sATrimis = Object.keys(trimise).length > 0;
        const resetareBifata = sATrimis && trimise["resetare_contor"] === "on";

        return (
          <>
            <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-3">
              <Camp
                nume="tip"
                id={idc("tip")}
                eticheta="Tip contor"
                fel="select"
                obligatoriu
                erori={stare.erori["tip"] ?? []}
              >
                {(a) => (
                  <select {...a} defaultValue={trimise["tip"] ?? ""}>
                    {TIPURI_CONTOR.map((t) => (
                      <option key={t} value={t}>
                        {ETICHETE_TIP_CONTOR[t]}
                      </option>
                    ))}
                  </select>
                )}
              </Camp>

              <Camp
                nume="citire"
                id={idc("citire")}
                eticheta="Citire"
                obligatoriu
                erori={stare.erori["citire"] ?? []}
              >
                {(a) => (
                  <input
                    {...a}
                    type="number"
                    min="0"
                    step="0.01"
                    defaultValue={trimise["citire"] ?? ""}
                  />
                )}
              </Camp>

              <Camp
                nume="data_citirii"
                id={idc("data-citirii")}
                eticheta="Data citirii"
                obligatoriu
                erori={stare.erori["data_citirii"] ?? []}
              >
                {(a) => <input {...a} type="date" defaultValue={trimise["data_citirii"] ?? ""} />}
              </Camp>

              <Camp
                nume="citit_de_employee_id"
                id={idc("citit-de")}
                eticheta="Citit de"
                fel="select"
                erori={stare.erori["citit_de_employee_id"] ?? []}
              >
                {(a) => (
                  <select {...a} defaultValue={trimise["citit_de_employee_id"] ?? ""}>
                    <option value="">Nespecificat</option>
                    {angajati.map((ang) => (
                      <option key={ang.id} value={ang.id}>
                        {ang.nume}
                      </option>
                    ))}
                  </select>
                )}
              </Camp>

              <Camp
                nume="observatii"
                id={idc("observatii")}
                eticheta="Observații"
                className="sm:col-span-2 lg:col-span-2"
                erori={stare.erori["observatii"] ?? []}
              >
                {(a) => <input {...a} maxLength={500} defaultValue={trimise["observatii"] ?? ""} />}
              </Camp>

              {/* Bifa rămâne scrisă de mână: `Camp` pune eticheta ÎNAINTEA
                    controlului, iar la o casetă de bifat eticheta stă după —
                    altfel ținta de atingere se rupe în două și rândul se
                    citește invers. */}
              <div className="flex items-center gap-2 self-end">
                <input
                  id={idc("resetare")}
                  name="resetare_contor"
                  type="checkbox"
                  defaultChecked={resetareBifata}
                  className={clasaBifa}
                />
                <label htmlFor={idc("resetare")} className="text-corp">
                  Resetare contor
                </label>
              </div>
            </div>
          </>
        );
      }}
    </FormularDialog>
  );
}
