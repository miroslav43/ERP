"use client";

import { useId, useState, useTransition } from "react";
import { useRouter } from "next/navigation";

import { Buton } from "@/components/ui/buton";
import { comunicaAccidentLaItm, finalizeazaCercetare } from "../../actions";

/**
 * Comunicarea la ITM și finalizarea cercetării — două formulare separate,
 * fiindcă sunt două acțiuni distincte în timp, cu propriile câmpuri.
 */
export function FormularComunicareItm({
  id,
  comunicatLaItm,
  cercetareFinalizata,
  zileIncapacitate,
}: {
  readonly id: string;
  readonly comunicatLaItm: string | null;
  readonly cercetareFinalizata: string | null;
  readonly zileIncapacitate: number;
}) {
  const router = useRouter();
  const [inCurs, porneste] = useTransition();
  const [eroareComunicare, setEroareComunicare] = useState<string | null>(null);
  const [eroareCercetare, setEroareCercetare] = useState<string | null>(null);

  const idComunicat = useId();
  const idPv = useId();
  const idCercetare = useId();
  const idUrmari = useId();
  const idZile = useId();

  function comunica(formular: FormData): void {
    setEroareComunicare(null);
    porneste(async () => {
      const numar = String(formular.get("numar_proces_verbal") ?? "").trim();
      const rezultat = await comunicaAccidentLaItm({
        id,
        comunicat_la_itm_la: String(formular.get("comunicat_la_itm_la") ?? ""),
        numar_proces_verbal: numar.length > 0 ? numar : null,
      });
      if (!rezultat.ok) {
        setEroareComunicare(rezultat.error.message);
        return;
      }
      router.refresh();
    });
  }

  function finalizeaza(formular: FormData): void {
    setEroareCercetare(null);
    porneste(async () => {
      const urmari = String(formular.get("urmari") ?? "").trim();
      const rezultat = await finalizeazaCercetare({
        id,
        cercetare_finalizata_la: String(formular.get("cercetare_finalizata_la") ?? ""),
        urmari: urmari.length > 0 ? urmari : null,
        zile_incapacitate: Number(formular.get("zile_incapacitate") ?? 0),
      });
      if (!rezultat.ok) {
        setEroareCercetare(rezultat.error.message);
        return;
      }
      router.refresh();
    });
  }

  return (
    <div className="space-y-4">
      {comunicatLaItm === null ? (
        <form
          action={comunica}
          className="border-border rounded-panou grid gap-3 border p-4 sm:grid-cols-2"
        >
          <p className="text-corp font-medium sm:col-span-2">Comunicare la ITM</p>
          <div className="flex flex-col gap-1">
            <label htmlFor={idComunicat} className="text-corp">
              Comunicat la
            </label>
            <input
              id={idComunicat}
              name="comunicat_la_itm_la"
              type="datetime-local"
              required
              className="border-foreground/60 rounded-control text-corp border px-3 py-2"
            />
          </div>
          <div className="flex flex-col gap-1">
            <label htmlFor={idPv} className="text-corp">
              Număr proces verbal (opțional)
            </label>
            <input
              id={idPv}
              name="numar_proces_verbal"
              maxLength={64}
              className="border-foreground/60 rounded-control text-corp border px-3 py-2"
            />
          </div>
          <div className="flex flex-wrap items-center gap-3 sm:col-span-2">
            <Buton type="submit" varianta="primar" inCurs={inCurs} textInCurs="Se salvează…">
              Marchează comunicat
            </Buton>
            {eroareComunicare === null ? null : (
              <p role="alert" className="text-danger text-corp">
                {eroareComunicare}
              </p>
            )}
          </div>
        </form>
      ) : null}

      {comunicatLaItm === null || cercetareFinalizata !== null ? null : (
        <form
          action={finalizeaza}
          className="border-border rounded-panou grid gap-3 border p-4 sm:grid-cols-2"
        >
          <p className="text-corp font-medium sm:col-span-2">Finalizarea cercetării</p>
          <div className="flex flex-col gap-1">
            <label htmlFor={idCercetare} className="text-corp">
              Cercetare finalizată la
            </label>
            <input
              id={idCercetare}
              name="cercetare_finalizata_la"
              type="date"
              required
              className="border-foreground/60 rounded-control text-corp border px-3 py-2"
            />
          </div>
          <div className="flex flex-col gap-1">
            <label htmlFor={idZile} className="text-corp">
              Zile de incapacitate (corectate)
            </label>
            <input
              id={idZile}
              name="zile_incapacitate"
              type="number"
              min={0}
              defaultValue={zileIncapacitate}
              className="border-foreground/60 rounded-control text-corp border px-3 py-2"
            />
          </div>
          <div className="flex flex-col gap-1 sm:col-span-2">
            <label htmlFor={idUrmari} className="text-corp">
              Urmări
            </label>
            <textarea
              id={idUrmari}
              name="urmari"
              rows={3}
              maxLength={2000}
              className="border-foreground/60 rounded-control text-corp border px-3 py-2"
            />
          </div>
          <div className="flex flex-wrap items-center gap-3 sm:col-span-2">
            <Buton type="submit" varianta="primar" inCurs={inCurs} textInCurs="Se salvează…">
              Finalizează cercetarea
            </Buton>
            {eroareCercetare === null ? null : (
              <p role="alert" className="text-danger text-corp">
                {eroareCercetare}
              </p>
            )}
          </div>
        </form>
      )}
    </div>
  );
}
