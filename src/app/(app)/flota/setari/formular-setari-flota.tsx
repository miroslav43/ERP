"use client";

import { useRouter } from "next/navigation";
import { useCallback, useId, type ReactElement } from "react";

import { BaraActiuni } from "@/components/ui/bara-actiuni";
import { Buton } from "@/components/ui/buton";
import { Camp, clasaBifa } from "@/components/ui/camp";
import { Formular } from "@/components/ui/formular";
import { textulPragurilor } from "@/domain/fleet/setari";
import type { CandidatResponsabil, SetariFlota } from "@/lib/queries/fleet";

import { salveazaSetariFlota } from "../actions-setari";

/** Eticheta unui candidat: numele, marca și ce-l împiedică să primească ceva. */
function etichetaCandidat(c: CandidatResponsabil): string {
  const nume = c.full_name ?? "Fără nume";
  const marca = c.marca === null ? "" : ` (${c.marca})`;
  const semne = [
    c.user_id === null ? "fără cont" : null,
    c.status === "activ" ? null : "nu mai este activ",
  ].filter((s) => s !== null);
  return semne.length === 0 ? `${nume}${marca}` : `${nume}${marca} — ${semne.join(", ")}`;
}

/**
 * Setările flotei (0198), un singur formular pe `Formular` (`useActionState` +
 * `FormData`). Numele câmpurilor sunt EXACT cheile lui `setariFlotaSchema`, ca
 * `fieldErrors` să cadă pe câmpul potrivit. Pragurile pleacă drept text
 * („30, 14, 7”): ordonarea și dublurile le rezolvă schema, ca baza.
 */
export function FormularSetariFlota({
  setari,
  candidati,
}: Readonly<{
  setari: SetariFlota;
  candidati: readonly CandidatResponsabil[];
}>): ReactElement {
  const router = useRouter();
  const id = useId();

  // Funcție stabilă: intră în dependențele efectului de succes din `Formular`.
  const laReusita = useCallback(() => {
    router.refresh();
  }, [router]);

  async function trimite(date: FormData) {
    return salveazaSetariFlota({
      responsabili: date.getAll("responsabili").map(String),
      prag_salt_km: String(date.get("prag_salt_km") ?? "").trim(),
      praguri_alerta_zile: String(date.get("praguri_alerta_zile") ?? ""),
    });
  }

  return (
    <Formular
      actiune={trimite}
      mesajReusita="Setările flotei au fost salvate."
      laReusita={laReusita}
    >
      {(stare) => {
        const v = (cheie: string, implicit: string): string =>
          stare.valoriTrimise[cheie] ?? implicit;
        // După un refuz, bifele rămân cum le-a lăsat omul în DOM.
        const alesi =
          Object.keys(stare.valoriTrimise).length > 0 ? null : new Set(setari.responsabili);
        return (
          <>
            <fieldset className="border-border rounded-panou space-y-3 border p-4">
              <legend className="text-corp px-1 font-semibold">Responsabilii de flotă</legend>
              <p className="text-muted-foreground text-corp">
                Primesc în fiecare dimineață rezumatul documentelor care expiră și, dacă au dreptul
                de aprobare, foile de parcurs trimise. Fără nicio bifă, le primesc toți
                administratorii organizației. Șoferul alocat primește oricum alertele mașinii lui.
              </p>
              {candidati.length === 0 ? (
                <p className="text-muted-foreground text-corp">Nu există angajați activi.</p>
              ) : (
                <ul className="grid gap-2 sm:grid-cols-2">
                  {candidati.map((c) => (
                    <li key={c.id} className="flex items-center gap-2">
                      <input
                        id={`${id}-resp-${c.id}`}
                        name="responsabili"
                        type="checkbox"
                        value={c.id}
                        className={clasaBifa}
                        defaultChecked={alesi?.has(c.id) ?? false}
                      />
                      <label htmlFor={`${id}-resp-${c.id}`} className="text-corp">
                        {etichetaCandidat(c)}
                      </label>
                    </li>
                  ))}
                </ul>
              )}
              <p className="text-muted-foreground text-nota">
                Fiecare responsabil primește doar mașinile pe care le vede: un manager, pe ale
                echipei lui; un angajat, mașinile comune și pe a lui. Un responsabil fără cont în
                aplicație sau fără acces la parcul auto nu primește nimic. Ce nu vede niciun
                responsabil ajunge la administratori.
              </p>
              {(stare.erori["responsabili"] ?? []).map((e) => (
                <p key={e} role="alert" className="text-danger text-nota">
                  {e}
                </p>
              ))}
            </fieldset>

            <fieldset className="border-border rounded-panou grid gap-3 border p-4 sm:grid-cols-2">
              <legend className="text-corp px-1 font-semibold">Praguri</legend>
              <Camp
                nume="praguri_alerta_zile"
                id={`${id}-praguri`}
                eticheta="Alerte înainte de scadență (zile)"
                ajutor="De exemplu „30, 14, 7”: o alertă cu 30 de zile înainte de ITP, RCA sau rovinietă, încă una la 14 și ultima la 7. Între 1 și 365, cel mult 8 praguri."
                obligatoriu
                erori={stare.erori["praguri_alerta_zile"] ?? []}
              >
                {(a) => (
                  <input
                    {...a}
                    inputMode="numeric"
                    autoComplete="off"
                    defaultValue={v(
                      "praguri_alerta_zile",
                      textulPragurilor(setari.praguri_alerta_zile),
                    )}
                  />
                )}
              </Camp>
              <Camp
                nume="prag_salt_km"
                id={`${id}-salt`}
                eticheta="Prag de salt al kilometrajului (km)"
                ajutor="O foaie care pornește cu mai mulți km decât ultimul kilometraj cunoscut produce o anomalie de verificat. Pe vehicul se poate scrie un prag propriu."
                obligatoriu
                erori={stare.erori["prag_salt_km"] ?? []}
              >
                {(a) => (
                  <input
                    {...a}
                    type="number"
                    min="50"
                    max="100000"
                    step="1"
                    inputMode="numeric"
                    defaultValue={v("prag_salt_km", String(setari.prag_salt_km))}
                  />
                )}
              </Camp>
            </fieldset>

            <BaraActiuni aliniere="final">
              <Buton
                type="submit"
                varianta="primar"
                inCurs={stare.inCurs}
                textInCurs="Se salvează…"
              >
                Salvează setările
              </Buton>
            </BaraActiuni>
          </>
        );
      }}
    </Formular>
  );
}
