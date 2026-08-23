"use client";

import { useCallback, useState } from "react";
import { useRouter } from "next/navigation";

import { Buton } from "@/components/ui/buton";
import { Camp } from "@/components/ui/camp";
import { Formular } from "@/components/ui/formular";
import type { ActionResult } from "@/lib/actions/types";

import { creeazaFoaie } from "../../actions";

interface VehiculOptiune {
  readonly id: string;
  readonly nr_inmatriculare: string;
  readonly km_curent: number;
}

interface AngajatOptiune {
  readonly id: string;
  readonly full_name: string | null;
  readonly marca: string;
}

type FoaieCreata = Readonly<{ id: string }>;

/**
 * Refuz construit în client, în forma exactă a unui `ActionResult`, ca mesajul
 * să meargă pe aceeași cale ca al serverului și să ajungă lângă câmp, nu sub
 * buton.
 *
 * Există doar unde schema Zod n-are mesaj propriu în română: `plecare_la` e
 * `z.iso.datetime({ local: true })`, iar un câmp gol întoarce textul implicit
 * al lui Zod, în engleză. Schema e un contract cu acțiunea și nu se atinge de
 * aici — deci golul se prinde înainte de drumul la server.
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

function textSauNull(date: FormData, cheie: string): string | null {
  const valoare = String(date.get(cheie) ?? "").trim();
  return valoare.length === 0 ? null : valoare;
}

/**
 * Numele din `FormData` sunt EXACT cheile lui `foaieNouaSchema`
 * (`src/schemas/fleet.ts`): `vehicle_id`, `employee_id`, `plecare_la`,
 * `km_plecare`, `traseu`, `scop`. Fără potrivirea asta, `fieldErrors` întors de
 * acțiune n-ar mai găsi niciun câmp, iar mesajul ar dispărea în tăcere.
 *
 * `observatii` există în schemă, dar nu și pe ecran: foaia se completează la
 * plecare, iar observațiile se scriu la închiderea cursei.
 */
async function trimiteFoaia(date: FormData): Promise<ActionResult<FoaieCreata>> {
  const plecareLa = String(date.get("plecare_la") ?? "").trim();
  if (plecareLa.length === 0) {
    return refuzDeClient({ plecare_la: ["Completați data și ora plecării."] });
  }

  return creeazaFoaie({
    vehicle_id: String(date.get("vehicle_id") ?? ""),
    employee_id: String(date.get("employee_id") ?? ""),
    plecare_la: plecareLa,
    // `km_plecare` pleacă text: `z.coerce.number().int()` îl convertește, exact
    // ca înainte, iar un `Number()` aici ar transforma golul în 0 mai devreme.
    km_plecare: String(date.get("km_plecare") ?? ""),
    traseu: textSauNull(date, "traseu"),
    scop: textSauNull(date, "scop"),
    observatii: null,
  });
}

export function FormularFoaie({
  vehicule,
  angajati,
}: {
  readonly vehicule: readonly VehiculOptiune[];
  readonly angajati: readonly AngajatOptiune[];
}) {
  const router = useRouter();
  const [vehiculId, setVehiculId] = useState(vehicule[0]?.id ?? "");

  /**
   * Kilometrajul sugerat vine din `vehicles.km_curent`, care e ridicat la fiecare
   * aprobare de foaie — adică e chiar ultimul kilometraj cunoscut. Îl arătăm ca
   * valoare implicită editabilă, nu blocată: șoferul poate avea un motiv real să
   * îl corecteze în sus, iar în jos oricum îl refuză baza.
   *
   * Câmpul e CONTROLAT, nu remontat cu `key`: starea supraviețuiește unei erori
   * de validare (formularul nu se mai golește), iar la schimbarea vehiculului
   * sugestia se rescrie explicit, în același `onChange`.
   */
  const [kmPlecare, setKmPlecare] = useState(String(vehicule[0]?.km_curent ?? 0));
  const kmSugerat = vehicule.find((v) => v.id === vehiculId)?.km_curent ?? 0;

  const laReusita = useCallback(
    (foaie: Readonly<{ id: string }>) => {
      router.push(`/flota/foi/${foaie.id}`);
    },
    [router],
  );

  return (
    <Formular
      actiune={trimiteFoaia}
      laReusita={laReusita}
      mesajReusita="Foaia de parcurs a fost salvată ca ciornă."
    >
      {(stare) => (
        <>
          <div className="grid gap-4 sm:grid-cols-2">
            <Camp
              nume="vehicle_id"
              eticheta="Vehicul"
              fel="select"
              obligatoriu
              erori={stare.erori["vehicle_id"] ?? []}
            >
              {(a) => (
                <select
                  {...a}
                  value={vehiculId}
                  onChange={(e) => {
                    setVehiculId(e.target.value);
                    setKmPlecare(
                      String(vehicule.find((v) => v.id === e.target.value)?.km_curent ?? 0),
                    );
                  }}
                >
                  {vehicule.map((v) => (
                    <option key={v.id} value={v.id}>
                      {v.nr_inmatriculare}
                    </option>
                  ))}
                </select>
              )}
            </Camp>

            <Camp
              nume="employee_id"
              eticheta="Șofer"
              fel="select"
              obligatoriu
              erori={stare.erori["employee_id"] ?? []}
            >
              {(a) => (
                <select {...a} defaultValue={stare.valoriTrimise["employee_id"] ?? ""}>
                  {angajati.map((ang) => (
                    <option key={ang.id} value={ang.id}>
                      {ang.full_name ?? ang.marca} ({ang.marca})
                    </option>
                  ))}
                </select>
              )}
            </Camp>

            <Camp
              nume="plecare_la"
              eticheta="Plecare"
              obligatoriu
              erori={stare.erori["plecare_la"] ?? []}
            >
              {(a) => (
                <input
                  {...a}
                  type="datetime-local"
                  defaultValue={stare.valoriTrimise["plecare_la"] ?? ""}
                />
              )}
            </Camp>

            <Camp
              nume="km_plecare"
              eticheta="Kilometraj la plecare"
              obligatoriu
              ajutor={`Ultimul kilometraj cunoscut: ${kmSugerat.toLocaleString("ro-RO")} km.`}
              erori={stare.erori["km_plecare"] ?? []}
            >
              {(a) => (
                <input
                  {...a}
                  type="number"
                  min={0}
                  value={kmPlecare}
                  onChange={(e) => {
                    setKmPlecare(e.target.value);
                  }}
                />
              )}
            </Camp>

            <Camp
              nume="traseu"
              eticheta="Traseu"
              className="sm:col-span-2"
              erori={stare.erori["traseu"] ?? []}
            >
              {(a) => (
                <input
                  {...a}
                  maxLength={500}
                  placeholder="Cluj-Napoca – Turda – Cluj-Napoca"
                  defaultValue={stare.valoriTrimise["traseu"] ?? ""}
                />
              )}
            </Camp>

            <Camp
              nume="scop"
              eticheta="Scopul deplasării"
              className="sm:col-span-2"
              erori={stare.erori["scop"] ?? []}
            >
              {(a) => (
                <input {...a} maxLength={500} defaultValue={stare.valoriTrimise["scop"] ?? ""} />
              )}
            </Camp>
          </div>

          <div>
            <Buton type="submit" varianta="primar" inCurs={stare.inCurs} textInCurs="Se salvează…">
              Salvează ciorna
            </Buton>
          </div>
        </>
      )}
    </Formular>
  );
}
