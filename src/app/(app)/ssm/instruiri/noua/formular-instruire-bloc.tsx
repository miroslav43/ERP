"use client";

import { useCallback, useId, useMemo, useState } from "react";
import { useRouter } from "next/navigation";

import { Buton } from "@/components/ui/buton";
import { Camp, clasaBifa, clasaControl } from "@/components/ui/camp";
import { IntrareDurata } from "@/components/ui/intrare-ora";
import { Formular } from "@/components/ui/formular";
import { cn } from "@/lib/ui/cn";

import { inregistreazaInstruireBloc } from "../../actions";
import { ETICHETE_DOMENIU } from "../../etichete";

interface TipOptiune {
  readonly id: string;
  readonly denumire: string;
  readonly domeniu: "ssm" | "psi";
}

interface AngajatOptiune {
  readonly id: string;
  readonly full_name: string | null;
  readonly marca: string;
}

/**
 * Înregistrare în bloc: un tip, o dată, N angajați — un singur `.insert([...])`
 * cu N rânduri (o instrucțiune ⇒ totul sau nimic).
 *
 * ── CE S-A REPARAT ────────────────────────────────────────────────────────
 * Cel mai lung formular din SSM: nouă câmpuri plus o listă de bifat. Toate
 * mesajele lui `instruireBlocSchema` ajungeau într-un singur `<p>` sub buton,
 * iar după refuz React 19 golea formularul — tematica scrisă de mână, materialele
 * și punctajul se pierdeau fiindcă lipsea o dată. `<Formular>` întoarce
 * `valoriTrimise`, iar `<Camp>` duce fiecare mesaj lângă câmpul lui.
 *
 * ── DE UNDE VINE „Alegeți cel puțin un angajat.” ──────────────────────────
 * Verificarea de client care oprea trimiterea când nu era nimeni bifat a fost
 * scoasă: `employee_ids: z.array(z.uuid()).min(1, "Alegeți cel puțin un
 * angajat.")` spune deja exact același lucru, iar mesajul are acum unde să
 * apară — pe grupul de bife, nu sub buton. O singură sursă de adevăr în loc de
 * două propoziții care trebuie ținute în sincron.
 *
 * Bifele NU trec prin `<Camp>`: el pune eticheta ÎNAINTEA controlului, iar la o
 * casetă de bifat eticheta stă după. Marcajul lor rămâne scris de mână, cu
 * `clasaBifa`, iar mesajul grupului e legat de `<fieldset>` prin
 * `aria-describedby`. Selecția trăiește în `selectati`, stare React — deci
 * supraviețuiește refuzului fără să treacă prin `FormData`.
 *
 * ── CONTRACTUL DE NUME ────────────────────────────────────────────────────
 * `nume` din fiecare `<Camp>` e cheia din `instruireBlocSchema`, literă cu
 * literă. Caseta de căutare NU are `name`: nu e câmp al schemei și n-are ce
 * căuta în `FormData`.
 */
const ID_EROARE_ANGAJATI = "camp-employee_ids-eroare";

/**
 * Plafonul unei singure înregistrări, ținut în sincron cu
 * `instruireBlocSchema`: `employee_ids: z.array(z.uuid()).min(1, …).max(200)`.
 *
 * ── DE CE E ÎN CONTROL, NU DOAR ÎN SCHEMĂ ─────────────────────────────────
 * „Selectează toți cei afișați" bifa până la 500 de oameni (atâția încarcă
 * pagina), iar `.max(200)` respingea apoi ÎNTREAGA trimitere. Formularul nu
 * scria nimic, nici măcar primii 200: un insert de N rânduri e o singură
 * instrucțiune, deci totul sau nimic. Omul care tocmai încheiase instruirea cu
 * tot schimbul primea un refuz sub buton, după ce completase nouă câmpuri.
 *
 * Plafonul se vede acum ÎNAINTE de trimitere: butonul spune câți selectează,
 * bifele nebifate se blochează la limită, iar legenda o scrie cu cifre.
 */
const LIMITA_ANGAJATI_PE_INREGISTRARE = 200;

