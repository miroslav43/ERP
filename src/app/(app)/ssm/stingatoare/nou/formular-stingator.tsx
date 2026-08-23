"use client";

import { useCallback } from "react";
import { useRouter } from "next/navigation";

import { Buton } from "@/components/ui/buton";
import { Camp } from "@/components/ui/camp";
import { Formular } from "@/components/ui/formular";
import { STATUS_STINGATOR } from "@/schemas/ssm";

import { actualizeazaStingator, adaugaStingator } from "../../actions";
import { ETICHETE_STATUS_STINGATOR } from "../../etichete";

export interface StingatorExistent {
  readonly id: string;
  readonly cod: string;
  readonly tip: string;
  readonly masa_kg: number | null;
  readonly cladire: string | null;
  readonly locatie: string;
  readonly producator: string | null;
  readonly serie: string | null;
  readonly data_punerii_in_functiune: string | null;
  readonly ultima_verificare: string | null;
  readonly ultima_reincarcare: string | null;
  readonly ultima_proba_presiune: string | null;
  readonly status: string;
}

/**
 * Fișa unui stingător — adăugare și editare, același formular.
 *
 * ── CE S-A REPARAT ────────────────────────────────────────────────────────
 * Formularul trimitea prin `useTransition` și afișa `rezultat.error.message`
 * într-un singur `<p>` roșu sub buton. `stingatorSchema` are douăsprezece
 * câmpuri și mesaje proprii pe fiecare — „Codul este obligatoriu.”, „Locația
 * este obligatorie.” — dar sub buton se citea propoziția generică „Datele
 * introduse nu sunt valide.”, la câțiva zeci de pixeli de câmpul vinovat.
 * Mesajul potrivit exista în `fieldErrors` și se arunca.
 *
 * Mai grav: cu `<form action={fn}>` și câmpuri necontrolate, React 19 golește
 * formularul după ce acțiunea se încheie. Cine greșea codul la a douăsprezecea
 * casetă reintroducea și celelalte unsprezece. `<Formular>` ține `valoriTrimise`
 * și le dă înapoi drept `defaultValue`.
 *
 * ── CONTRACTUL DE NUME ────────────────────────────────────────────────────
 * `nume` din fiecare `<Camp>` e cheia din `stingatorSchema`, literă cu literă.
 * O diferență de o literă nu dă nicio eroare: `fieldErrors` pur și simplu nu se
 * mai potrivește cu niciun câmp, iar mesajul dispare — exact defectul reparat
 * aici, dar mai greu de găsit. `id` NU e câmp de formular: la editare vine din
 * `stingatorExistent`, adăugat peste valori înainte de apel.
 */
