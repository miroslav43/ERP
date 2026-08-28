// src/app/(app)/puncte-lucru/actiuni-punct-lucru.tsx
"use client";

import { useCallback, useId, useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { Ban, Pencil, Printer, QrCode, Undo2 } from "lucide-react";

import { Buton } from "@/components/ui/buton";
import { Camp, clasaBifa } from "@/components/ui/camp";
import { Formular } from "@/components/ui/formular";
import { JUDETE } from "@/schemas/organization";
import Link from "next/link";

import { buton } from "@/components/ui/buton";
import { cn } from "@/lib/ui/cn";
import {
  actualizeazaPunctLucru,
  dezactiveazaPunctLucru,
  reactiveazaPunctLucru,
  rotesteCodPontaj,
} from "./actions";

/**
 * Acțiunile unui rând din lista punctelor de lucru: editarea și dezactivarea.
 *
 * Sunt DOUĂ lucruri separate, deci rămân separate. Numai editarea trece prin
 * `<Formular>`: ea are câmpuri, deci și `fieldErrors` de arătat pe câmp, și
 * date de pierdut la resetul de după acțiune al lui React 19. Comutarea
 * activării n-are decât `id`, luat din props — acolo `useTransition` și un
 * mesaj sub butoane spun tot ce e de spus.
 *
 * Butonul e o COMUTARE, nu o dezactivare fără întoarcere: `activ: true` exista
 * într-un singur loc în modul, la creare, deci un punct de lucru dezactivat din
 * greșeală rămânea așa. Fiindcă acum se desface dintr-un clic, dezactivarea nu
 * cere confirmare — vezi nota din `departamente/actiuni-departament.tsx`.
 *
 * Identificatorii se prefixează cu `useId()`: componenta se randează o dată per
 * rând, mai multe rânduri pot fi deschise în același timp, iar `Camp` derivă
 * `id` din `nume` — `denumire`, `judet` și `oras` s-ar repeta pe pagină.
 */

interface Proprietati {
  readonly punct: Readonly<{
    id: string;
    denumire: string;
    adresa: string | null;
    judet: string | null;
    oras: string | null;
    cod_postal: string | null;
    sediu_principal: boolean;
    activ: boolean;
    observatii: string | null;
    /** `true` când punctul are deja un cod de pontare tipăribil (0096). */
    areCodPontaj: boolean;
  }>;
  readonly poateEdita: boolean;
}

export function ActiuniPunctLucru({ punct, poateEdita }: Proprietati) {
  const router = useRouter();
  const [editeaza, setEditeaza] = useState(false);
  const [inCurs, porneste] = useTransition();
  const [eroare, setEroare] = useState<string | null>(null);
  const idFormular = useId();
  const idc = (sufix: string): string => `${idFormular}-${sufix}`;

  // `useCallback`: `laReusita` intră în dependențele efectului din `Formular`;
  // o funcție nouă la fiecare randare ar scoate notificarea de două ori.
  const laReusita = useCallback((): void => {
    setEditeaza(false);
    router.refresh();
  }, [router]);

  if (!poateEdita) return null;

  /** Cheile obiectului sunt EXACT cele din `actualizeazaPunctLucruSchema`. */
  async function trimiteEditare(date: FormData) {
    // `judetSchema.nullable()` nu cunoaște șirul gol: „— Alegeți —” devine
    // `null` aici, nu în schemă.
    const judet = String(date.get("judet") ?? "");
    return actualizeazaPunctLucru({
      id: punct.id,
      denumire: String(date.get("denumire") ?? ""),
      adresa: String(date.get("adresa") ?? ""),
      judet: judet === "" ? null : judet,
      oras: String(date.get("oras") ?? ""),
      cod_postal: String(date.get("cod_postal") ?? ""),
      sediu_principal: date.get("sediu_principal") === "on",
      observatii: String(date.get("observatii") ?? ""),
    });
  }

  function comutaActivarea(): void {
    setEroare(null);
    porneste(async () => {
      const rezultat = punct.activ
        ? await dezactiveazaPunctLucru({ id: punct.id })
        : await reactiveazaPunctLucru({ id: punct.id });
      if (!rezultat.ok) {
        setEroare(rezultat.error.message);
        return;
      }
      router.refresh();
    });
  }

  function roteste(): void {
    setEroare(null);
    porneste(async () => {
      const rezultat = await rotesteCodPontaj({ id: punct.id });
      if (!rezultat.ok) {
        setEroare(rezultat.error.message);
        return;
      }
      router.refresh();
    });
  }

  return (
    <div className="space-y-2">
      <div className="text-nota flex flex-wrap gap-1">
        <Buton
          varianta="tertiar"
          onClick={() => {
            setEditeaza((v) => !v);
          }}
        >
          <Pencil aria-hidden="true" className="size-3.5" />
          Editează
        </Buton>
        {punct.activ ? (
          <Buton varianta="distructiv" onClick={comutaActivarea} disabled={inCurs}>
            <Ban aria-hidden="true" className="size-3.5" />
            Dezactivează
          </Buton>
        ) : (
          <Buton varianta="secundar" onClick={comutaActivarea} disabled={inCurs}>
            <Undo2 aria-hidden="true" className="size-3.5" />
            Reactivează
          </Buton>
        )}

        {/* Pontarea prin cod QR (0096). Butonul spune „Rotește", nu
            „Generează", când codul există deja: cine îl apasă trebuie să știe
            din eticheta lui că afișele lipite devin inutile. */}
        <Buton varianta="tertiar" onClick={roteste} disabled={inCurs}>
          <QrCode aria-hidden="true" className="size-3.5" />
          {punct.areCodPontaj ? "Rotește codul" : "Generează cod de pontare"}
        </Buton>
        {punct.areCodPontaj ? (
          <Link
            href={`/puncte-lucru/${punct.id}/afis`}
            className={cn(buton({ varianta: "tertiar" }), "text-nota")}
          >
            <Printer aria-hidden="true" className="size-3.5" />
            Afișul de tipărit
          </Link>
        ) : null}
      </div>

      {eroare === null ? null : (
        <p role="alert" className="text-danger text-nota">
          {eroare}
        </p>
      )}

      {editeaza ? (
        <Formular
          actiune={trimiteEditare}
          laReusita={laReusita}
          mesajReusita="Punctul de lucru a fost salvat."
          className="border-border rounded-control grid gap-2 border p-3 sm:grid-cols-2"
        >
          {(stare) => {
            // Într-un `FormData` o bifă NEBIFATĂ lipsește cu totul, deci „încă
            // nu s-a trimis nimic” și „s-a trimis nebifat” arată identic pe
            // cheia ei. Se disting uitându-ne dacă formularul a plecat măcar o
            // dată — altfel o bifă scoasă de om s-ar pune la loc la prima
            // eroare de validare.
            const sTrimis = Object.keys(stare.valoriTrimise).length > 0;
            const sediuPrincipal = sTrimis
              ? stare.valoriTrimise["sediu_principal"] === "on"
              : punct.sediu_principal;

            return (
              <>
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
                      defaultValue={stare.valoriTrimise["denumire"] ?? punct.denumire}
                    />
                  )}
                </Camp>

                <Camp
                  nume="judet"
                  id={idc("judet")}
                  eticheta="Județ"
                  fel="select"
                  erori={stare.erori["judet"] ?? []}
                >
                  {(a) => (
                    <select {...a} defaultValue={stare.valoriTrimise["judet"] ?? punct.judet ?? ""}>
                      <option value="">— Alegeți —</option>
                      {JUDETE.map((judet) => (
                        <option key={judet} value={judet}>
                          {judet}
                        </option>
                      ))}
                    </select>
                  )}
                </Camp>

                <Camp
                  nume="oras"
                  id={idc("oras")}
                  eticheta="Localitate"
                  erori={stare.erori["oras"] ?? []}
                >
                  {(a) => (
                    <input
                      {...a}
                      type="text"
                      maxLength={80}
                      defaultValue={stare.valoriTrimise["oras"] ?? punct.oras ?? ""}
                    />
                  )}
                </Camp>

                <Camp
                  nume="cod_postal"
                  id={idc("cod_postal")}
                  eticheta="Cod poștal"
                  erori={stare.erori["cod_postal"] ?? []}
                >
                  {(a) => (
                    <input
                      {...a}
                      type="text"
                      maxLength={10}
                      defaultValue={stare.valoriTrimise["cod_postal"] ?? punct.cod_postal ?? ""}
                    />
                  )}
                </Camp>

                <Camp
                  nume="adresa"
                  id={idc("adresa")}
                  eticheta="Adresă"
                  className="sm:col-span-2"
                  erori={stare.erori["adresa"] ?? []}
                >
                  {(a) => (
                    <input
                      {...a}
                      type="text"
                      maxLength={240}
                      defaultValue={stare.valoriTrimise["adresa"] ?? punct.adresa ?? ""}
                    />
                  )}
                </Camp>

                {/* Observațiile: `creeazaPunctLucruSchema` le acceptă de la
                    început și `puncte_lucru.observatii` se citea deja în
                    pagină, dar niciun ecran nu le arăta și niciun formular nu
                    le scria — coloana era moartă în ambele sensuri. */}
                <Camp
                  nume="observatii"
                  id={idc("observatii")}
                  eticheta="Observații"
                  fel="textarea"
                  ajutor="Program, acces, persoană de contact — ce trebuie știut despre locație."
                  className="sm:col-span-2"
                  erori={stare.erori["observatii"] ?? []}
                >
                  {(a) => (
                    <textarea
                      {...a}
                      maxLength={1000}
                      rows={2}
                      defaultValue={stare.valoriTrimise["observatii"] ?? punct.observatii ?? ""}
                    />
                  )}
                </Camp>

                {/* Bifa rămâne scrisă de mână: `Camp` pune eticheta ÎNAINTEA
                    controlului, iar la o casetă de bifat eticheta stă după —
                    altfel ținta de atingere se rupe în două și rândul se
                    citește invers. */}
                <div className="flex items-center gap-2 sm:col-span-2">
                  <input
                    id={idc("sediu_principal")}
                    name="sediu_principal"
                    type="checkbox"
                    defaultChecked={sediuPrincipal}
                    className={clasaBifa}
                  />
                  <label htmlFor={idc("sediu_principal")} className="text-foreground text-corp">
                    Sediu principal
                  </label>
                </div>

                <div className="sm:col-span-2">
                  <Buton
                    type="submit"
                    varianta="primar"
                    inCurs={stare.inCurs}
                    textInCurs="Se salvează…"
                  >
                    Salvează
                  </Buton>
                </div>
              </>
            );
          }}
        </Formular>
      ) : null}
    </div>
  );
}
