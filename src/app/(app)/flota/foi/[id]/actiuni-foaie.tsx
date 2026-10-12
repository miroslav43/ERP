"use client";

import { useState, useTransition } from "react";
import { useRouter } from "next/navigation";

import { Buton } from "@/components/ui/buton";
import { Camp } from "@/components/ui/camp";
import { ConfirmareActiune } from "@/components/ui/dialog";
import { arataToast } from "@/components/ui/toast";
import { oraRomanieiPentruCamp } from "@/lib/format/date";
import type { StatusFoaie } from "@/schemas/fleet";

import {
  adaugaAlimentare,
  redeschideFoaie,
  retrageFoaie,
  stergeFoaie,
  trimiteFoaie,
} from "../../actions";

type Erori = Readonly<Record<string, readonly string[]>>;

/**
 * Trimiterea, retragerea, redeschiderea și ștergerea foii zilnice, plus
 * alimentările.
 *
 * Ce arată fiecare stare urmează EXACT regulile din
 * `internal.foi_parcurs_inainte` după 0197 (§D1), nu o aproximare a lor:
 *   - `draft`: trimiterea, alimentarea, ștergerea ciornei;
 *   - `trimis`: doar „Retrage în ciornă”. Baza nu mai lasă nimic altceva pe o
 *     foaie în aprobare — nici alimentări, nici curse —, ca aprobatorul să
 *     semneze cifrele pe care le vede;
 *   - `respins`: doar „Redeschide”. Din `respins` baza nu permite trimiterea
 *     directă și nicio corectură înainte de revenirea în ciornă.
 * Ascunderea nu e barieră: regula rămâne în bază.
 *
 * Trimiterea nu mai cere sosirea: o dau cursele (0197). Un refuz al bazei la
 * trimitere (cursă neîncheiată, regres de kilometraj) se arată ca TEXT, nu „pe
 * câmp”: câmpurile vinovate sunt în casetele curselor, nu în formularul ăsta.
 * Orele se arată și se trimit în ora României.
 */
