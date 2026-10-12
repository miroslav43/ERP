"use client";

import { Plus, Trash2 } from "lucide-react";
import { useRouter } from "next/navigation";
import { useCallback, useState, useTransition, type ReactElement } from "react";

import { Buton } from "@/components/ui/buton";
import { Camp } from "@/components/ui/camp";
import { ConfirmareActiune } from "@/components/ui/dialog";
import { FormularDialog } from "@/components/ui/formular-dialog";
import { arataToast } from "@/components/ui/toast";

import { adaugaPiesa, stergePiesa } from "../actions";

function text(date: FormData, cheie: string): string {
  return String(date.get(cheie) ?? "").trim();
}

/**
 * O linie de piese nouă (decizia D4). Valoarea (cantitate × preț) o calculează
 * baza, iar costul pieselor al intervenției devine suma liniilor — caseta o
 * spune, ca omul să nu caute unde să mai scrie suma.
 */
export function DialogPiesaNoua({ interventionId }: Readonly<{ interventionId: string }>) {
  const trimite = useCallback(
    async (date: FormData) => {
      const cod = text(date, "cod");
      return await adaugaPiesa({
        intervention_id: interventionId,
        denumire: text(date, "denumire"),
        cod: cod.length === 0 ? null : cod,
        cantitate: text(date, "cantitate"),
        unitate: text(date, "unitate") || "buc",
        pret_unitar: text(date, "pret_unitar") || "0",
      });
    },
    [interventionId],
  );

  return (
    <FormularDialog
      declansator={{
        eticheta: "Adaugă piesă",
        varianta: "secundar",
        pictograma: <Plus aria-hidden="true" className="size-4" />,
      }}
      titlu="Piesă folosită"
      descriere="Cât intervenția are linii de piese, costul pieselor e suma lor — suma scrisă de mână se înlocuiește."
      marime="mare"
      actiune={trimite}
      mesajReusita="Piesa a fost adăugată."
      etichetaTrimite="Adaugă piesa"
      textInCurs="Se adaugă…"
    >
      {(stare, idc) => {
        const trimise = stare.data === null ? stare.valoriTrimise : {};
        return (
          <div className="grid gap-3 sm:grid-cols-2">
            <Camp
              nume="denumire"
              id={idc("denumire")}
              eticheta="Denumire"
              obligatoriu
              className="sm:col-span-2"
              erori={stare.erori["denumire"] ?? []}
            >
              {(a) => <input {...a} maxLength={200} defaultValue={trimise["denumire"] ?? ""} />}
            </Camp>
            <Camp nume="cod" id={idc("cod")} eticheta="Cod piesă" erori={stare.erori["cod"] ?? []}>
              {(a) => <input {...a} maxLength={80} defaultValue={trimise["cod"] ?? ""} />}
            </Camp>
            <Camp
              nume="unitate"
              id={idc("unitate")}
              eticheta="Unitate de măsură"
              ajutor="buc, l, kg, m…"
              erori={stare.erori["unitate"] ?? []}
            >
              {(a) => <input {...a} maxLength={20} defaultValue={trimise["unitate"] ?? "buc"} />}
            </Camp>
            <Camp
              nume="cantitate"
              id={idc("cantitate")}
              eticheta="Cantitate"
              obligatoriu
              erori={stare.erori["cantitate"] ?? []}
            >
              {(a) => (
                <input
                  {...a}
                  type="number"
                  min="0.001"
                  step="0.001"
                  defaultValue={trimise["cantitate"] ?? "1"}
                />
              )}
            </Camp>
            <Camp
              nume="pret_unitar"
              id={idc("pret")}
              eticheta="Preț unitar (lei)"
              erori={stare.erori["pret_unitar"] ?? []}
            >
              {(a) => (
                <input
                  {...a}
                  type="number"
                  min="0"
                  step="0.01"
                  defaultValue={trimise["pret_unitar"] ?? "0"}
                />
              )}
            </Camp>
          </div>
        );
      }}
    </FormularDialog>
  );
}

/** Ștergerea logică a unei linii, cu consecința spusă: suma pieselor scade. */
export function ButonStergePiesa({
  id,
  denumire,
  ultima,
}: Readonly<{ id: string; denumire: string; ultima: boolean }>): ReactElement {
  const router = useRouter();
  const [deschis, setDeschis] = useState(false);
  const [inCurs, porneste] = useTransition();

  function confirma(): void {
    porneste(async () => {
      const rezultat = await stergePiesa({ id });
      if (!rezultat.ok) {
        arataToast({ fel: "eroare", text: rezultat.error.message });
        return;
      }
      setDeschis(false);
      arataToast({ fel: "reusita", text: "Piesa a fost ștearsă." });
      router.refresh();
    });
  }

  return (
    <>
      <Buton
        varianta="tertiar"
        marime="iconita"
        aria-label={`Șterge piesa ${denumire}`}
        onClick={() => {
          setDeschis(true);
        }}
      >
        <Trash2 aria-hidden="true" className="size-4" />
      </Buton>
      <ConfirmareActiune
        deschis={deschis}
        laInchidere={() => {
          setDeschis(false);
        }}
        titlu={`Ștergeți piesa „${denumire}”?`}
        consecinta={
          ultima
            ? "E ultima linie de piese: costul pieselor intervenției devine 0. Scrieți-l apoi de mână, prin corectare, dacă e cazul."
            : "Costul pieselor intervenției scade cu valoarea liniei."
        }
        etichetaConfirmare="Șterge piesa"
        distructiv
        inCurs={inCurs}
        laConfirmare={confirma}
      />
    </>
  );
}
