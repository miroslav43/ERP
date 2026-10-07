"use client";

import {
  Check,
  CheckCheck,
  Clock,
  Pencil,
  RotateCcw,
  Search,
  Undo2,
  UserPlus,
  Wrench,
  X,
} from "lucide-react";
import { useRouter } from "next/navigation";
import { useState, useTransition, type ReactElement } from "react";

import { Buton } from "@/components/ui/buton";
import { Camp } from "@/components/ui/camp";
import { ConfirmareActiune } from "@/components/ui/dialog";
import { FormularDialog } from "@/components/ui/formular-dialog";
import { arataToast } from "@/components/ui/toast";
import type { ActionResult } from "@/lib/actions/types";
import {
  raportorulPoateEdita,
  tranzitiiPermise,
  type ActorSesizare,
  type TranzitieSesizare,
} from "@/domain/maintenance/sesizari";
import {
  MOTIVE_RESPINGERE,
  URGENTE_SESIZARE,
  type StatusSesizare,
  type UrgentaSesizare,
} from "@/schemas/maintenance";

import { rezolvaSesizare, trieazaSesizare } from "../../actions";
import {
  ETICHETE_MOTIV_RESPINGERE,
  ETICHETE_STATUS_SESIZARE,
  ETICHETE_URGENTA_SESIZARE,
} from "../../etichete";
import { CampuriInterventie, type OptiuneInterventie } from "../../interventii/campuri-interventie";
import { valoriInterventie } from "../../interventii/valori-interventie";
import {
  actualizeazaSesizare,
  atribuieSesizare,
  inchideSesizare,
  redeschideSesizare,
  retrageSesizare,
  tehnicianSchimbaStarea,
} from "../actions";

/**
 * Bara de acțiuni a sesizării, pentru cei trei actori ai fluxului (0181).
 *
 * Ofertele vin din `tranzitiiPermise(status, actor)` — aceeași mașină de stări
 * ca garda din bază — iar fiecare țintă își alege ACȚIUNEA după cine apasă:
 * gestionarul triază prin `trieazaSesizare`, tehnicianul își mută sesizarea
 * prin `tehnicianSchimbaStarea`, raportorul retrage / confirmă / redeschide
 * prin acțiunile lui. Butoanele sunt o ofertă, nu o barieră: dacă starea s-a
 * schimbat între timp, baza refuză și omul vede motivul în toast.
 *
 * Schimbările de stare simple trec prin `ConfirmareActiune` cu propoziția de
 * consecință; cele care cer text (respingere, redeschidere, rezolvare,
 * atribuire, editare) prin `FormularDialog`, cu erorile pe câmp.
 */
interface Proprietati {
  readonly sesizareId: string;
  readonly status: StatusSesizare;
  readonly actor: ActorSesizare;
  /** Apelantul are fișă de angajat — altfel „Preiau eu” n-are pe cine atribui. */
  readonly areFisa: boolean;
  /** Sesizarea e deja atribuită apelantului. */
  readonly atribuitaMie: boolean;
  readonly atribuit: string | null;
  readonly descriere: string;
  readonly urgenta: UrgentaSesizare;
  readonly angajati: readonly OptiuneInterventie[];
  /** Ziua României, ISO — data implicită a intervenției care rezolvă. */
  readonly azi: string;
  /** Există o oprire deschisă în jurnal: caseta de rezolvare întreabă de când merge iar. */
  readonly oprireDeschisa: boolean;
}

const UUID = /[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}/iu;

const CONSECINTA: Readonly<
  Record<"in_analiza" | "in_lucru" | "in_asteptare" | "inchis" | "retrasa", string>
