"use client";

import { useRouter } from "next/navigation";
import { useState, useTransition } from "react";
import { useForm, useWatch } from "react-hook-form";

import { Buton } from "@/components/ui/buton";
import { Callout } from "@/components/ui/callout";
import { Camp, clasaBifa } from "@/components/ui/camp";
import { STATUS_ECHIPAMENT } from "@/schemas/maintenance";
import { ETICHETE_STATUS_ECHIPAMENT } from "../etichete";
import { actualizeazaEchipament, creeazaEchipament } from "../actions";

interface Optiune {
  readonly id: string;
  readonly nume: string;
}

export interface EchipamentEditabil {
  readonly id: string;
  readonly cod: string;
  readonly denumire: string;
  readonly serie: string | null;
  readonly producator: string | null;
  readonly model: string | null;
  readonly an_fabricatie: number | null;
  readonly locatie: string | null;
  readonly department_id: string | null;
  readonly responsabil_employee_id: string | null;
  readonly status: string;
  readonly este_iscir: boolean;
  readonly tip_autorizare_necesara: string | null;
  readonly valoare_achizitie: number | null;
  readonly data_punerii_in_functiune: string | null;
  readonly derogare_motiv: string | null;
}

interface Proprietati {
  /** Absent ⇒ formular de creare. Prezent ⇒ formular de editare. */
  readonly echipament?: EchipamentEditabil;
  readonly angajati: readonly Optiune[];
  readonly departamente: readonly Optiune[];
  readonly ssmActiv: boolean;
  /** `can(permisiuni, "maintenance:update", "all")` — deschide câmpul de derogare. */
  readonly poateDerogare: boolean;
  /**
   * Chemat după o salvare reușită, pe lângă navigarea către fișă.
   *
   * Există pentru `ButonEditeazaEchipament`, care randează formularul într-o
   * casetă: pe fișa echipamentului, `router.push` merge către adresa CURENTĂ,
   * deci nu se schimbă nimic pe ecran și caseta ar rămâne deschisă peste o fișă
   * deja actualizată.
   */
  readonly laReusita?: () => void;
}

interface ValoriFormular {
  cod: string;
  denumire: string;
  serie: string;
  producator: string;
  model: string;
  an_fabricatie: string;
  locatie: string;
  department_id: string;
  responsabil_employee_id: string;
  status: string;
  este_iscir: boolean;
  tip_autorizare_necesara: string;
  valoare_achizitie: string;
  data_punerii_in_functiune: string;
  derogare_motiv: string;
}

function laText(valoare: string | null): string {
  return valoare ?? "";
}

/** Șir gol → `null`; altfel șirul curățat. Câmpurile `uuid` din schemă resping explicit `""`. */
function laIdOptional(valoare: string): string | null {
  const curatat = valoare.trim();
  return curatat.length === 0 ? null : curatat;
}

/** Mesajul lui react-hook-form, în forma de listă cerută de `<Camp erori>`. */
function mesajeEroare(mesaj: string | undefined): readonly string[] {
  return mesaj === undefined || mesaj === "" ? [] : [mesaj];
}

/**
 * Fișa de echipament — singurul formular de mentenanță pe react-hook-form.
 *
 * ── DE CE NU `<Formular>` AICI ────────────────────────────────────────────
 * `<Formular>` primește o acțiune cu semnătura `(date: FormData) => …` și își
 * randează singur elementul `<form action={…}>`. Formularul ăsta nu trimite
 * niciodată `FormData`: `handleSubmit` predă un obiect `ValoriFormular` deja
 * validat de react-hook-form, iar `trimite` îl transformă în intrarea tipată a
 * acțiunii (numere din text, `""` → `null` pe `uuid`-uri). Cele două arhitecturi
 * de formular nu se unifică, iar `Camp` e render-prop tocmai ca să meargă peste
 * amândouă — deci aici trece DOAR marcajul, cu `{...register("x")}` împrăștiat
 * DUPĂ atributele lui `Camp`, ca `ref`-ul lui RHF să ajungă la element.
 *
 * În plus, `useActionState` (motorul lui `<Formular>`) rezolvă resetarea pe care
 * React 19 o face formularelor necontrolate cu `<form action>`. Aici problema nu
 * există: valorile stau în react-hook-form, nu în DOM, iar `handleSubmit` nu
 * declanșează resetarea.
 *
 * ── CE S-A REPARAT TOTUȘI ─────────────────────────────────────────────────
 * `creeazaEchipament` / `actualizeazaEchipament` întorc `fieldErrors` pe cheile
 * lui `echipamentSchema`, iar fișierul le arunca: păstra doar `error.message`
 * într-un singur `<p>` roșu sub buton. Pe șaisprezece câmpuri, „Datele
 * introduse nu sunt valide.” nu spune nimic. Erorile de server intră acum în
 * `eroriServer` și ajung pe câmpul lor, prin `Camp`.
 *
 * Precedența e cea scrisă în `components/ui/formular.tsx`: **eroarea de server o
 * suprascrie pe cea de client**, fiindcă serverul a văzut datele întregi și
 * baza, iar clientul a văzut un câmp.
 */
