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
 * Setările flotei (0201), un singur formular pe `Formular` (`useActionState` +
 * `FormData`). Numele câmpurilor sunt EXACT cheile lui `setariFlotaSchema`, ca
 * `fieldErrors` să cadă pe câmpul potrivit. Pragurile pleacă drept text
 * („30, 14, 7”): ordonarea și dublurile le rezolvă schema, ca baza.
 */
/** F12d (0216): cele trei setări ale rezervărilor de pool, din `setarileRezervarilor`. */
export type SetariRezervariFormular = Readonly<{
  cuAprobare: boolean;
  obligatorie: boolean;
  maxZile: number;
}>;

export function FormularSetariFlota({
  setari,
  candidati,
  rezervari,
  rezervariInAsteptare,
}: Readonly<{
  setari: SetariFlota;
  candidati: readonly CandidatResponsabil[];
  rezervari: SetariRezervariFormular;
  /** Cererile `ceruta` neexpirate: rămân de decis și dacă aprobarea se oprește. */
  rezervariInAsteptare: number;
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
      // O bifă nebifată LIPSEȘTE din `FormData`: absența e `false`.
      rezervari_cu_aprobare: date.get("rezervari_cu_aprobare") === "on",
      rezervare_obligatorie: date.get("rezervare_obligatorie") === "on",
      rezervari_max_zile: String(date.get("rezervari_max_zile") ?? "").trim(),
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

            {/* F12d (0216): rezervările mașinilor de pool. */}
            <fieldset className="border-border rounded-panou space-y-3 border p-4">
              <legend className="text-corp px-1 font-semibold">Rezervările mașinilor comune</legend>
              <div className="flex items-start gap-2">
                <input
                  id={`${id}-rez-aprobare`}
                  name="rezervari_cu_aprobare"
                  type="checkbox"
                  className={`${clasaBifa} mt-0.5`}
                  defaultChecked={
                    Object.keys(stare.valoriTrimise).length > 0
                      ? stare.valoriTrimise["rezervari_cu_aprobare"] === "on"
                      : rezervari.cuAprobare
                  }
                />
                <label htmlFor={`${id}-rez-aprobare`} className="text-corp">
                  Rezervările cer aprobare
                  <span className="text-muted-foreground text-nota block">
                    Le confirmă managerul direct al angajatului sau un responsabil de flotă cu drept
                    de aprobare; decide primul care apucă. Rezervarea administratorului se confirmă
                    direct.
                  </span>
                </label>
              </div>
              {rezervariInAsteptare > 0 ? (
                <p role="status" className="text-warning text-nota">
                  {rezervariInAsteptare === 1
                    ? "O rezervare așteaptă decizia și rămâne de decis."
                    : `${String(rezervariInAsteptare)} rezervări așteaptă decizia și rămân de decis.`}{" "}
                  Oprirea aprobării nu le confirmă.
                </p>
              ) : null}
              <div className="flex items-start gap-2">
                <input
                  id={`${id}-rez-obligatorie`}
                  name="rezervare_obligatorie"
                  type="checkbox"
                  className={`${clasaBifa} mt-0.5`}
                  defaultChecked={
                    Object.keys(stare.valoriTrimise).length > 0
                      ? stare.valoriTrimise["rezervare_obligatorie"] === "on"
                      : rezervari.obligatorie
                  }
                />
                <label htmlFor={`${id}-rez-obligatorie`} className="text-corp">
                  Mașinile comune se folosesc doar cu rezervare
                  <span className="text-muted-foreground text-nota block">
                    Foaia de parcurs pe o mașină de pool cere o rezervare confirmată pentru ziua ei.
                    Cine întocmește foi pentru oricine (administratorul) nu e oprit.
                  </span>
                </label>
              </div>
              <Camp
                nume="rezervari_max_zile"
                id={`${id}-rez-max`}
                eticheta="Durata maximă a unei rezervări (zile)"
                ajutor="Între 1 și 92. Peste două săptămâni, o mașină e de obicei alocată, nu rezervată."
                obligatoriu
                className="sm:w-80"
                erori={stare.erori["rezervari_max_zile"] ?? []}
              >
                {(a) => (
                  <input
                    {...a}
                    type="number"
                    min="1"
                    max="92"
                    step="1"
                    inputMode="numeric"
                    defaultValue={v("rezervari_max_zile", String(rezervari.maxZile))}
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
