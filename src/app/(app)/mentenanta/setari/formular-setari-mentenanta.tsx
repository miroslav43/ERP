"use client";

import { useRouter } from "next/navigation";
import { useCallback, useId, type ReactElement } from "react";

import { BaraActiuni } from "@/components/ui/bara-actiuni";
import { Buton } from "@/components/ui/buton";
import { Camp, clasaBifa } from "@/components/ui/camp";
import { Formular } from "@/components/ui/formular";
import type { OptiuneSelect, SetariMentenanta } from "@/lib/queries/maintenance";

import { salveazaSetariMentenanta } from "../sesizari/actions";

function text(date: FormData, cheie: string): string {
  return String(date.get(cheie) ?? "").trim();
}

/**
 * Setările modulului, un singur formular pe `Formular` — numele câmpurilor
 * sunt EXACT cheile lui `setariMentenantaSchema`, ca `fieldErrors` să cadă pe
 * câmpul potrivit. Numerele pleacă drept text (schema are `z.coerce`), cu o
 * singură excepție: costul orei de oprire gol înseamnă „nu-l calculăm” (`null`),
 * nu zero lei.
 */
export function FormularSetariMentenanta({
  setari,
  angajati,
}: Readonly<{ setari: SetariMentenanta; angajati: readonly OptiuneSelect[] }>): ReactElement {
  const router = useRouter();
  const id = useId();

  // `laReusita` intră în dependențele efectului de succes din `Formular`; o
  // funcție nouă la fiecare randare ar reporni efectul după `router.refresh()`.
  const laReusita = useCallback(() => {
    router.refresh();
  }, [router]);

  async function trimite(date: FormData) {
    const cost = text(date, "cost_ora_oprire");
    const rsvti = text(date, "rsvti_employee_id");
    return salveazaSetariMentenanta({
      responsabili: date.getAll("responsabili").map(String),
      rsvti_employee_id: rsvti.length === 0 ? null : rsvti,
      inchidere_automata_zile: text(date, "inchidere_automata_zile"),
      prag_avertizare_zile: text(date, "prag_avertizare_zile"),
      prag_contor_necitit_zile: text(date, "prag_contor_necitit_zile"),
      ore_functionare_pe_zi: text(date, "ore_functionare_pe_zi"),
      zile_pe_saptamana: text(date, "zile_pe_saptamana"),
      cost_ora_oprire: cost.length === 0 ? null : cost,
    });
  }

  return (
    <Formular actiune={trimite} mesajReusita="Setările au fost salvate." laReusita={laReusita}>
      {(stare) => {
        const v = (cheie: string, implicit: string): string =>
          stare.valoriTrimise[cheie] ?? implicit;
        const responsabiliAlesi =
          Object.keys(stare.valoriTrimise).length > 0
            ? null // după un refuz, bifele se recitesc din DOM, nu din server
            : new Set(setari.responsabili);
        return (
          <>
            <fieldset className="border-border rounded-panou space-y-3 border p-4">
              <legend className="text-corp px-1 font-semibold">Cine primește sesizările</legend>
              <p className="text-muted-foreground text-corp">
                Responsabilii primesc notificare la fiecare sesizare nouă și rezumatul zilnic. Fără
                nicio bifă, le primesc toți administratorii organizației.
              </p>
              {angajati.length === 0 ? (
                <p className="text-muted-foreground text-corp">Nu există angajați activi.</p>
              ) : (
                <ul className="grid gap-2 sm:grid-cols-2">
                  {angajati.map((a) => (
                    <li key={a.id} className="flex items-center gap-2">
                      <input
                        id={`${id}-resp-${a.id}`}
                        name="responsabili"
                        type="checkbox"
                        value={a.id}
                        className={clasaBifa}
                        defaultChecked={responsabiliAlesi?.has(a.id) ?? false}
                      />
                      <label htmlFor={`${id}-resp-${a.id}`} className="text-corp">
                        {a.nume}
                      </label>
                    </li>
                  ))}
                </ul>
              )}
              {(stare.erori["responsabili"] ?? []).map((e) => (
                <p key={e} role="alert" className="text-danger text-nota">
                  {e}
                </p>
              ))}

              <Camp
                nume="rsvti_employee_id"
                id={`${id}-rsvti`}
                eticheta="Responsabil RSVTI"
                fel="select"
                ajutor="Operatorul responsabil cu supravegherea instalațiilor ISCIR. Apare în alertele pe autorizații."
                erori={stare.erori["rsvti_employee_id"] ?? []}
              >
                {(a) => (
                  <select
                    {...a}
                    defaultValue={v("rsvti_employee_id", setari.rsvti_employee_id ?? "")}
                  >
                    <option value="">Nedesemnat</option>
                    {angajati.map((ang) => (
                      <option key={ang.id} value={ang.id}>
                        {ang.nume}
                      </option>
                    ))}
                  </select>
                )}
              </Camp>
            </fieldset>

            <fieldset className="border-border rounded-panou grid gap-3 border p-4 sm:grid-cols-2">
              <legend className="text-corp px-1 font-semibold">Termene</legend>
              <Camp
                nume="inchidere_automata_zile"
                id={`${id}-inchidere`}
                eticheta="Închidere automată după (zile)"
                ajutor="O sesizare „rezolvată” pe care raportorul n-o confirmă se închide singură după atâtea zile. Între 1 și 90."
                erori={stare.erori["inchidere_automata_zile"] ?? []}
              >
                {(a) => (
                  <input
                    {...a}
                    type="number"
                    min="1"
                    max="90"
                    defaultValue={v(
                      "inchidere_automata_zile",
                      String(setari.inchidere_automata_zile),
                    )}
                  />
                )}
              </Camp>
              <Camp
                nume="prag_avertizare_zile"
                id={`${id}-avertizare`}
                eticheta="Avertizare înainte de scadență (zile)"
                ajutor="De câte zile înainte un plan sau o autorizație apar ca „în curând”."
                erori={stare.erori["prag_avertizare_zile"] ?? []}
              >
                {(a) => (
                  <input
                    {...a}
                    type="number"
                    min="1"
                    max="365"
                    defaultValue={v("prag_avertizare_zile", String(setari.prag_avertizare_zile))}
                  />
                )}
              </Camp>
              <Camp
                nume="prag_contor_necitit_zile"
                id={`${id}-contor`}
                eticheta="Contor necitit după (zile)"
                ajutor="Un echipament cu contor fără citire de atâtea zile apare ca restant."
                erori={stare.erori["prag_contor_necitit_zile"] ?? []}
              >
                {(a) => (
                  <input
                    {...a}
                    type="number"
                    min="1"
                    max="365"
                    defaultValue={v(
                      "prag_contor_necitit_zile",
                      String(setari.prag_contor_necitit_zile),
                    )}
                  />
                )}
              </Camp>
            </fieldset>

            <fieldset className="border-border rounded-panou grid gap-3 border p-4 sm:grid-cols-3">
              <legend className="text-corp px-1 font-semibold">
                Programul de lucru al utilajelor
              </legend>
              <Camp
                nume="ore_functionare_pe_zi"
                id={`${id}-ore`}
                eticheta="Ore de funcționare pe zi"
                ajutor="Baza pentru disponibilitate și pentru costul opririlor."
                erori={stare.erori["ore_functionare_pe_zi"] ?? []}
              >
                {(a) => (
                  <input
                    {...a}
                    type="number"
                    min="0.5"
                    max="24"
                    step="0.5"
                    defaultValue={v("ore_functionare_pe_zi", String(setari.ore_functionare_pe_zi))}
                  />
                )}
              </Camp>
              <Camp
                nume="zile_pe_saptamana"
                id={`${id}-zile`}
                eticheta="Zile pe săptămână"
                erori={stare.erori["zile_pe_saptamana"] ?? []}
              >
                {(a) => (
                  <input
                    {...a}
                    type="number"
                    min="1"
                    max="7"
                    defaultValue={v("zile_pe_saptamana", String(setari.zile_pe_saptamana))}
                  />
                )}
              </Camp>
              <Camp
                nume="cost_ora_oprire"
                id={`${id}-cost`}
                eticheta="Costul unei ore de oprire (lei)"
                ajutor="Gol = nu se calculează. Se înmulțește cu orele de oprire neplanificată din rapoarte."
                erori={stare.erori["cost_ora_oprire"] ?? []}
              >
                {(a) => (
                  <input
                    {...a}
                    type="number"
                    min="0"
                    step="0.01"
                    defaultValue={v(
                      "cost_ora_oprire",
                      setari.cost_ora_oprire === null ? "" : String(setari.cost_ora_oprire),
                    )}
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