export function FormularEchipament({
  echipament,
  angajati,
  departamente,
  ssmActiv,
  poateDerogare,
  laReusita,
}: Proprietati) {
  const router = useRouter();
  const modEditare = echipament !== undefined;
  const [inCurs, porneste] = useTransition();
  const [eroare, setEroare] = useState<string | null>(null);
  const [eroriServer, setEroriServer] = useState<Readonly<Record<string, readonly string[]>>>({});
  const {
    register,
    handleSubmit,
    control,
    formState: { errors },
  } = useForm<ValoriFormular>({
    defaultValues: {
      cod: echipament?.cod ?? "",
      denumire: echipament?.denumire ?? "",
      serie: laText(echipament?.serie ?? null),
      producator: laText(echipament?.producator ?? null),
      model: laText(echipament?.model ?? null),
      an_fabricatie:
        echipament?.an_fabricatie === null || echipament?.an_fabricatie === undefined
          ? ""
          : String(echipament.an_fabricatie),
      locatie: laText(echipament?.locatie ?? null),
      department_id: echipament?.department_id ?? "",
      responsabil_employee_id: echipament?.responsabil_employee_id ?? "",
      status: echipament?.status ?? "in_functiune",
      este_iscir: echipament?.este_iscir ?? false,
      tip_autorizare_necesara: laText(echipament?.tip_autorizare_necesara ?? null),
      valoare_achizitie:
        echipament?.valoare_achizitie === null || echipament?.valoare_achizitie === undefined
          ? ""
          : String(echipament.valoare_achizitie),
      data_punerii_in_functiune: laText(echipament?.data_punerii_in_functiune ?? null),
      derogare_motiv: laText(echipament?.derogare_motiv ?? null),
    },
  });

  // `useWatch`, NU `watch("este_iscir")`. Cu React Compiler activ
  // (`reactCompiler: true`), `watch` întoarce o funcție care nu se poate
  // memoiza, iar compilatorul SARE peste tot componentul — regula
  // `react-hooks/incompatible-library` o semnalează pe linia asta. `useWatch`
  // creează abonamentul aici, în componenta care are nevoie de valoare, exact
  // ca în restul formularelor pe react-hook-form din depozit.
  const esteIscir = useWatch({ control, name: "este_iscir" });

  /** Serverul primul, clientul pe urmă — vezi nota de precedență din docblock. */
  function eroriCamp(cheie: keyof ValoriFormular): readonly string[] {
    const dinServer = eroriServer[cheie];
    if (dinServer !== undefined && dinServer.length > 0) return dinServer;
    return mesajeEroare(errors[cheie]?.message);
  }

  function trimite(valori: ValoriFormular): void {
    setEroare(null);
    setEroriServer({});
    const intrare = {
      cod: valori.cod,
      denumire: valori.denumire,
      serie: laIdOptional(valori.serie),
      producator: laIdOptional(valori.producator),
      model: laIdOptional(valori.model),
      an_fabricatie: valori.an_fabricatie.trim().length === 0 ? null : Number(valori.an_fabricatie),
      locatie: laIdOptional(valori.locatie),
      department_id: laIdOptional(valori.department_id),
      responsabil_employee_id: laIdOptional(valori.responsabil_employee_id),
      status: valori.status,
      este_iscir: valori.este_iscir,
      tip_autorizare_necesara: laIdOptional(valori.tip_autorizare_necesara),
      valoare_achizitie:
        valori.valoare_achizitie.trim().length === 0 ? null : Number(valori.valoare_achizitie),
      data_punerii_in_functiune: laIdOptional(valori.data_punerii_in_functiune),
      derogare_motiv: laIdOptional(valori.derogare_motiv),
    };

    porneste(async () => {
      const rezultat =
        echipament === undefined
          ? await creeazaEchipament(intrare)
          : await actualizeazaEchipament({ id: echipament.id, ...intrare });
      if (!rezultat.ok) {
        const peCampuri = rezultat.error.fieldErrors ?? {};
        setEroriServer(peCampuri);
        // Mesajul general apare DOAR dacă eroarea nu e deja pe un câmp AFIȘAT —
        // altfel omul citește aceeași propoziție de două ori, o dată lângă câmp
        // și o dată sub buton, iar cea de sub buton e mereu cea mai vagă.
        //
        // Se cere „afișat”, nu „existent”: `actualizeazaEchipamentSchema` are și
        // cheia `id`, care nu are control în formular. O eroare doar pe ea ar
        // face ecranul să nu spună NIMIC dacă am număra simplu cheile.
        const areCampAfisat = Object.keys(peCampuri).some((cheie) => cheie in valori);
        setEroare(areCampAfisat ? null : rezultat.error.message);
        return;
      }
      router.push(`/mentenanta/echipamente/${rezultat.data.id}`);
      router.refresh();
      laReusita?.();
    });
  }

  return (
    <form onSubmit={handleSubmit(trimite)} className="space-y-6" noValidate>
      {eroare === null ? null : <Callout fel="eroare">{eroare}</Callout>}

      <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-3">
        {/* `required` era deja aici, dar fără mesaj: react-hook-form bloca
            trimiterea și punea `errors.cod` cu `message: ""`, iar formularul nu
            randa nimic — refuz tăcut. Regula rămâne aceeași, doar că acum are
            un text de citit. */}
        <Camp nume="cod" eticheta="Cod" obligatoriu erori={eroriCamp("cod")}>
          {(a) => (
            <input
              {...a}
              type="text"
              autoComplete="off"
              {...register("cod", { required: "Codul echipamentului este obligatoriu." })}
            />
          )}
        </Camp>

        <Camp nume="denumire" eticheta="Denumire" obligatoriu erori={eroriCamp("denumire")}>
          {(a) => (
            <input
              {...a}
              type="text"
              autoComplete="off"
              {...register("denumire", { required: "Denumirea este obligatorie." })}
            />
          )}
        </Camp>

        <Camp nume="serie" eticheta="Serie" erori={eroriCamp("serie")}>
          {(a) => <input {...a} type="text" {...register("serie")} />}
        </Camp>

        <Camp nume="producator" eticheta="Producător" erori={eroriCamp("producator")}>
          {(a) => <input {...a} type="text" {...register("producator")} />}
        </Camp>

        <Camp nume="model" eticheta="Model" erori={eroriCamp("model")}>
          {(a) => <input {...a} type="text" {...register("model")} />}
        </Camp>

        <Camp nume="an_fabricatie" eticheta="An fabricație" erori={eroriCamp("an_fabricatie")}>
          {(a) => (
            <input {...a} type="number" min="1900" max="2200" {...register("an_fabricatie")} />
          )}
        </Camp>

        <Camp nume="locatie" eticheta="Locație" erori={eroriCamp("locatie")}>
          {(a) => <input {...a} type="text" {...register("locatie")} />}
        </Camp>

        <Camp
          nume="department_id"
          eticheta="Departament"
          fel="select"
          erori={eroriCamp("department_id")}
        >
          {(a) => (
            <select {...a} {...register("department_id")}>
              <option value="">Fără departament</option>
              {departamente.map((d) => (
                <option key={d.id} value={d.id}>
                  {d.nume}
                </option>
              ))}
            </select>
          )}
        </Camp>

        <Camp nume="status" eticheta="Stare" fel="select" erori={eroriCamp("status")}>
          {(a) => (
            <select {...a} {...register("status")}>
              {STATUS_ECHIPAMENT.map((s) => (
                <option key={s} value={s}>
                  {ETICHETE_STATUS_ECHIPAMENT[s]}
                </option>
              ))}
            </select>
          )}
        </Camp>

        <Camp
          nume="data_punerii_in_functiune"
          eticheta="Data punerii în funcțiune"
          erori={eroriCamp("data_punerii_in_functiune")}
        >
          {(a) => <input {...a} type="date" {...register("data_punerii_in_functiune")} />}
        </Camp>

        <Camp
          nume="valoare_achizitie"
          eticheta="Valoare achiziție (lei)"
          erori={eroriCamp("valoare_achizitie")}
        >
          {(a) => (
            <input {...a} type="number" step="0.01" min="0" {...register("valoare_achizitie")} />
          )}
        </Camp>
      </div>

      <div className="border-border rounded-panou border p-4">
        {/* Bifa rămâne scrisă de mână: `Camp` pune eticheta ÎNAINTEA controlului,
            iar la o casetă de bifat eticheta stă după — altfel ținta de atingere
            se rupe în două și rândul se citește invers. */}
        <label className="text-corp flex items-center gap-2 font-medium">
          <input type="checkbox" className={clasaBifa} {...register("este_iscir")} />
          Echipament sub incidența ISCIR
        </label>

        {esteIscir ? (
          <div className="mt-4 grid grid-cols-1 gap-4 sm:grid-cols-2">
            <Camp
              nume="tip_autorizare_necesara"
              eticheta="Tipul de autorizație nominală necesară"
              erori={eroriCamp("tip_autorizare_necesara")}
            >
              {(a) => (
                <input
                  {...a}
                  type="text"
                  placeholder="Ex. stivuitorist, macaragiu"
                  {...register("tip_autorizare_necesara")}
                />
              )}
            </Camp>

            <Camp
              nume="responsabil_employee_id"
              eticheta="Responsabil"
              fel="select"
              erori={eroriCamp("responsabil_employee_id")}
            >
              {(a) => (
                <select {...a} {...register("responsabil_employee_id")}>
                  <option value="">Fără responsabil</option>
                  {angajati.map((ang) => (
                    <option key={ang.id} value={ang.id}>
                      {ang.nume}
                    </option>
                  ))}
                </select>
              )}
            </Camp>

            <p className="text-foreground text-nota sm:col-span-2">
              {ssmActiv
                ? "Responsabilul trebuie să aibă o autorizație nominală valabilă pe acest tip, altfel baza va respinge salvarea — verificați-o în modulul SSM."
                : "Autorizațiile nominale se administrează în modulul SSM; fără el, un responsabil pe echipament ISCIR se poate desemna doar prin derogare motivată."}
            </p>

            {poateDerogare ? (
              <Camp
                nume="derogare_motiv"
                eticheta="Motivul derogării"
                fel="textarea"
                ajutor="Minimum 20 de caractere."
                className="sm:col-span-2"
                erori={eroriCamp("derogare_motiv")}
              >
                {(a) => (
                  <textarea
                    {...a}
                    rows={2}
                    placeholder="Se completează doar dacă responsabilul nu are (încă) o autorizație nominală valabilă."
                    {...register("derogare_motiv")}
                  />
                )}
              </Camp>
            ) : null}
          </div>
        ) : (
          <div className="mt-4">
            {/* Același câmp, a doua ramură: `id` explicit fiindcă `Camp` derivă
                identificatorul din `nume`, iar fișa echipamentului mai are un
                `responsabil_employee_id` — în formularul de plan. */}
            <Camp
              nume="responsabil_employee_id"
              id="responsabil_employee_id_simplu"
              eticheta="Responsabil"
              fel="select"
              erori={eroriCamp("responsabil_employee_id")}
            >
              {(a) => (
                <select {...a} {...register("responsabil_employee_id")}>
                  <option value="">Fără responsabil</option>
                  {angajati.map((ang) => (
                    <option key={ang.id} value={ang.id}>
                      {ang.nume}
                    </option>
                  ))}
                </select>
              )}
            </Camp>
          </div>
        )}
      </div>

      <Buton type="submit" varianta="primar" inCurs={inCurs} textInCurs="Se salvează…">
        {modEditare ? "Salvează modificările" : "Adaugă echipamentul"}
      </Buton>
    </form>
  );
}
