"use client";

import { useCallback, useId, useMemo, useState } from "react";
import { useRouter } from "next/navigation";
import {
  ArrowDown,
  ArrowUp,
  BookOpen,
  CheckSquare,
  FileUp,
  GraduationCap,
  PenLine,
  Plus,
  Trash2,
  Zap,
} from "lucide-react";

import { AlegereCarduri, type OptiuneCard } from "@/components/ui/alegere-carduri";
import { BaraActiuni } from "@/components/ui/bara-actiuni";
import { Buton } from "@/components/ui/buton";
import { Camp, clasaBifa } from "@/components/ui/camp";
import { ProgresPasi } from "@/components/ui/progres-pasi";
import { arataToast } from "@/components/ui/toast";
import type { ChecklistFelPas } from "@/schemas/checklist";
import {
  CHECKLIST_RESPONSABIL_TIP,
  CHECKLIST_TIP,
  salveazaSablonSchema,
} from "@/schemas/checklist";

import { salveazaSablon } from "../../actions";
import {
  campuriDinFel,
  etapaNoua,
  etapeImplicite,
  intrareSablon,
  muta,
  numarPasi,
  pasNou,
  type StareEtapa,
  type StarePas,
  type StareSablon,
} from "../../_formulare/citire";
import { ETICHETE_RESPONSABIL_TIP, ETICHETE_ROL, ETICHETE_TIP } from "../../etichete";

/**
 * Constructorul de șablon.
 *
 * ── CE ERA GREȘIT ─────────────────────────────────────────────────────────
 * `/onboarding/sabloane/nou` salva DOAR antetul. Pașii se adăugau abia după, la
 * `sabloane/[id]`, unul câte unul, fiecare cu opt câmpuri deschise simultan și
 * un drum la server cu `router.refresh()`. Un parcurs de 12 pași costa ~106
 * gesturi și 13 scrieri neatomice, iar o întrerupere la mijloc lăsa în bază
 * jumătate de șablon care arăta ca unul întreg. Etapele nu existau deloc.
 *
 * ── CUM E ACUM ────────────────────────────────────────────────────────────
 * Patru pași, cu salt liber între ei, aceeași componentă la creare și la
 * editare. Un pas se descrie alegând un CARD — bifă, document, declarație,
 * curs — nu completând trei coloane corelate. La final, UN singur apel:
 * `checklist_salveaza_sablon`, o tranzacție.
 *
 * `useState` plat, nu react-hook-form: structura e imbricată (etape → pași) și
 * dinamică pe ambele niveluri, iar `useFieldArray` imbricat costă mai mult
 * decât aduce. Validarea o face tot schema REALĂ a acțiunii, prin `safeParse`.
 */

const ETICHETE_ETAPE = ["Despre parcurs", "Etape", "Pași", "Gata"] as const;
const PAS_ANTET = 1;
const PAS_ETAPE = 2;
const PAS_PASI = 3;
const PAS_GATA = 4;

const CAMPURI_ANTET = ["denumire", "tip", "descriere", "valabil_de_la", "valabil_pana_la"];

interface Optiune {
  readonly id: string;
  readonly denumire: string;
}

interface OptiuneAngajat {
  readonly id: string;
  readonly nume: string;
}

interface Proprietati {
  readonly departamente: readonly Optiune[];
  readonly posturi: readonly Optiune[];
  readonly cursuri: readonly Optiune[];
  readonly materiale: readonly Optiune[];
  readonly angajati: readonly OptiuneAngajat[];
  readonly astazi: string;
  /** Prezent ⇒ editare. Aceeași componentă, alt punct de plecare. */
  readonly initial?: StareSablon;
}

type Stadiu =
  | Readonly<{ tip: "inactiv" }>
  | Readonly<{ tip: "lucru" }>
  | Readonly<{ tip: "eroare"; mesaj: string }>;

