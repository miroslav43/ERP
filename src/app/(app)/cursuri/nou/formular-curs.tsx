"use client";

// src/app/(app)/cursuri/nou/formular-curs.tsx
//
// `<Formular>` + `<Camp>`, nu `<form action={fn}>` cu câmpuri necontrolate: cu
// al doilea, React 19 RESETEAZĂ formularul după acțiune, inclusiv când acțiunea
// a fost REFUZATĂ. Un cod deja folosit — respins de indexul unic, deci abia
// după drumul la server — ar șterge tot ce a scris omul. `valoriTrimise` le
// pune înapoi ca `defaultValue`.
//
// ── DE CE TREI GRUPURI, ȘI NU O GRILĂ DE ȘAPTE CÂMPURI ──────────────────────
// Cele trei câmpuri numerice — termen, valabilitate, preaviz — sunt trei
// concepte temporale DIFERITE, iar înșirate într-o grilă de două coloane arătau
// ca și cum ar fi același lucru. Preavizul se afișa chiar și pe un curs fără
// valabilitate: un preaviz pentru o expirare inexistentă. Grupurile leagă
// fiecare câmp de întrebarea la care răspunde, iar preavizul apare doar când
// are ce anunța.
//
// Tiparul de grup e cel din `angajati/formular-angajat.tsx:139`.

import { useCallback, useId, useState, type ReactNode } from "react";
import { useRouter } from "next/navigation";

import { BaraActiuni } from "@/components/ui/bara-actiuni";
import { Buton } from "@/components/ui/buton";
import { Camp, clasaBifa } from "@/components/ui/camp";
import { Formular, type StareFormular } from "@/components/ui/formular";

import { actualizeazaCurs, creeazaCurs } from "../actions";
import { citesteCurs } from "../_formulare/citire";

export interface ValoriCurs {
  readonly id: string;
  readonly cod: string;
  readonly denumire: string;
  readonly descriere: string | null;
  readonly obligatoriu: boolean;
  readonly valabilitate_luni: number | null;
  readonly termen_zile: number | null;
  readonly prag_avertizare_zile: number;
}

interface Proprietati {
  readonly initial?: ValoriCurs;
}

function Grup({
  titlu,
  descriere,
  children,
}: {
  readonly titlu: string;
  readonly descriere?: string;
  readonly children: ReactNode;
}) {
  return (
    <fieldset className="border-border bg-background rounded-panou shadow-ridicat border p-5">
      <legend className="text-corp px-1 font-semibold">{titlu}</legend>
      {descriere === undefined ? null : (
        <p className="text-muted-foreground text-nota mt-1">{descriere}</p>
      )}
      <div className="mt-3 grid grid-cols-1 gap-4 sm:grid-cols-2">{children}</div>
    </fieldset>
  );
}

/** `valoriTrimise` are prioritate: după un refuz, ecranul arată ce a scris omul. */
function valoare(
  stare: StareFormular<{ id: string }>,
  cheie: string,
  initiala: string | number | null | undefined,
): string {
  const trimisa = stare.valoriTrimise[cheie];
  if (trimisa !== undefined) return trimisa;
  return initiala === null || initiala === undefined ? "" : String(initiala);
}