export function FormularInstruireBloc({
  tipuri,
  angajati,
  totalAngajati,
}: {
  readonly tipuri: readonly TipOptiune[];
  readonly angajati: readonly AngajatOptiune[];
  /** Câți angajați activi există CU ADEVĂRAT — lista de sus e tăiată la 500. */
  readonly totalAngajati: number;
}) {
  const router = useRouter();
  const [selectati, setSelectati] = useState<ReadonlySet<string>>(new Set());
  const [cauta, setCauta] = useState("");
  const idCauta = useId();

  const angajatiFiltrati = useMemo(() => {
    const text = cauta.trim().toLowerCase();
    if (text.length === 0) return angajati;
    return angajati.filter(
      (a) =>
        (a.full_name ?? "").toLowerCase().includes(text) || a.marca.toLowerCase().includes(text),
    );
  }, [angajati, cauta]);

  function comuta(id: string): void {
    setSelectati((prev) => {
      const nou = new Set(prev);
      if (nou.has(id)) nou.delete(id);
      else if (nou.size < LIMITA_ANGAJATI_PE_INREGISTRARE) nou.add(id);
      return nou;
    });
  }

  function selecteazaToti(): void {
    setSelectati(
      new Set(angajatiFiltrati.slice(0, LIMITA_ANGAJATI_PE_INREGISTRARE).map((a) => a.id)),
    );
  }

  const deSelectat = Math.min(angajatiFiltrati.length, LIMITA_ANGAJATI_PE_INREGISTRARE);

  async function trimite(formular: FormData) {
    const text = (cheie: string) => {
      const v = String(formular.get(cheie) ?? "").trim();
      return v.length === 0 ? null : v;
    };
    const numar = (cheie: string) => {
      const v = text(cheie);
      return v === null ? null : Number(v);
    };

    return await inregistreazaInstruireBloc({
      training_type_id: String(formular.get("training_type_id") ?? ""),
      data_instruirii: String(formular.get("data_instruirii") ?? ""),
      durata_ore: Number(formular.get("durata_ore") ?? 0),
      lector_employee_id: text("lector_employee_id"),
      lector_extern: text("lector_extern"),
      tematica: text("tematica"),
      materiale: text("materiale"),
      test_punctaj: numar("test_punctaj"),
      observatii: text("observatii"),
      employee_ids: [...selectati],
    });
  }

  // Stabil între randări: `laReusita` intră în lista de dependențe a efectului
  // din `<Formular>`, iar o funcție nouă la fiecare randare ar relua efectul.
  const laReusita = useCallback(() => {
    router.push("/ssm/instruiri");
    router.refresh();
  }, [router]);

  return (
    <Formular
      actiune={trimite}
      laReusita={laReusita}
      mesajReusita="Instruirea a fost înregistrată."
    >
      {(stare) => {
        // După o înregistrare reușită formularul repornește gol: `valoriTrimise`
        // se păstrează DOAR cât timp ultimul răspuns a fost un refuz.
        const trimise: Readonly<Record<string, string>> =
          stare.data === null ? stare.valoriTrimise : {};
        const eroriAngajati = stare.erori["employee_ids"] ?? [];

        return (
          <>
            <div className="grid gap-4 sm:grid-cols-2">
              <Camp
                nume="training_type_id"
                eticheta="Tip instruire"
                fel="select"
                obligatoriu
                erori={stare.erori["training_type_id"] ?? []}
              >
                {(a) => (
                  <select {...a} defaultValue={trimise["training_type_id"] ?? ""}>
                    {tipuri.map((t) => (
                      <option key={t.id} value={t.id}>
                        [{ETICHETE_DOMENIU[t.domeniu]}] {t.denumire}
                      </option>
                    ))}
                  </select>
                )}
              </Camp>

              <Camp
                nume="data_instruirii"
                eticheta="Data instruirii"
                obligatoriu
                erori={stare.erori["data_instruirii"] ?? []}
              >
                {(a) => (
                  <input {...a} type="date" defaultValue={trimise["data_instruirii"] ?? ""} />
                )}
              </Camp>

              <Camp
                nume="durata_ore"
                eticheta="Durata"
                ajutor="Ore și minute, de pildă 2:00."
                erori={stare.erori["durata_ore"] ?? []}
              >
                {(a) => (
                  <IntrareDurata
                    {...a}
                    implicit={
                      trimise["durata_ore"] === undefined || trimise["durata_ore"] === ""
                        ? 2
                        : Number(trimise["durata_ore"])
                    }
                  />
                )}
              </Camp>

              <Camp
                nume="test_punctaj"
                eticheta="Punctaj test (opțional)"
                erori={stare.erori["test_punctaj"] ?? []}
              >
                {(a) => (
                  <input
                    {...a}
                    type="number"
                    min={0}
                    max={100}
                    defaultValue={trimise["test_punctaj"] ?? ""}
                  />
                )}
              </Camp>

              <Camp
                nume="lector_employee_id"
                eticheta="Lector — angajat propriu (opțional)"
                fel="select"
                erori={stare.erori["lector_employee_id"] ?? []}
              >
                {(a) => (
                  <select {...a} defaultValue={trimise["lector_employee_id"] ?? ""}>
                    <option value="">—</option>
                    {angajati.map((a2) => (
                      <option key={a2.id} value={a2.id}>
                        {a2.full_name ?? a2.marca}
                      </option>
                    ))}
                  </select>
                )}
              </Camp>

              <Camp
                nume="lector_extern"
                eticheta="Lector extern (opțional)"
                erori={stare.erori["lector_extern"] ?? []}
              >
                {(a) => (
                  <input {...a} maxLength={120} defaultValue={trimise["lector_extern"] ?? ""} />
                )}
              </Camp>

              <Camp
                nume="tematica"
                eticheta="Tematică"
                fel="textarea"
                className="sm:col-span-2"
                erori={stare.erori["tematica"] ?? []}
              >
                {(a) => (
                  <textarea
                    {...a}
                    rows={2}
                    maxLength={2000}
                    defaultValue={trimise["tematica"] ?? ""}
                  />
                )}
              </Camp>

              <Camp
                nume="materiale"
                eticheta="Materiale folosite"
                erori={stare.erori["materiale"] ?? []}
              >
                {(a) => <input {...a} maxLength={500} defaultValue={trimise["materiale"] ?? ""} />}
              </Camp>

              <Camp nume="observatii" eticheta="Observații" erori={stare.erori["observatii"] ?? []}>
                {(a) => (
                  <input {...a} maxLength={1000} defaultValue={trimise["observatii"] ?? ""} />
                )}
              </Camp>
            </div>

            <fieldset
              className="border-border rounded-panou space-y-3 border p-4"
              aria-describedby={eroriAngajati.length > 0 ? ID_EROARE_ANGAJATI : undefined}
            >
              <legend className="text-corp px-1 font-medium">
                Angajați ({selectati.size} selectați din {angajati.length})
              </legend>

              {angajati.length < totalAngajati ? (
                <p className="text-muted-foreground text-nota">
                  Lista arată primii {angajati.length} angajați activi din {totalAngajati}.
                  Restrângeți căutarea ca să ajungeți la ceilalți.
                </p>
              ) : null}

              {selectati.size >= LIMITA_ANGAJATI_PE_INREGISTRARE ? (
                <p role="status" className="text-foreground text-nota">
                  Ați atins limita de {LIMITA_ANGAJATI_PE_INREGISTRARE} de angajați pe o singură
                  înregistrare. Debifați pe cineva sau înregistrați restul separat.
                </p>
              ) : null}

              {eroriAngajati.length > 0 ? (
                <p id={ID_EROARE_ANGAJATI} role="alert" className="text-danger text-nota">
                  {eroriAngajati.join(" ")}
                </p>
              ) : null}

              <div className="flex flex-wrap items-center gap-3">
                <label htmlFor={idCauta} className="sr-only">
                  Caută angajat
                </label>
                <input
                  id={idCauta}
                  type="search"
                  placeholder="Caută angajat"
                  value={cauta}
                  onChange={(e) => {
                    setCauta(e.target.value);
                  }}
                  className={cn(clasaControl(), "min-w-56 flex-1")}
                />
                <Buton varianta="secundar" onClick={selecteazaToti}>
                  {angajatiFiltrati.length > LIMITA_ANGAJATI_PE_INREGISTRARE
                    ? `Selectează primii ${deSelectat}`
                    : "Selectează toți cei afișați"}
                </Buton>
                <Buton
                  varianta="secundar"
                  onClick={() => {
                    setSelectati(new Set());
                  }}
                >
                  Golește selecția
                </Buton>
              </div>

              <div className="border-border rounded-control max-h-72 space-y-1 overflow-y-auto border p-2">
                {angajatiFiltrati.length === 0 ? (
                  <p className="text-muted-foreground text-corp p-2">
                    Niciun angajat nu se potrivește căutării.
                  </p>
                ) : (
                  angajatiFiltrati.map((a) => (
                    <label
                      key={a.id}
                      className="hover:bg-surface text-corp flex items-center gap-2 rounded px-2 py-1"
                    >
                      <input
                        type="checkbox"
                        className={clasaBifa}
                        checked={selectati.has(a.id)}
                        // La limită se blochează DOAR bifele nebifate: debifarea
                        // trebuie să rămână posibilă, altfel selecția se închide.
                        disabled={
                          !selectati.has(a.id) && selectati.size >= LIMITA_ANGAJATI_PE_INREGISTRARE
                        }
                        onChange={() => {
                          comuta(a.id);
                        }}
                      />
                      {a.full_name ?? "—"}{" "}
                      <span className="text-muted-foreground">({a.marca})</span>
                    </label>
                  ))
                )}
              </div>
            </fieldset>

            <div className="flex flex-wrap items-center gap-3">
              <Buton
                type="submit"
                varianta="primar"
                inCurs={stare.inCurs}
                textInCurs="Se salvează…"
              >
                Înregistrează instruirea
              </Buton>
            </div>
          </>
        );
      }}
    </Formular>
  );
}