export function AsistentSablon({
  departamente,
  posturi,
  cursuri,
  materiale,
  angajati,
  astazi,
  initial,
}: Proprietati) {
  const router = useRouter();
  const idFormular = useId();
  const idc = (sufix: string): string => `${idFormular}-${sufix}`;
  const editare = initial !== undefined;

  const [pas, setPas] = useState(PAS_ANTET);
  const [stadiu, setStadiu] = useState<Stadiu>({ tip: "inactiv" });
  const [erori, setErori] = useState<Record<string, readonly string[]>>({});
  const [stare, setStare] = useState<StareSablon>(
    initial ?? {
      denumire: "",
      tip: "onboarding",
      descriere: "",
      department_id: "",
      job_position_id: "",
      activ: true,
      valabil_de_la: astazi,
      valabil_pana_la: "",
      etape: etapeImplicite(),
      pasi_fara_etapa: [],
    },
  );

  const total = numarPasi(stare);

  const optiuniFel: readonly OptiuneCard[] = useMemo(
    () => [
      {
        valoare: "bifa",
        eticheta: "Bifă",
        descriere: "Se bifează cu mâna, fără dovadă.",
        pictograma: CheckSquare,
      },
      {
        valoare: "fisier",
        eticheta: "Document",
        descriere: "Cere un document justificativ.",
        pictograma: FileUp,
      },
      {
        valoare: "semnatura",
        eticheta: "Declarație",
        descriere: "Cere numele celui care confirmă.",
        pictograma: PenLine,
      },
      cursuri.length === 0
        ? {
            valoare: "curs",
            eticheta: "Curs",
            descriere: "Se bifează singur când cursul e parcurs.",
            pictograma: GraduationCap,
            indisponibil: true,
            motiv: "Nu există niciun curs publicat în firmă.",
          }
        : {
            valoare: "curs",
            eticheta: "Curs",
            descriere: "Se bifează singur când cursul e parcurs.",
            pictograma: GraduationCap,
          },
      materiale.length === 0
        ? {
            valoare: "citire",
            eticheta: "Citire",
            descriere: "Se bifează când angajatul confirmă că l-a citit.",
            pictograma: BookOpen,
            indisponibil: true,
            motiv: "Nu există niciun material cu versiune publicată.",
          }
        : {
            valoare: "citire",
            eticheta: "Citire",
            descriere: "Se bifează când angajatul confirmă că l-a citit.",
            pictograma: BookOpen,
          },
      {
        valoare: "automat",
        eticheta: "Automat",
        descriere: "Se bifează când toate bunurile sunt returnate.",
        pictograma: Zap,
      },
    ],
    [cursuri.length, materiale.length],
  );

  const setEtapa = useCallback((index: number, schimba: (e: StareEtapa) => StareEtapa) => {
    setStare((s) => ({ ...s, etape: s.etape.map((e, i) => (i === index ? schimba(e) : e)) }));
  }, []);

  const setPasDin = useCallback(
    (iEtapa: number, iPas: number, schimba: (p: StarePas) => StarePas) => {
      setEtapa(iEtapa, (e) => ({
        ...e,
        pasi: e.pasi.map((p, i) => (i === iPas ? schimba(p) : p)),
      }));
    },
    [setEtapa],
  );

  function inainte(): void {
    setErori({});
    setStadiu({ tip: "inactiv" });
    if (pas === PAS_ANTET) {
      // Se validează pe schema REALĂ a acțiunii, filtrată la câmpurile
      // antetului: o eroare despre pași, aici, ar arăta ca un refuz fără cauză.
      const rezultat = salveazaSablonSchema.safeParse(intrareSablon(stare));
      if (!rezultat.success) {
        const aleAntetului: Record<string, readonly string[]> = {};
        for (const problema of rezultat.error.issues) {
          const camp = String(problema.path[0] ?? "");
          if (CAMPURI_ANTET.includes(camp)) {
            aleAntetului[camp] = [...(aleAntetului[camp] ?? []), problema.message];
          }
        }
        if (Object.keys(aleAntetului).length > 0) {
          setErori(aleAntetului);
          return;
        }
      }
    }
    setPas((p) => Math.min(PAS_GATA, p + 1));
  }

  /**
   * Saltul din bandă.
   *
   * Înapoi mereu. Înainte doar la EDITARE, unde tot conținutul e deja valid și
   * omul a venit pentru o singură schimbare, nu ca să reparcurgă asistentul.
   */
  const salt = useCallback(
    (numar: number): void => {
      setErori({});
      if (numar < pas || editare) setPas(numar);
    },
    [pas, editare],
  );

  async function salveaza(): Promise<void> {
    setErori({});
    const intrare = intrareSablon(stare);
    const local = salveazaSablonSchema.safeParse(intrare);
    if (!local.success) {
      const peCamp: Record<string, readonly string[]> = {};
      for (const problema of local.error.issues) {
        const cheie = problema.path.join(".") || "formular";
        peCamp[cheie] = [...(peCamp[cheie] ?? []), problema.message];
      }
      setErori(peCamp);
      // Mesajul trebuie să apară acolo unde se repară, nu la final.
      setPas(total === 0 ? PAS_PASI : PAS_ANTET);
      setStadiu({ tip: "eroare", mesaj: "Mai sunt câmpuri de completat." });
      return;
    }

    setStadiu({ tip: "lucru" });
    const raspuns = await salveazaSablon(intrare);
    if (!raspuns.ok) {
      const peCamp: Record<string, readonly string[]> = {};
      for (const [camp, mesaje] of Object.entries(raspuns.error.fieldErrors ?? {})) {
        peCamp[camp] = mesaje;
      }
      setErori(peCamp);
      setStadiu({ tip: "eroare", mesaj: raspuns.error.message });
      return;
    }

    setStadiu({ tip: "inactiv" });
    arataToast({
      fel: "reusita",
      text: editare ? "Șablonul a fost salvat." : "Șablonul a fost creat.",
    });
    router.push(`/onboarding/sabloane/${raspuns.data.id}`);
    router.refresh();
  }

  const eroareDe = (cheie: string): readonly string[] => erori[cheie] ?? [];

  return (
    <div className="space-y-6">
      <ProgresPasi
        etichete={ETICHETE_ETAPE}
        pasCurent={pas}
        eticheta="Pașii constructorului de șablon"
        onSalt={salt}
      />

      {stadiu.tip === "eroare" ? (
        <p
          role="alert"
          className="border-danger/40 bg-danger/8 text-danger rounded-panou text-corp border p-3"
        >
          {stadiu.mesaj}
        </p>
      ) : null}

      {pas === PAS_ANTET ? (
        <div className="grid gap-4 sm:grid-cols-2">
          <Camp
            nume="denumire"
            id={idc("denumire")}
            eticheta="Denumire"
            obligatoriu
            className="sm:col-span-2"
            erori={eroareDe("denumire")}
          >
            {(a) => (
              <input
                {...a}
                maxLength={160}
                value={stare.denumire}
                onChange={(e) => {
                  setStare((s) => ({ ...s, denumire: e.target.value }));
                }}
              />
            )}
          </Camp>

          <Camp nume="tip" id={idc("tip")} eticheta="Tip" fel="select" erori={eroareDe("tip")}>
            {(a) => (
              <select
                {...a}
                value={stare.tip}
                onChange={(e) => {
                  setStare((s) => ({ ...s, tip: e.target.value as StareSablon["tip"] }));
                }}
              >
                {CHECKLIST_TIP.map((t) => (
                  <option key={t} value={t}>
                    {ETICHETE_TIP[t]}
                  </option>
                ))}
              </select>
            )}
          </Camp>

          <div className="flex items-end gap-2 pb-2">
            <input
              id={idc("activ")}
              type="checkbox"
              checked={stare.activ}
              onChange={(e) => {
                setStare((s) => ({ ...s, activ: e.target.checked }));
              }}
              className={clasaBifa}
            />
            <label htmlFor={idc("activ")} className="text-foreground text-corp font-medium">
              Activ
            </label>
          </div>

          {departamente.length === 0 ? null : (
            <Camp
              nume="department_id"
              id={idc("department_id")}
              eticheta="Restrâns la departament"
              fel="select"
            >
              {(a) => (
                <select
                  {...a}
                  value={stare.department_id}
                  onChange={(e) => {
                    setStare((s) => ({ ...s, department_id: e.target.value }));
                  }}
                >
                  <option value="">Toate departamentele</option>
                  {departamente.map((d) => (
                    <option key={d.id} value={d.id}>
                      {d.denumire}
                    </option>
                  ))}
                </select>
              )}
            </Camp>
          )}

          {posturi.length === 0 ? null : (
            <Camp
              nume="job_position_id"
              id={idc("job_position_id")}
              eticheta="Restrâns la post"
              fel="select"
            >
              {(a) => (
                <select
                  {...a}
                  value={stare.job_position_id}
                  onChange={(e) => {
                    setStare((s) => ({ ...s, job_position_id: e.target.value }));
                  }}
                >
                  <option value="">Toate posturile</option>
                  {posturi.map((p) => (
                    <option key={p.id} value={p.id}>
                      {p.denumire}
                    </option>
                  ))}
                </select>
              )}
            </Camp>
          )}

          <Camp
            nume="valabil_de_la"
            id={idc("valabil_de_la")}
            eticheta="Valabil de la"
            obligatoriu
            erori={eroareDe("valabil_de_la")}
          >
            {(a) => (
              <input
                {...a}
                type="date"
                value={stare.valabil_de_la}
                onChange={(e) => {
                  setStare((s) => ({ ...s, valabil_de_la: e.target.value }));
                }}
              />
            )}
          </Camp>

          <Camp
            nume="valabil_pana_la"
            id={idc("valabil_pana_la")}
            eticheta="Valabil până la"
            erori={eroareDe("valabil_pana_la")}
          >
            {(a) => (
              <input
                {...a}
                type="date"
                value={stare.valabil_pana_la}
                onChange={(e) => {
                  setStare((s) => ({ ...s, valabil_pana_la: e.target.value }));
                }}
              />
            )}
          </Camp>

          <Camp
            nume="descriere"
            id={idc("descriere")}
            eticheta="Descriere"
            fel="textarea"
            className="sm:col-span-2"
            erori={eroareDe("descriere")}
          >
            {(a) => (
              <textarea
                {...a}
                rows={3}
                maxLength={2000}
                value={stare.descriere}
                onChange={(e) => {
                  setStare((s) => ({ ...s, descriere: e.target.value }));
                }}
              />
            )}
          </Camp>
        </div>
      ) : null}

      {pas === PAS_ETAPE ? (
        <div className="space-y-3">
          <p className="text-muted-foreground text-corp">
            Etapele grupează pașii și le dau un termen comun, în zile față de data de referință a
            parcursului. Negativ înseamnă înainte de prima zi.
          </p>

          <ol className="space-y-2">
            {stare.etape.map((etapa, i) => (
              <li
                key={i}
                className="border-border rounded-panou grid gap-3 border p-3 sm:grid-cols-[1fr_10rem_auto]"
              >
                <Camp
                  nume={`etapa-${String(i)}`}
                  id={idc(`et-${String(i)}`)}
                  eticheta="Titlul etapei"
                  obligatoriu
                >
                  {(a) => (
                    <input
                      {...a}
                      maxLength={160}
                      value={etapa.titlu}
                      onChange={(e) => {
                        setEtapa(i, (et) => ({ ...et, titlu: e.target.value }));
                      }}
                    />
                  )}
                </Camp>
                <Camp
                  nume={`termen-${String(i)}`}
                  id={idc(`et-t-${String(i)}`)}
                  eticheta="Termen (zile)"
                >
                  {(a) => (
                    <input
                      {...a}
                      type="number"
                      min={-365}
                      max={365}
                      value={etapa.termen_zile_relativ}
                      onChange={(e) => {
                        setEtapa(i, (et) => ({ ...et, termen_zile_relativ: e.target.value }));
                      }}
                    />
                  )}
                </Camp>
                <div className="flex items-end gap-1 pb-2">
                  <Buton
                    varianta="secundar"
                    marime="iconita"
                    aria-label={`Mută etapa „${etapa.titlu}” mai sus`}
                    disabled={i === 0}
                    onClick={() => {
                      setStare((s) => ({ ...s, etape: muta(s.etape, i, i - 1) }));
                    }}
                  >
                    <ArrowUp aria-hidden="true" className="size-4" />
                  </Buton>
                  <Buton
                    varianta="secundar"
                    marime="iconita"
                    aria-label={`Mută etapa „${etapa.titlu}” mai jos`}
                    disabled={i === stare.etape.length - 1}
                    onClick={() => {
                      setStare((s) => ({ ...s, etape: muta(s.etape, i, i + 1) }));
                    }}
                  >
                    <ArrowDown aria-hidden="true" className="size-4" />
                  </Buton>
                  <Buton
                    varianta="distructiv"
                    marime="iconita"
                    aria-label={`Șterge etapa „${etapa.titlu}”`}
                    onClick={() => {
                      setStare((s) => ({
                        ...s,
                        etape: s.etape.filter((_, j) => j !== i),
                        // Pașii etapei NU se pierd: trec în „Fără etapă”.
                        pasi_fara_etapa: [...s.pasi_fara_etapa, ...etapa.pasi],
                      }));
                    }}
                  >
                    <Trash2 aria-hidden="true" className="size-4" />
                  </Buton>
                </div>
              </li>
            ))}
          </ol>

          <Buton
            varianta="secundar"
            onClick={() => {
              setStare((s) => ({ ...s, etape: [...s.etape, etapaNoua("", "0")] }));
            }}
          >
            <Plus aria-hidden="true" className="size-4" />
            Adaugă o etapă
          </Buton>
        </div>
      ) : null}

      {pas === PAS_PASI ? (
        <div className="space-y-6">
          {eroareDe("etape").length > 0 ? (
            <p role="alert" className="text-danger text-corp">
              {eroareDe("etape")[0]}
            </p>
          ) : null}

          {stare.etape.map((etapa, iEtapa) => (
            <section key={iEtapa} className="space-y-3">
              <h3 className="text-foreground text-sectiune font-semibold">
                {etapa.titlu === "" ? `Etapa ${String(iEtapa + 1)}` : etapa.titlu}
                <span className="text-muted-foreground text-nota ml-2 font-normal">
                  {etapa.termen_zile_relativ} zile
                </span>
              </h3>

              {etapa.pasi.map((p, iPas) => (
                <RandPas
                  key={iPas}
                  pas={p}
                  idc={(sufix) => idc(`p-${String(iEtapa)}-${String(iPas)}-${sufix}`)}
                  cursuri={cursuri}
                  materiale={materiale}
                  angajati={angajati}
                  optiuniFel={optiuniFel}
                  primul={iPas === 0}
                  ultimul={iPas === etapa.pasi.length - 1}
                  laSchimbare={(schimba) => {
                    setPasDin(iEtapa, iPas, schimba);
                  }}
                  laMutare={(directie) => {
                    setEtapa(iEtapa, (e) => ({ ...e, pasi: muta(e.pasi, iPas, iPas + directie) }));
                  }}
                  laStergere={() => {
                    setEtapa(iEtapa, (e) => ({ ...e, pasi: e.pasi.filter((_, j) => j !== iPas) }));
                  }}
                />
              ))}

              <Buton
                varianta="secundar"
                onClick={() => {
                  setEtapa(iEtapa, (e) => ({ ...e, pasi: [...e.pasi, pasNou()] }));
                }}
              >
                <Plus aria-hidden="true" className="size-4" />
                Adaugă un pas
              </Buton>
            </section>
          ))}

          {stare.pasi_fara_etapa.length === 0 ? null : (
            <section className="space-y-3">
              <h3 className="text-foreground text-sectiune font-semibold">Fără etapă</h3>
              {stare.pasi_fara_etapa.map((p, iPas) => (
                <RandPas
                  key={iPas}
                  pas={p}
                  idc={(sufix) => idc(`pf-${String(iPas)}-${sufix}`)}
                  cursuri={cursuri}
                  materiale={materiale}
                  angajati={angajati}
                  optiuniFel={optiuniFel}
                  primul={iPas === 0}
                  ultimul={iPas === stare.pasi_fara_etapa.length - 1}
                  laSchimbare={(schimba) => {
                    setStare((s) => ({
                      ...s,
                      pasi_fara_etapa: s.pasi_fara_etapa.map((x, j) =>
                        j === iPas ? schimba(x) : x,
                      ),
                    }));
                  }}
                  laMutare={(directie) => {
                    setStare((s) => ({
                      ...s,
                      pasi_fara_etapa: muta(s.pasi_fara_etapa, iPas, iPas + directie),
                    }));
                  }}
                  laStergere={() => {
                    setStare((s) => ({
                      ...s,
                      pasi_fara_etapa: s.pasi_fara_etapa.filter((_, j) => j !== iPas),
                    }));
                  }}
                />
              ))}
            </section>
          )}
        </div>
      ) : null}

      {pas === PAS_GATA ? (
        <div className="border-border bg-surface rounded-panou space-y-3 border p-6">
          <h2 className="text-foreground text-sectiune font-semibold">
            {stare.denumire === "" ? "Șablon fără denumire" : stare.denumire}
          </h2>
          <p className="text-muted-foreground text-corp">
            {ETICHETE_TIP[stare.tip]} · {stare.etape.length} etape · {total} pași ·{" "}
            {stare.activ ? "activ" : "dezactivat"}
          </p>
          {total === 0 ? (
            <p role="alert" className="text-danger text-corp">
              Un șablon fără niciun pas nu poate fi pornit. Adăugați cel puțin un pas.
            </p>
          ) : null}
        </div>
      ) : null}

      <BaraActiuni eticheta="Navigare în asistent" separata lipitaPeTelefon>
        {pas > PAS_ANTET ? (
          <Buton
            varianta="secundar"
            disabled={stadiu.tip === "lucru"}
            onClick={() => {
              setPas((p) => Math.max(PAS_ANTET, p - 1));
            }}
          >
            Înapoi
          </Buton>
        ) : null}

        {pas < PAS_GATA ? (
          <Buton varianta="primar" onClick={inainte}>
            Mai departe
          </Buton>
        ) : (
          <Buton
            varianta="primar"
            inCurs={stadiu.tip === "lucru"}
            textInCurs="Se salvează…"
            disabled={total === 0}
            onClick={() => {
              void salveaza();
            }}
          >
            {editare ? "Salvează modificările" : "Creează șablonul"}
          </Buton>
        )}
      </BaraActiuni>
    </div>
  );
}