export function FormularStingator({
  stingatorExistent,
}: {
  readonly stingatorExistent?: StingatorExistent;
}) {
  const router = useRouter();
  const editare = stingatorExistent !== undefined;

  async function trimite(formular: FormData) {
    const text = (cheie: string) => {
      const v = String(formular.get(cheie) ?? "").trim();
      return v.length === 0 ? null : v;
    };
    const masa = text("masa_kg");

    const valori = {
      cod: String(formular.get("cod") ?? ""),
      tip: String(formular.get("tip") ?? ""),
      masa_kg: masa === null ? null : Number(masa),
      cladire: text("cladire"),
      locatie: String(formular.get("locatie") ?? ""),
      producator: text("producator"),
      serie: text("serie"),
      data_punerii_in_functiune: text("data_punerii_in_functiune"),
      ultima_verificare: text("ultima_verificare"),
      ultima_reincarcare: text("ultima_reincarcare"),
      ultima_proba_presiune: text("ultima_proba_presiune"),
      status: String(formular.get("status") ?? "activ"),
    };

    return editare
      ? await actualizeazaStingator({ ...valori, id: stingatorExistent.id })
      : await adaugaStingator(valori);
  }

  // Stabil între randări: `laReusita` intră în lista de dependențe a efectului
  // din `<Formular>`, iar o funcție nouă la fiecare randare ar face efectul să
  // se reia — cu încă o notificare de reușită la fiecare re-randare.
  const laReusita = useCallback(
    (date: Readonly<{ id: string }>) => {
      router.push(`/ssm/stingatoare/${date.id}`);
      router.refresh();
    },
    [router],
  );

  return (
    <Formular
      actiune={trimite}
      laReusita={laReusita}
      mesajReusita={editare ? "Stingătorul a fost actualizat." : "Stingătorul a fost adăugat."}
    >
      {(stare) => {
        // După o salvare reușită formularul repornește de la valorile inițiale,
        // nu de la ce tocmai s-a salvat: `valoriTrimise` se păstrează DOAR cât
        // timp ultimul răspuns a fost un refuz.
        const trimise: Readonly<Record<string, string>> =
          stare.data === null ? stare.valoriTrimise : {};

        return (
          <>
            <div className="grid gap-4 sm:grid-cols-2">
              <Camp nume="cod" eticheta="Cod" obligatoriu erori={stare.erori["cod"] ?? []}>
                {(a) => (
                  <input
                    {...a}
                    maxLength={40}
                    defaultValue={trimise["cod"] ?? stingatorExistent?.cod ?? ""}
                  />
                )}
              </Camp>

              <Camp nume="tip" eticheta="Tip" obligatoriu erori={stare.erori["tip"] ?? []}>
                {(a) => (
                  <input
                    {...a}
                    maxLength={60}
                    placeholder="pulbere, CO2, spumă…"
                    defaultValue={trimise["tip"] ?? stingatorExistent?.tip ?? ""}
                  />
                )}
              </Camp>

              <Camp nume="masa_kg" eticheta="Masă (kg)" erori={stare.erori["masa_kg"] ?? []}>
                {(a) => (
                  <input
                    {...a}
                    type="number"
                    min="0.1"
                    step="0.1"
                    defaultValue={trimise["masa_kg"] ?? stingatorExistent?.masa_kg ?? ""}
                  />
                )}
              </Camp>

              <Camp nume="status" eticheta="Stare" fel="select" erori={stare.erori["status"] ?? []}>
                {(a) => (
                  <select
                    {...a}
                    defaultValue={trimise["status"] ?? stingatorExistent?.status ?? "activ"}
                  >
                    {STATUS_STINGATOR.map((s) => (
                      <option key={s} value={s}>
                        {ETICHETE_STATUS_STINGATOR[s]}
                      </option>
                    ))}
                  </select>
                )}
              </Camp>

              <Camp
                nume="locatie"
                eticheta="Locație"
                obligatoriu
                erori={stare.erori["locatie"] ?? []}
              >
                {(a) => (
                  <input
                    {...a}
                    maxLength={200}
                    defaultValue={trimise["locatie"] ?? stingatorExistent?.locatie ?? ""}
                  />
                )}
              </Camp>

              <Camp nume="cladire" eticheta="Clădire" erori={stare.erori["cladire"] ?? []}>
                {(a) => (
                  <input
                    {...a}
                    maxLength={120}
                    defaultValue={trimise["cladire"] ?? stingatorExistent?.cladire ?? ""}
                  />
                )}
              </Camp>

              <Camp nume="producator" eticheta="Producător" erori={stare.erori["producator"] ?? []}>
                {(a) => (
                  <input
                    {...a}
                    maxLength={120}
                    defaultValue={trimise["producator"] ?? stingatorExistent?.producator ?? ""}
                  />
                )}
              </Camp>

              <Camp nume="serie" eticheta="Serie" erori={stare.erori["serie"] ?? []}>
                {(a) => (
                  <input
                    {...a}
                    maxLength={64}
                    defaultValue={trimise["serie"] ?? stingatorExistent?.serie ?? ""}
                  />
                )}
              </Camp>

              <Camp
                nume="data_punerii_in_functiune"
                eticheta="Punere în funcțiune"
                erori={stare.erori["data_punerii_in_functiune"] ?? []}
              >
                {(a) => (
                  <input
                    {...a}
                    type="date"
                    defaultValue={
                      trimise["data_punerii_in_functiune"] ??
                      stingatorExistent?.data_punerii_in_functiune ??
                      ""
                    }
                  />
                )}
              </Camp>

              <Camp
                nume="ultima_verificare"
                eticheta="Ultima verificare"
                erori={stare.erori["ultima_verificare"] ?? []}
              >
                {(a) => (
                  <input
                    {...a}
                    type="date"
                    defaultValue={
                      trimise["ultima_verificare"] ?? stingatorExistent?.ultima_verificare ?? ""
                    }
                  />
                )}
              </Camp>

              <Camp
                nume="ultima_reincarcare"
                eticheta="Ultima reîncărcare"
                erori={stare.erori["ultima_reincarcare"] ?? []}
              >
                {(a) => (
                  <input
                    {...a}
                    type="date"
                    defaultValue={
                      trimise["ultima_reincarcare"] ?? stingatorExistent?.ultima_reincarcare ?? ""
                    }
                  />
                )}
              </Camp>

              <Camp
                nume="ultima_proba_presiune"
                eticheta="Ultima probă de presiune"
                erori={stare.erori["ultima_proba_presiune"] ?? []}
              >
                {(a) => (
                  <input
                    {...a}
                    type="date"
                    defaultValue={
                      trimise["ultima_proba_presiune"] ??
                      stingatorExistent?.ultima_proba_presiune ??
                      ""
                    }
                  />
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
                {editare ? "Salvează modificările" : "Adaugă stingătorul"}
              </Buton>
            </div>
          </>
        );
      }}
    </Formular>
  );
}
