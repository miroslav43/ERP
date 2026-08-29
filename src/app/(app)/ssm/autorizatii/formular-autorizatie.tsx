"use client";

import { Plus } from "lucide-react";

import { Camp } from "@/components/ui/camp";
import { FormularDialog } from "@/components/ui/formular-dialog";

import { adaugaAutorizatieNominala } from "../actions";

interface AngajatOptiune {
  readonly id: string;
  readonly full_name: string | null;
  readonly marca: string;
}

/**
 * Autorizația nominală — stivuitorist, macaragiu, fochist.
 *
 * ── CE S-A REPARAT ────────────────────────────────────────────────────────
 * Autorizația are `valabil_pana` obligatoriu și intră direct în calculul
 * scadențelor. `autorizatieNominalaSchema` are mesaje proprii — „Numărul
 * autorizației este obligatoriu.”, „Emitentul este obligatoriu.” — dar
 * formularul le înlocuia pe toate cu un singur `<p>` roșu sub buton, iar după
 * refuz React 19 golea cele șapte câmpuri completate. `<Formular>` întoarce
 * `valoriTrimise`, `<Camp>` duce mesajul lângă câmpul lui.
 *
 * ── CONTRACTUL DE NUME ────────────────────────────────────────────────────
 * `nume` din fiecare `<Camp>` e cheia din `autorizatieNominalaSchema`, literă
 * cu literă. `suspendata_la` NU e câmp de formular: o autorizație se adaugă
 * activă, suspendarea vine mai târziu, din altă parte.
 */
export function FormularAutorizatie({
  angajati,
}: {
  readonly angajati: readonly AngajatOptiune[];
}) {
  async function trimite(formular: FormData) {
    const text = (cheie: string) => {
      const v = String(formular.get(cheie) ?? "").trim();
      return v.length === 0 ? null : v;
    };

    return await adaugaAutorizatieNominala({
      employee_id: String(formular.get("employee_id") ?? ""),
      tip: String(formular.get("tip") ?? ""),
      grupa: text("grupa"),
      numar: String(formular.get("numar") ?? ""),
      emitent: String(formular.get("emitent") ?? ""),
      emis_la: text("emis_la"),
      valabil_pana: String(formular.get("valabil_pana") ?? ""),
      suspendata_la: null,
      // `autorizatieNominalaSchema` acceptă `observatii`, dar ecranul n-a avut
      // niciodată o casetă pentru el, deci citirea din `FormData` întorcea
      // mereu `null`. Rămâne `null` explicit: câmpul lipsă e de raportat, nu de
      // inventat aici.
      observatii: text("observatii"),
    });
  }

  return (
    <FormularDialog
      declansator={{
        eticheta: "Autorizație nominală nouă",
        varianta: "secundar",
        pictograma: <Plus aria-hidden="true" className="size-4" />,
      }}
      titlu="Autorizație nominală nouă"
      descriere="Data de expirare intră direct în lista de scadențe: un stivuitorist cu autorizația expirată apare acolo a doua zi. Autorizația se adaugă activă — suspendarea se face din listă."
      marime="mare"
      actiune={trimite}
      mesajReusita="Autorizația a fost adăugată."
      etichetaTrimite="Adaugă autorizația"
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
            <div className="grid gap-3 sm:grid-cols-3">
              <Camp
                nume="employee_id"
                eticheta="Angajat"
                fel="select"
                obligatoriu
                erori={stare.erori["employee_id"] ?? []}
              >
                {(a) => (
                  <select {...a} defaultValue={trimise["employee_id"] ?? ""}>
                    {/* Opțiune goală, PRIMA: fără ea browserul selecta singur
                        primul om din listă, iar `required` nu bloca nimic —
                        există o valoare aleasă. O apăsare distrată scria autorizația pe
                        primul angajat în ordine alfabetică. Alegerea persoanei
                        trebuie să fie un act explicit. */}
                    <option value="">— alegeți angajatul —</option>
                    {angajati.map((ang) => (
                      <option key={ang.id} value={ang.id}>
                        {ang.full_name ?? ang.marca} ({ang.marca})
                      </option>
                    ))}
                  </select>
                )}
              </Camp>

              <Camp nume="tip" eticheta="Tip" obligatoriu erori={stare.erori["tip"] ?? []}>
                {(a) => (
                  <input
                    {...a}
                    maxLength={80}
                    placeholder="stivuitorist, macaragiu, fochist…"
                    defaultValue={trimise["tip"] ?? ""}
                  />
                )}
              </Camp>

              <Camp nume="grupa" eticheta="Grupă (opțional)" erori={stare.erori["grupa"] ?? []}>
                {(a) => <input {...a} maxLength={40} defaultValue={trimise["grupa"] ?? ""} />}
              </Camp>

              <Camp nume="numar" eticheta="Număr" obligatoriu erori={stare.erori["numar"] ?? []}>
                {(a) => <input {...a} maxLength={64} defaultValue={trimise["numar"] ?? ""} />}
              </Camp>

              <Camp
                nume="emitent"
                eticheta="Emitent"
                obligatoriu
                erori={stare.erori["emitent"] ?? []}
              >
                {(a) => <input {...a} maxLength={160} defaultValue={trimise["emitent"] ?? ""} />}
              </Camp>

              <Camp
                nume="emis_la"
                eticheta="Emisă la (opțional)"
                erori={stare.erori["emis_la"] ?? []}
              >
                {(a) => <input {...a} type="date" defaultValue={trimise["emis_la"] ?? ""} />}
              </Camp>

              <Camp
                nume="valabil_pana"
                eticheta="Valabilă până la"
                obligatoriu
                erori={stare.erori["valabil_pana"] ?? []}
              >
                {(a) => <input {...a} type="date" defaultValue={trimise["valabil_pana"] ?? ""} />}
              </Camp>
            </div>
          </>
        );
      }}
    </FormularDialog>
  );
}