interface PropsRandPas {
  readonly pas: StarePas;
  readonly idc: (sufix: string) => string;
  readonly cursuri: readonly Optiune[];
  readonly materiale: readonly Optiune[];
  readonly angajati: readonly OptiuneAngajat[];
  readonly optiuniFel: readonly OptiuneCard[];
  readonly primul: boolean;
  readonly ultimul: boolean;
  readonly laSchimbare: (schimba: (p: StarePas) => StarePas) => void;
  readonly laMutare: (directie: -1 | 1) => void;
  readonly laStergere: () => void;
}

function RandPas({
  pas,
  idc,
  cursuri,
  materiale,
  angajati,
  optiuniFel,
  primul,
  ultimul,
  laSchimbare,
  laMutare,
  laStergere,
}: PropsRandPas) {
  const impus = campuriDinFel(pas.fel).obligatoriuImpus;

  return (
    <div className="border-border rounded-panou space-y-3 border p-4">
      <div className="flex items-start gap-2">
        <div className="min-w-0 flex-1">
          <Camp nume={idc("titlu")} id={idc("titlu")} eticheta="Ce are de făcut" obligatoriu>
            {(a) => (
              <input
                {...a}
                maxLength={200}
                value={pas.titlu}
                onChange={(e) => {
                  laSchimbare((p) => ({ ...p, titlu: e.target.value }));
                }}
              />
            )}
          </Camp>
        </div>
        <div className="flex items-end gap-1 pb-2">
          <Buton
            varianta="secundar"
            marime="iconita"
            aria-label="Mută pasul mai sus"
            disabled={primul}
            onClick={() => {
              laMutare(-1);
            }}
          >
            <ArrowUp aria-hidden="true" className="size-4" />
          </Buton>
          <Buton
            varianta="secundar"
            marime="iconita"
            aria-label="Mută pasul mai jos"
            disabled={ultimul}
            onClick={() => {
              laMutare(1);
            }}
          >
            <ArrowDown aria-hidden="true" className="size-4" />
          </Buton>
          <Buton
            varianta="distructiv"
            marime="iconita"
            aria-label="Șterge pasul"
            onClick={laStergere}
          >
            <Trash2 aria-hidden="true" className="size-4" />
          </Buton>
        </div>
      </div>

      <AlegereCarduri
        nume={idc("fel")}
        eticheta="Cum se dovedește pasul"
        optiuni={optiuniFel}
        valoare={pas.fel}
        coloane={3}
        laSchimbare={(v) => {
          const fel = v as ChecklistFelPas;
          laSchimbare((p) => ({
            ...p,
            fel,
            // Cursul rămas dintr-o alegere anterioară n-are ce căuta pe un pas
            // care nu mai e de tip curs: `_curs_ck` cere exact perechea.
            curs_id: fel === "curs" ? p.curs_id : "",
            material_id: fel === "citire" ? p.material_id : "",
            obligatoriu: campuriDinFel(fel).obligatoriuImpus ? true : p.obligatoriu,
          }));
        }}
      />

      {pas.fel === "citire" ? (
        <Camp
          nume={idc("material")}
          id={idc("material")}
          eticheta="Materialul de citit"
          fel="select"
          obligatoriu
          ajutor="Angajatul îl deschide din parcursul lui și confirmă că l-a parcurs."
        >
          {(a) => (
            <select
              {...a}
              value={pas.material_id}
              onChange={(e) => {
                laSchimbare((p) => ({ ...p, material_id: e.target.value }));
              }}
            >
              <option value="">— alegeți —</option>
              {materiale.map((m) => (
                <option key={m.id} value={m.id}>
                  {m.denumire}
                </option>
              ))}
            </select>
          )}
        </Camp>
      ) : null}

      {pas.fel === "curs" ? (
        <Camp
          nume={idc("curs")}
          id={idc("curs")}
          eticheta="Cursul care bifează pasul"
          fel="select"
          obligatoriu
        >
          {(a) => (
            <select
              {...a}
              value={pas.curs_id}
              onChange={(e) => {
                laSchimbare((p) => ({ ...p, curs_id: e.target.value }));
              }}
            >
              <option value="">— alegeți —</option>
              {cursuri.map((c) => (
                <option key={c.id} value={c.id}>
                  {c.denumire}
                </option>
              ))}
            </select>
          )}
        </Camp>
      ) : null}

      <div className="grid gap-3 sm:grid-cols-3">
        <Camp nume={idc("resp")} id={idc("resp")} eticheta="Cine îl face" fel="select">
          {(a) => (
            <select
              {...a}
              value={pas.responsabil_tip}
              onChange={(e) => {
                laSchimbare((p) => ({
                  ...p,
                  responsabil_tip: e.target.value as StarePas["responsabil_tip"],
                }));
              }}
            >
              {CHECKLIST_RESPONSABIL_TIP.map((r) => (
                <option key={r} value={r}>
                  {ETICHETE_RESPONSABIL_TIP[r]}
                </option>
              ))}
            </select>
          )}
        </Camp>

        {pas.responsabil_tip === "rol" ? (
          <Camp nume={idc("rol")} id={idc("rol")} eticheta="Rolul" fel="select" obligatoriu>
            {(a) => (
              <select
                {...a}
                value={pas.responsabil_rol}
                onChange={(e) => {
                  laSchimbare((p) => ({ ...p, responsabil_rol: e.target.value }));
                }}
              >
                <option value="">— alegeți —</option>
                {(["org_admin", "manager", "hr", "employee"] as const).map((r) => (
                  <option key={r} value={r}>
                    {ETICHETE_ROL[r]}
                  </option>
                ))}
              </select>
            )}
          </Camp>
        ) : null}

        {pas.responsabil_tip === "angajat" ? (
          // Un `<select>`, nu un câmp de UUID lipit cu mâna. Cea mai mare firmă
          // are opt angajați: o listă e mai ieftină decât un autocomplete.
          <Camp nume={idc("ang")} id={idc("ang")} eticheta="Angajatul" fel="select" obligatoriu>
            {(a) => (
              <select
                {...a}
                value={pas.responsabil_employee_id}
                onChange={(e) => {
                  laSchimbare((p) => ({ ...p, responsabil_employee_id: e.target.value }));
                }}
              >
                <option value="">— alegeți —</option>
                {angajati.map((ang) => (
                  <option key={ang.id} value={ang.id}>
                    {ang.nume}
                  </option>
                ))}
              </select>
            )}
          </Camp>
        ) : null}

        <Camp nume={idc("termen")} id={idc("termen")} eticheta="Termen (zile)">
          {(a) => (
            <input
              {...a}
              type="number"
              min={-365}
              max={365}
              value={pas.termen_zile_relativ}
              onChange={(e) => {
                laSchimbare((p) => ({ ...p, termen_zile_relativ: e.target.value }));
              }}
            />
          )}
        </Camp>
      </div>

      <div className="flex flex-wrap items-center gap-2">
        <input
          id={idc("oblig")}
          type="checkbox"
          checked={pas.obligatoriu}
          disabled={impus}
          onChange={(e) => {
            laSchimbare((p) => ({ ...p, obligatoriu: e.target.checked }));
          }}
          className={clasaBifa}
        />
        <label htmlFor={idc("oblig")} className="text-foreground text-corp font-medium">
          Obligatoriu
        </label>
        {/* Motivul scris lângă control, nu doar `disabled`. */}
        {impus ? (
          <span className="text-muted-foreground text-nota">
            Impus: un pas care se bifează singur trebuie să fie obligatoriu.
          </span>
        ) : null}
      </div>

      <Camp nume={idc("descriere")} id={idc("descriere")} eticheta="Detalii" fel="textarea">
        {(a) => (
          <textarea
            {...a}
            rows={2}
            maxLength={2000}
            value={pas.descriere}
            onChange={(e) => {
              laSchimbare((p) => ({ ...p, descriere: e.target.value }));
            }}
          />
        )}
      </Camp>
    </div>
  );
}