> = {
  in_analiza:
    "Sesizarea trece în „În analiză”: așa apare în coada de triaj și pe ecranul celui care a raportat-o. Se poate schimba oricând, până la rezolvare sau respingere.",
  in_lucru:
    "Sesizarea trece în „În lucru”: lucrarea a început. Raportorul primește o notificare; rezolvarea se înregistrează tot de aici, cu intervenția făcută.",
  in_asteptare:
    "Sesizarea trece în „În așteptare”: lucrarea stă după piese sau după un furnizor. Rămâne deschisă și în evidența zilnică.",
  inchis:
    "Confirmați că defecțiunea e remediată. Sesizarea se încheie definitiv; dacă problema reapare, se raportează una nouă.",
  retrasa:
    "Sesizarea se retrage și nu se mai poate relua. Responsabilii de mentenanță nu vor mai interveni pe ea.",
};

function text(date: FormData, cheie: string): string {
  return String(date.get(cheie) ?? "").trim();
}

/** `datetime-local` → ISO cu fus; șir gol → `null` („acum”). */
function momentSauNull(date: FormData, cheie: string): string | null {
  const valoare = text(date, cheie);
  if (valoare.length === 0) return null;
  const moment = new Date(valoare);
  return Number.isNaN(moment.getTime()) ? null : moment.toISOString();
}

function ButonConfirmare({
  eticheta,
  pictograma,
  varianta = "secundar",
  titlu,
  consecinta,
  etichetaConfirmare,
  distructiv = false,
  executa,
  mesajReusita,
}: {
  readonly eticheta: string;
  readonly pictograma: ReactElement;
  readonly varianta?: "primar" | "secundar" | "distructiv";
  readonly titlu: string;
  readonly consecinta: string;
  readonly etichetaConfirmare: string;
  readonly distructiv?: boolean;
  readonly executa: () => Promise<ActionResult<unknown>>;
  readonly mesajReusita: string;
}): ReactElement {
  const router = useRouter();
  const [deschis, setDeschis] = useState(false);
  const [inCurs, porneste] = useTransition();

  function confirma(): void {
    porneste(async () => {
      const rezultat = await executa();
      if (!rezultat.ok) {
        arataToast({ fel: "eroare", text: rezultat.error.message });
        return;
      }
      setDeschis(false);
      arataToast({ fel: "reusita", text: mesajReusita });
      router.refresh();
    });
  }

  return (
    <>
      <Buton
        varianta={varianta}
        onClick={() => {
          setDeschis(true);
        }}
      >
        {pictograma}
        {eticheta}
      </Buton>
      <ConfirmareActiune
        deschis={deschis}
        laInchidere={() => {
          setDeschis(false);
        }}
        titlu={titlu}
        consecinta={consecinta}
        etichetaConfirmare={etichetaConfirmare}
        distructiv={distructiv}
        inCurs={inCurs}
        laConfirmare={confirma}
      />
    </>
  );
}