export function ActiuniFoaie({
  id,
  status,
  plecareLa,
  sosireLa,
  areCurse,
  bazaFoi,
}: {
  readonly id: string;
  readonly status: StatusFoaie;
  readonly plecareLa: string;
  readonly sosireLa: string | null;
  /** Foaia are cel puțin o cursă. Fără ele baza refuză trimiterea. */
  readonly areCurse: boolean;
  /** Unde duce lista după ștergerea ciornei: `/flota/foi` sau `/portal/masina-mea`. */
  readonly bazaFoi: string;
}) {
  const router = useRouter();
  // Câte o tranziție per formular: una singură pentru amândouă dezactiva butonul
  // „Adaugă alimentarea” cât timp se trimitea foaia, și invers — două acțiuni
  // fără nicio legătură care se blocau una pe alta.
  const [seInchide, porneste] = useTransition();
  const [seAlimenteaza, pornesteAlimentarea] = useTransition();
  const [eroareInchidere, setEroareInchidere] = useState<string | null>(null);
  const [eroriInchidere, setEroriInchidere] = useState<Erori>({});
  const [eroareAlimentare, setEroareAlimentare] = useState<string | null>(null);
  const [eroriAlimentare, setEroriAlimentare] = useState<Erori>({});
  const [avertisment, setAvertisment] = useState<string | null>(null);
  const [seRedeschide, pornesteRedeschiderea] = useTransition();
  const [eroareRedeschidere, setEroareRedeschidere] = useState<string | null>(null);
  const [seSterge, pornesteStergerea] = useTransition();
  const [confirmaStergerea, setConfirmaStergerea] = useState(false);

  const sePoateTrimite = status === "draft";
  // 0197 §D1: alimentările urmează starea foii, deci doar pe ciornă.
  const sePoateAlimenta = status === "draft";
  const plecareCamp = oraRomanieiPentruCamp(plecareLa);
  const sosireCamp = sosireLa === null ? null : oraRomanieiPentruCamp(sosireLa);

  function inchide(formular: FormData): void {
    setAvertisment(null);
    setEroriInchidere({});
    if (!areCurse) {
      setEroareInchidere(
        "Adăugați cursele zilei (de unde, până unde, scopul și kilometrii) înainte de a trimite foaia.",
      );
      return;
    }
    setEroareInchidere(null);
    porneste(async () => {
      const rezultat = await trimiteFoaie({
        id,
        observatii: String(formular.get("observatii") ?? "").trim() || null,
      });
      if (!rezultat.ok) {
        // Mesajul bazei, întreg: „Încheiați toate cursele…”, „Kilometrajul de
        // plecare (9000 km) este mai mic…”. Câmpul lui nu e în formularul ăsta.
        setEroriInchidere({ observatii: rezultat.error.fieldErrors?.["observatii"] ?? [] });
        setEroareInchidere(rezultat.error.message);
        return;
      }
      // Saltul de kilometraj nu e o eroare — foaia s-a salvat. E o observație pe
      // care cineva trebuie să o explice, din ecranul de anomalii.
      setAvertisment(rezultat.data.anomalie);
      router.refresh();
    });
  }

  function alimenteaza(formular: FormData): void {
    const cand = String(formular.get("alimentat_la") ?? "");
    const litri = String(formular.get("litri") ?? "").trim();
    const cost = String(formular.get("cost") ?? "").trim();
    const lipsa: Record<string, string[]> = {};
    if (cand.length === 0) lipsa.alimentat_la = ["Completați data și ora alimentării."];
    else if (cand < plecareCamp || (sosireCamp !== null && cand > sosireCamp)) {
      lipsa.alimentat_la = [
        sosireCamp === null
          ? "Alimentarea nu poate fi înainte de plecarea cursei."
          : "Alimentarea trebuie să fie între plecarea și sosirea cursei.",
      ];
    }
    if (litri.length === 0 || Number(litri) <= 0) {
      lipsa.litri = ["Scrieți câți litri s-au alimentat (mai mult de zero)."];
    }
    if (cost.length === 0) lipsa.cost = ["Scrieți costul alimentării, în lei."];
    setEroriAlimentare(lipsa);
    if (Object.keys(lipsa).length > 0) {
      setEroareAlimentare("Corectați câmpurile marcate.");
      return;
    }
    setEroareAlimentare(null);
    pornesteAlimentarea(async () => {
      const rezultat = await adaugaAlimentare({
        trip_sheet_id: id,
        litri: Number(litri),
        cost: Number(cost),
        statie: String(formular.get("statie") ?? "").trim() || null,
        numar_bon: String(formular.get("numar_bon") ?? "").trim() || null,
        alimentat_la: cand,
        plin: formular.get("plin") === "on",
        observatii: String(formular.get("observatii") ?? "").trim() || null,
      });
      if (!rezultat.ok) {
        setEroriAlimentare(rezultat.error.fieldErrors ?? {});
        setEroareAlimentare(
          rezultat.error.fieldErrors === null
            ? rezultat.error.message
            : "Corectați câmpurile marcate.",
        );
        return;
      }
      router.refresh();
    });
  }

  function redeschide(): void {
    setEroareRedeschidere(null);
    pornesteRedeschiderea(async () => {
      // Aceeași casetă pentru cele două drumuri înapoi în ciornă: din
      // `respins` (redeschiderea) și din `trimis` (retragerea).
      const rezultat =
        status === "trimis" ? await retrageFoaie({ id }) : await redeschideFoaie({ id });
      if (!rezultat.ok) {
        setEroareRedeschidere(rezultat.error.message);
        return;
      }
      router.refresh();
    });
  }

  function sterge(): void {
    pornesteStergerea(async () => {
      const rezultat = await stergeFoaie({ id });
      if (!rezultat.ok) {
        arataToast({ fel: "eroare", text: rezultat.error.message });
        return;
      }
      setConfirmaStergerea(false);
      arataToast({ fel: "reusita", text: "Ciorna a fost ștearsă." });
      router.push(bazaFoi);
    });
  }

  return (
    <section aria-label="Acțiuni" className="space-y-4">
      {avertisment === null ? null : (
        <p
          role="status"
          className="border-warning/40 bg-warning/12 text-foreground rounded-panou text-corp border p-3"
        >
          {avertisment}
        </p>
      )}

      {status === "respins" || status === "trimis" ? (
        <div className="border-border rounded-panou flex flex-wrap items-center gap-3 border p-4">
          <p className="text-corp grow">
            {status === "respins"
              ? "Foaia a fost respinsă. Redeschideți-o ca ciornă, corectați-o și trimiteți-o din nou."
              : "Foaia așteaptă aprobarea și nu se mai modifică. Dacă ați greșit ceva, retrageți-o în ciornă, corectați-o și trimiteți-o din nou; numărul ei rămâne același."}
          </p>
          <Buton
            type="button"
            varianta={status === "respins" ? "primar" : "secundar"}
            inCurs={seRedeschide}
            textInCurs={status === "respins" ? "Se redeschide…" : "Se retrage…"}
            onClick={redeschide}
          >
            {status === "respins" ? "Redeschide foaia" : "Retrage în ciornă"}
          </Buton>
          {eroareRedeschidere === null ? null : (
            <p role="alert" className="text-danger text-corp w-full">
              {eroareRedeschidere}
            </p>
          )}
        </div>
      ) : null}

      {sePoateTrimite ? (
        <form
          action={inchide}
          noValidate
          className="border-border rounded-panou grid gap-3 border p-4 sm:grid-cols-3"
        >
          <p className="text-corp font-medium sm:col-span-3">Trimite foaia zilei spre aprobare</p>
          <p className="text-muted-foreground text-corp sm:col-span-3">
            Ora și kilometrajul zilei vin din curse. După trimitere foaia primește număr și nu se
            mai modifică decât retrasă în ciornă.
          </p>
          <Camp
            nume="observatii"
            id="foaie-observatii"
            eticheta="Observații"
            fel="textarea"
            ajutor="Ce s-a întâmplat pe drum: ocoluri, opriri, defecte. Gol = rămân cele de la plecare."
            className="sm:col-span-3"
            erori={eroriInchidere["observatii"] ?? []}
          >
            {(a) => <textarea {...a} maxLength={1000} rows={2} />}
          </Camp>
          <div className="flex flex-wrap items-end gap-3 sm:col-span-3">
            <Buton type="submit" varianta="primar" inCurs={seInchide} textInCurs="Se trimite…">
              Trimite spre aprobare
            </Buton>
            <Buton
              type="button"
              varianta="tertiar"
              onClick={() => {
                setConfirmaStergerea(true);
              }}
            >
              Șterge ciorna
            </Buton>
          </div>
          {eroareInchidere === null ? null : (
            <p role="alert" className="text-danger text-corp sm:col-span-3">
              {eroareInchidere}
            </p>
          )}
        </form>
      ) : null}

      <ConfirmareActiune
        deschis={confirmaStergerea}
        laInchidere={() => {
          setConfirmaStergerea(false);
        }}
        titlu="Ștergeți ciorna?"
        consecinta="Foaia, cu cursele și alimentările ei, iese din listă și nu se mai poate readuce. Ziua rămâne liberă pentru o foaie nouă pe acest vehicul."
        etichetaConfirmare="Șterge ciorna"
        distructiv
        inCurs={seSterge}
        laConfirmare={sterge}
      />

      {!sePoateAlimenta ? null : (
        <form
          action={alimenteaza}
          noValidate
          className="border-border rounded-panou grid gap-3 border p-4 sm:grid-cols-4"
        >
          <p className="text-corp font-medium sm:col-span-4">Adaugă o alimentare</p>
          {/* Baza respinge o alimentare din afara intervalului cursei; `min` și
              `max` o spun din calendar, iar verificarea de mai sus o spune în
              cuvinte, pe câmp. `max` se pune doar când cursa e închisă: pentru
              una deschisă, „acum” calculat în client ar diferi de randarea de pe
              server și ar produce nepotrivire la hidratare. */}
          <Camp
            nume="alimentat_la"
            id="alimentare-cand"
            eticheta="Când"
            obligatoriu
            erori={eroriAlimentare["alimentat_la"] ?? []}
          >
            {(a) => (
              <input
                {...a}
                type="datetime-local"
                min={plecareCamp}
                {...(sosireCamp === null ? {} : { max: sosireCamp })}
              />
            )}
          </Camp>
          <Camp
            nume="litri"
            id="alimentare-litri"
            eticheta="Litri"
            obligatoriu
            erori={eroriAlimentare["litri"] ?? []}
          >
            {(a) => <input {...a} type="number" min="0.01" step="0.01" />}
          </Camp>
          <Camp
            nume="cost"
            id="alimentare-cost"
            eticheta="Cost (lei)"
            obligatoriu
            erori={eroriAlimentare["cost"] ?? []}
          >
            {(a) => <input {...a} type="number" min="0" step="0.01" />}
          </Camp>
          <Camp
            nume="statie"
            id="alimentare-statie"
            eticheta="Stație"
            erori={eroriAlimentare["statie"] ?? []}
          >
            {(a) => <input {...a} maxLength={120} />}
          </Camp>
          <Camp
            nume="numar_bon"
            id="alimentare-bon"
            eticheta="Număr bon"
            ajutor="Același bon nu se poate trece de două ori pe foaie."
            erori={eroriAlimentare["numar_bon"] ?? []}
          >
            {(a) => <input {...a} maxLength={60} />}
          </Camp>
          <Camp
            nume="observatii"
            id="alimentare-observatii"
            eticheta="Observații"
            className="sm:col-span-2"
            erori={eroriAlimentare["observatii"] ?? []}
          >
            {(a) => <input {...a} maxLength={500} />}
          </Camp>
          <label className="text-corp flex items-center gap-2 self-end pb-2">
            <input type="checkbox" name="plin" className="size-4" />
            Plin făcut
          </label>
          <div className="flex flex-wrap items-center gap-3 sm:col-span-4">
            <Buton
              type="submit"
              varianta="secundar"
              inCurs={seAlimenteaza}
              textInCurs="Se salvează…"
            >
              Adaugă alimentarea
            </Buton>
            {eroareAlimentare === null ? null : (
              <p role="alert" className="text-danger text-corp">
                {eroareAlimentare}
              </p>
            )}
          </div>
        </form>
      )}
    </section>
  );
}