export function FormularCurs({ initial }: Proprietati) {
  const router = useRouter();
  const idFormular = useId();
  const idc = (sufix: string): string => `${idFormular}-${sufix}`;
  const esteEditare = initial !== undefined;

  /**
   * Valabilitatea e ținută în stare pentru un singur motiv: preavizul are sens
   * doar dacă cursul expiră. Fără asta, formularul cerea „cu cât timp înainte
   * să anunțăm expirarea" pentru un curs care nu expiră niciodată.
   */
  const [valabilitate, setValabilitate] = useState(
    initial?.valabilitate_luni === null || initial?.valabilitate_luni === undefined
      ? ""
      : String(initial.valabilitate_luni),
  );
  const expira = valabilitate.trim() !== "";

  const trimite = useCallback(
    async (date: FormData) =>
      esteEditare
        ? actualizeazaCurs({ id: initial.id, ...citesteCurs(date) })
        : creeazaCurs(citesteCurs(date)),
    [esteEditare, initial],
  );

  // `useCallback`: `laReusita` intră în lista de dependențe a efectului din
  // `Formular`. O funcție nouă la fiecare randare ar reporni efectul, deci
  // notificarea de succes ar apărea de două ori.
  const laReusita = useCallback(
    (date: { id: string }): void => {
      router.push(`/cursuri/${date.id}`);
      router.refresh();
    },
    [router],
  );

  return (
    <Formular
      actiune={trimite}
      laReusita={laReusita}
      mesajReusita={esteEditare ? "Cursul a fost salvat." : "Cursul a fost creat."}
      className="space-y-4"
    >
      {(stare) => (
        <>
          <Grup
            titlu="Ce e cursul"
            descriere="Denumirea și descrierea se văd exact așa în lista angajatului."
          >
            <Camp
              nume="denumire"
              id={idc("denumire")}
              eticheta="Denumire"
              obligatoriu
              erori={stare.erori["denumire"] ?? []}
            >
              {(a) => (
                <input
                  {...a}
                  type="text"
                  maxLength={160}
                  defaultValue={valoare(stare, "denumire", initial?.denumire)}
                />
              )}
            </Camp>

            <Camp
              nume="cod"
              id={idc("cod")}
              eticheta="Cod"
              obligatoriu
              ajutor="Litere mici, cifre și liniuță jos — fără spații. Apare în adeverință și în export."
              erori={stare.erori["cod"] ?? []}
            >
              {(a) => (
                <input
                  {...a}
                  type="text"
                  maxLength={40}
                  defaultValue={valoare(stare, "cod", initial?.cod)}
                />
              )}
            </Camp>

            <Camp
              nume="descriere"
              id={idc("descriere")}
              eticheta="Descriere"
              fel="textarea"
              className="sm:col-span-2"
              erori={stare.erori["descriere"] ?? []}
            >
              {(a) => (
                <textarea
                  {...a}
                  rows={3}
                  maxLength={2000}
                  defaultValue={valoare(stare, "descriere", initial?.descriere)}
                />
              )}
            </Camp>
          </Grup>

          <Grup titlu="Când trebuie parcurs">
            <Camp
              nume="termen_zile"
              id={idc("termen_zile")}
              eticheta="Termen (zile de la atribuire)"
              ajutor="Lăsați gol dacă nu are termen limită."
              erori={stare.erori["termen_zile"] ?? []}
            >
              {(a) => (
                <input
                  {...a}
                  type="number"
                  min={1}
                  max={365}
                  /*
                    `initial?.termen_zile ?? 30` ar fi fost o capcană pe ruta de
                    editare: un curs salvat DELIBERAT fără termen s-ar fi
                    redeschis cu 30 în câmp, iar prima salvare i-ar fi pus la
                    loc un termen pe care nimeni nu l-a cerut. 30 e implicitul
                    la CREARE; la editare se arată exact ce e în bază.
                  */
                  defaultValue={valoare(
                    stare,
                    "termen_zile",
                    esteEditare ? initial.termen_zile : 30,
                  )}
                />
              )}
            </Camp>

            <div className="sm:col-span-2">
              {/*
                `clasaBifa`, nu clase scrise de mână: `stari-de-interactiune.md`
                §3 fixează forma bifei. `min-h-11` pe etichetă — o bifă de 16px
                fără înălțime era cea mai mică țintă tactilă din tot modulul.
              */}
              <label className="flex min-h-11 cursor-pointer items-start gap-2">
                <input
                  type="checkbox"
                  name="obligatoriu"
                  defaultChecked={
                    /*
                     * O bifă DEBIFATĂ e absentă din `FormData`, deci
                     * `valoriTrimise` n-o conține. Fără asta, cine debifa și
                     * greșea codul primea cursul înapoi BIFAT, tăcut.
                     */
                    Object.keys(stare.valoriTrimise).length > 0
                      ? stare.valoriTrimise["obligatoriu"] === "on"
                      : (initial?.obligatoriu ?? true)
                  }
                  className={`${clasaBifa} mt-0.5`}
                />
                <span>
                  <span className="text-corp block">Curs obligatoriu</span>
                  {/* Propoziția care lipsea: bifa asta e singura care decide
                      intrarea în matricea de conformitate. */}
                  <span className="text-muted-foreground text-nota block">
                    Cursurile obligatorii apar în fila „Conformitate”, unde se vede cine le are la
                    zi și cine nu.
                  </span>
                </span>
              </label>
            </div>
          </Grup>

          <Grup
            titlu="Recertificare"
            descriere="Pentru instructaje care se refac periodic. Cursul reapare singur în lista angajatului la termen."
          >
            <Camp
              nume="valabilitate_luni"
              id={idc("valabilitate_luni")}
              eticheta="Valabilitate (luni)"
              ajutor="Lăsați gol dacă nu expiră."
              erori={stare.erori["valabilitate_luni"] ?? []}
            >
              {(a) => (
                <input
                  {...a}
                  type="number"
                  min={1}
                  max={120}
                  value={valabilitate}
                  onChange={(e) => {
                    setValabilitate(e.target.value);
                  }}
                />
              )}
            </Camp>

            {/*
              Preavizul apare DOAR când cursul expiră. Altfel ar fi un preaviz
              pentru o expirare inexistentă — și era prefilled cu 30, deci arăta
              ca o setare care contează.
            */}
            {expira ? (
              <Camp
                nume="prag_avertizare_zile"
                id={idc("prag_avertizare_zile")}
                eticheta="Preaviz la expirare (zile)"
                ajutor="Cu cât timp înainte se aprinde avertismentul."
                erori={stare.erori["prag_avertizare_zile"] ?? []}
              >
                {(a) => (
                  <input
                    {...a}
                    type="number"
                    min={1}
                    max={180}
                    defaultValue={valoare(
                      stare,
                      "prag_avertizare_zile",
                      initial?.prag_avertizare_zile ?? 30,
                    )}
                  />
                )}
              </Camp>
            ) : null}
          </Grup>

          <BaraActiuni separata lipitaPeTelefon>
            <Buton
              type="submit"
              varianta="primar"
              inCurs={stare.inCurs}
              textInCurs={esteEditare ? "Se salvează…" : "Se creează…"}
            >
              {esteEditare ? "Salvează" : "Creează cursul"}
            </Buton>
            {/* Toate celelalte formulare de creare din aplicație au ieșire. */}
            <Buton
              varianta="tertiar"
              disabled={stare.inCurs}
              onClick={() => {
                router.push(esteEditare ? `/cursuri/${initial.id}` : "/cursuri");
              }}
            >
              Renunță
            </Buton>
          </BaraActiuni>
        </>
      )}
    </Formular>
  );
}