export function ActiuniSesizare({
  sesizareId,
  status,
  actor,
  areFisa,
  atribuitaMie,
  atribuit,
  descriere,
  urgenta,
  angajati,
  azi,
  oprireDeschisa,
}: Proprietati): ReactElement | null {
  const router = useRouter();
  const [motivTip, setMotivTip] = useState<string>("altul");
  const tranzitii: readonly TranzitieSesizare[] = tranzitiiPermise(status, actor);
  const deschisa =
    status === "nou" ||
    status === "in_analiza" ||
    status === "in_lucru" ||
    status === "in_asteptare";
  const poateAtribui = actor.poateGestiona && deschisa;
  const poatePrelua = poateAtribui && areFisa && !atribuitaMie;
  const poateEdita = raportorulPoateEdita(status, actor);

  if (tranzitii.length === 0 && !poateAtribui && !poateEdita) return null;

  /** Schimbarea simplă de stare, pe acțiunea actorului care apasă. */
  function schimbaStarea(
    tinta: "in_analiza" | "in_lucru" | "in_asteptare",
  ): () => Promise<ActionResult<unknown>> {
    if (actor.poateGestiona) {
      return () => trieazaSesizare({ id: sesizareId, status: tinta, motiv_respingere: null });
    }
    if (tinta === "in_analiza") {
      // Structura n-o oferă tehnicianului; ramura există doar pentru exhaustivitate.
      return () => tehnicianSchimbaStarea({ id: sesizareId, status: "in_lucru" });
    }
    return () => tehnicianSchimbaStarea({ id: sesizareId, status: tinta });
  }

  async function atribuie(date: FormData) {
    const ales = text(date, "atribuit_employee_id");
    return atribuieSesizare({
      id: sesizareId,
      atribuit_employee_id: ales.length === 0 ? null : ales,
      eu: false,
    });
  }

  async function editeaza(date: FormData) {
    return actualizeazaSesizare({
      id: sesizareId,
      descriere: text(date, "descriere"),
      urgenta: text(date, "urgenta"),
    });
  }

  async function respinge(date: FormData) {
    const tip = text(date, "motiv_respingere_tip") || "altul";
    const original = UUID.exec(text(date, "duplicat_al"))?.[0] ?? null;
    return trieazaSesizare({
      id: sesizareId,
      status: "respins",
      motiv_respingere: text(date, "motiv_respingere"),
      motiv_respingere_tip: tip,
      duplicat_al_id: tip === "duplicat" ? original : null,
    });
  }

  async function redeschide(date: FormData) {
    return redeschideSesizare({
      id: sesizareId,
      motiv_redeschidere: text(date, "motiv_redeschidere"),
    });
  }

  async function rezolva(date: FormData) {
    const nota = text(date, "nota_rezolvare");
    return rezolvaSesizare({
      id: sesizareId,
      ...valoriInterventie(date),
      repus_in_functiune_la: momentSauNull(date, "repus_in_functiune_la"),
      nota_rezolvare: nota.length === 0 ? null : nota,
    });
  }

  // Redeschiderea e „rezolvat → in_lucru” în mașina de stări, dar ca gest are
  // text (motivul), deci iese din rândul schimbărilor simple.
  const redeschidere = status === "rezolvat" && tranzitii.includes("in_lucru");

  return (
    <div className="flex flex-wrap items-center gap-2">
      {poateAtribui ? (
        <FormularDialog
          declansator={{
            eticheta: atribuit === null ? "Atribuie" : "Schimbă tehnicianul",
            varianta: "secundar",
            pictograma: <UserPlus aria-hidden="true" className="size-4" />,
          }}
          titlu={atribuit === null ? "Atribuiți sesizarea" : "Schimbați tehnicianul"}
          descriere="Tehnicianul atribuit vede sesizarea în portalul lui, o poate începe, pune în așteptare și rezolva, indiferent de rolul lui în aplicație. Primește o notificare."
          marime="mediu"
          actiune={atribuie}
          mesajReusita="Atribuirea a fost salvată."
          etichetaTrimite="Salvează atribuirea"
          textInCurs="Se salvează…"
        >
          {(stare, idc) => (
            <Camp
              nume="atribuit_employee_id"
              id={idc("tehnician")}
              eticheta="Tehnician"
              fel="select"
              erori={stare.erori["atribuit_employee_id"] ?? []}
              ajutor={
                status === "nou" || status === "in_analiza"
                  ? "Lăsați „Fără tehnician” ca să luați atribuirea înapoi."
                  : "O sesizare în lucru rămâne atribuită cuiva: alegeți alt tehnician, nu niciunul."
              }
            >
              {(a) => (
                <select
                  {...a}
                  defaultValue={stare.valoriTrimise["atribuit_employee_id"] ?? atribuit ?? ""}
                >
                  {status === "nou" || status === "in_analiza" ? (
                    <option value="">Fără tehnician</option>
                  ) : null}
                  {angajati.map((ang) => (
                    <option key={ang.id} value={ang.id}>
                      {ang.nume}
                    </option>
                  ))}
                </select>
              )}
            </Camp>
          )}
        </FormularDialog>
      ) : null}

      {poatePrelua ? (
        <ButonConfirmare
          eticheta="Preiau eu"
          pictograma={<Wrench aria-hidden="true" className="size-4" />}
          titlu="Preluați sesizarea?"
          consecinta="Sesizarea vă e atribuită dvs.: apare în lista dvs. de lucrat, iar raportorul vede că e în grija cuiva. Starea nu se schimbă până n-o treceți „În lucru”."
          etichetaConfirmare="Preiau sesizarea"
          executa={() => atribuieSesizare({ id: sesizareId, atribuit_employee_id: null, eu: true })}
          mesajReusita="Sesizarea v-a fost atribuită."
        />
      ) : null}

      {poateEdita ? (
        <FormularDialog
          declansator={{
            eticheta: "Editează",
            varianta: "secundar",
            pictograma: <Pencil aria-hidden="true" className="size-4" />,
          }}
          titlu="Completați sesizarea"
          descriere="Descrierea și urgența se pot schimba cât timp sesizarea e nouă — adică până o preia cineva."
          marime="mediu"
          actiune={editeaza}
          mesajReusita="Sesizarea a fost actualizată."
          etichetaTrimite="Salvează"
          textInCurs="Se salvează…"
        >
          {(stare, idc) => (
            <>
              <Camp
                nume="descriere"
                id={idc("descriere")}
                eticheta="Ce s-a defectat?"
                obligatoriu
                fel="textarea"
                ajutor="Cel puțin 10 caractere."
                erori={stare.erori["descriere"] ?? []}
              >
                {(a) => (
                  <textarea
                    {...a}
                    rows={4}
                    maxLength={2000}
                    defaultValue={stare.valoriTrimise["descriere"] ?? descriere}
                  />
                )}
              </Camp>
              <Camp
                nume="urgenta"
                id={idc("urgenta")}
                eticheta="Urgență"
                fel="select"
                erori={stare.erori["urgenta"] ?? []}
              >
                {(a) => (
                  <select {...a} defaultValue={stare.valoriTrimise["urgenta"] ?? urgenta}>
                    {URGENTE_SESIZARE.map((u) => (
                      <option key={u} value={u}>
                        {ETICHETE_URGENTA_SESIZARE[u]}
                      </option>
                    ))}
                  </select>
                )}
              </Camp>
            </>
          )}
        </FormularDialog>
      ) : null}

      {tranzitii.includes("in_analiza") ? (
        <ButonConfirmare
          eticheta={ETICHETE_STATUS_SESIZARE.in_analiza}
          pictograma={<Search aria-hidden="true" className="size-4" />}
          titlu="Treceți sesizarea în „În analiză”?"
          consecinta={CONSECINTA.in_analiza}
          etichetaConfirmare="Trece în „În analiză”"
          executa={schimbaStarea("in_analiza")}
          mesajReusita="Sesizarea e acum „În analiză”."
        />
      ) : null}

      {tranzitii.includes("in_lucru") && !redeschidere ? (
        <ButonConfirmare
          eticheta={status === "in_asteptare" ? "Reia lucrul" : "Începe lucrul"}
          pictograma={<Wrench aria-hidden="true" className="size-4" />}
          titlu="Treceți sesizarea în „În lucru”?"
          consecinta={
            atribuit === null && actor.poateGestiona
              ? "Sesizarea nu e atribuită nimănui: atribuiți-o întâi unui tehnician (sau „Preiau eu”), apoi treceți-o în lucru. Baza refuză o sesizare în lucru fără tehnician."
              : CONSECINTA.in_lucru
          }
          etichetaConfirmare="Trece în „În lucru”"
          executa={schimbaStarea("in_lucru")}
          mesajReusita="Sesizarea e acum „În lucru”."
        />
      ) : null}

      {tranzitii.includes("in_asteptare") ? (
        <ButonConfirmare
          eticheta="Pune în așteptare"
          pictograma={<Clock aria-hidden="true" className="size-4" />}
          titlu="Puneți sesizarea în așteptare?"
          consecinta={CONSECINTA.in_asteptare}
          etichetaConfirmare="Pune în așteptare"
          executa={schimbaStarea("in_asteptare")}
          mesajReusita="Sesizarea e acum „În așteptare”."
        />
      ) : null}

      {tranzitii.includes("rezolvat") ? (
        <FormularDialog
          declansator={{
            eticheta: "Rezolvă",
            varianta: "primar",
            pictograma: <Check aria-hidden="true" className="size-4" />,
          }}
          titlu="Rezolvați sesizarea"
          descriere="Rezolvarea înregistrează intervenția care a remediat defecțiunea. Raportorul primește o notificare și confirmă; fără răspuns, sesizarea se închide singură după câteva zile."
          marime="lucru"
          actiune={rezolva}
          mesajReusita="Sesizarea a fost rezolvată, iar intervenția e în registru."
          etichetaTrimite="Confirmă rezolvarea"
          textInCurs="Se salvează…"
          laReusita={() => {
            router.refresh();
          }}
        >
          {(stare, idc) => (
            <div className="space-y-4">
              <CampuriInterventie
                stare={stare}
                idc={idc}
                angajati={angajati}
                tipImplicit="corectiva"
                dataImplicita={azi}
              />
              <div className="grid gap-3 sm:grid-cols-2">
                {oprireDeschisa ? (
                  <Camp
                    nume="repus_in_functiune_la"
                    id={idc("repus")}
                    eticheta="Echipamentul funcționează din nou de la"
                    ajutor="Lăsați gol dacă funcționează de acum. Oprirea din jurnal se închide la momentul ales."
                    erori={stare.erori["repus_in_functiune_la"] ?? []}
                  >
                    {(a) => (
                      <input
                        {...a}
                        type="datetime-local"
                        defaultValue={stare.valoriTrimise["repus_in_functiune_la"] ?? ""}
                      />
                    )}
                  </Camp>
                ) : null}
                <Camp
                  nume="nota_rezolvare"
                  id={idc("nota")}
                  eticheta="Mesaj pentru raportor"
                  fel="textarea"
                  ajutor="Ce vede cel care a raportat, în notificare — pe scurt, ce s-a reparat."
                  className={oprireDeschisa ? "" : "sm:col-span-2"}
                  erori={stare.erori["nota_rezolvare"] ?? []}
                >
                  {(a) => (
                    <textarea
                      {...a}
                      rows={2}
                      maxLength={2000}
                      defaultValue={stare.valoriTrimise["nota_rezolvare"] ?? ""}
                    />
                  )}
                </Camp>
              </div>
            </div>
          )}
        </FormularDialog>
      ) : null}

      {tranzitii.includes("inchis") ? (
        <ButonConfirmare
          eticheta="Confirmă rezolvarea"
          varianta="primar"
          pictograma={<CheckCheck aria-hidden="true" className="size-4" />}
          titlu="Confirmați rezolvarea?"
          consecinta={CONSECINTA.inchis}
          etichetaConfirmare="Confirmă și închide"
          executa={() => inchideSesizare({ id: sesizareId })}
          mesajReusita="Sesizarea a fost închisă."
        />
      ) : null}

      {redeschidere ? (
        <FormularDialog
          declansator={{
            eticheta: "Redeschide",
            varianta: "secundar",
            pictograma: <RotateCcw aria-hidden="true" className="size-4" />,
          }}
          titlu="Redeschideți sesizarea?"
          descriere="Defecțiunea persistă sau a revenit. Sesizarea se întoarce „În lucru” la același tehnician, iar intervenția înregistrată rămâne în istoric."
          marime="mediu"
          actiune={redeschide}
          mesajReusita="Sesizarea a fost redeschisă."
          etichetaTrimite="Redeschide sesizarea"
          textInCurs="Se redeschide…"
        >
          {(stare, idc) => (
            <Camp
              nume="motiv_redeschidere"
              id={idc("motiv-redeschidere")}
              eticheta="Ce nu e în regulă"
              obligatoriu
              fel="textarea"
              ajutor="Cel puțin 5 caractere. Tehnicianul îl vede în notificare."
              erori={stare.erori["motiv_redeschidere"] ?? []}
            >
              {(a) => (
                <textarea
                  {...a}
                  rows={3}
                  maxLength={1000}
                  defaultValue={stare.valoriTrimise["motiv_redeschidere"] ?? ""}
                />
              )}
            </Camp>
          )}
        </FormularDialog>
      ) : null}

      {tranzitii.includes("retrasa") ? (
        <ButonConfirmare
          eticheta="Retrage"
          varianta="distructiv"
          pictograma={<Undo2 aria-hidden="true" className="size-4" />}
          titlu="Retrageți sesizarea?"
          consecinta={CONSECINTA.retrasa}
          etichetaConfirmare="Retrage sesizarea"
          distructiv
          executa={() => retrageSesizare({ id: sesizareId })}
          mesajReusita="Sesizarea a fost retrasă."
        />
      ) : null}

      {tranzitii.includes("respins") ? (
        <FormularDialog
          declansator={{
            eticheta: "Respinge",
            varianta: "distructiv",
            pictograma: <X aria-hidden="true" className="size-4" />,
          }}
          titlu="Respingeți sesizarea?"
          descriere="Respingerea e definitivă: sesizarea nu se mai redeschide, iar cel care a raportat-o vede motivul pe ecranul lui. O defecțiune reală se raportează din nou, cu detaliile cerute aici."
          marime="mediu"
          actiune={respinge}
          mesajReusita="Sesizarea a fost respinsă."
          etichetaTrimite="Respinge sesizarea"
          variantaTrimite="distructiv"
          textInCurs="Se respinge…"
          laResetare={() => {
            setMotivTip("altul");
          }}
        >
          {(stare, idc) => (
            <>
              <Camp
                nume="motiv_respingere_tip"
                id={idc("motiv-tip")}
                eticheta="Motivul, din listă"
                fel="select"
                erori={stare.erori["motiv_respingere_tip"] ?? []}
              >
                {(a) => (
                  <select
                    {...a}
                    value={motivTip}
                    onChange={(e) => {
                      setMotivTip(e.target.value);
                    }}
                  >
                    {MOTIVE_RESPINGERE.map((m) => (
                      <option key={m} value={m}>
                        {ETICHETE_MOTIV_RESPINGERE[m]}
                      </option>
                    ))}
                  </select>
                )}
              </Camp>
              {motivTip === "duplicat" ? (
                <Camp
                  nume="duplicat_al"
                  id={idc("duplicat")}
                  eticheta="Sesizarea originală"
                  obligatoriu
                  ajutor="Lipiți linkul sesizării originale (din bara de adrese) sau identificatorul ei."
                  erori={stare.erori["duplicat_al_id"] ?? []}
                >
                  {(a) => <input {...a} defaultValue={stare.valoriTrimise["duplicat_al"] ?? ""} />}
                </Camp>
              ) : null}
              <Camp
                nume="motiv_respingere"
                id={idc("motiv")}
                eticheta="Explicația pentru raportor"
                obligatoriu
                fel="textarea"
                ajutor="Cel puțin 5 caractere. Spuneți-i ce să verifice sau unde să raporteze."
                erori={stare.erori["motiv_respingere"] ?? []}
              >
                {(a) => (
                  <textarea
                    {...a}
                    rows={3}
                    maxLength={500}
                    defaultValue={stare.valoriTrimise["motiv_respingere"] ?? ""}
                  />
                )}
              </Camp>
            </>
          )}
        </FormularDialog>
      ) : null}
    </div>
  );
}
