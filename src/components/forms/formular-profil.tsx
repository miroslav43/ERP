"use client";

import { useId, useState, useTransition } from "react";
import { useRouter } from "next/navigation";

import { IncarcareAvatar } from "@/components/forms/incarcare-avatar";
import { Buton } from "@/components/ui/buton";
import {
  actualizeazaProfilul,
  pregatesteIncarcareAvatarulPropriu,
  salveazaAvatarulPropriu,
  schimbaParola,
} from "@/lib/actions/profile";

interface ProprietatiFormularProfil {
  readonly numeInitial: string;
  readonly telefonInitial: string | null;
  readonly avatarUrlInitial: string | null;
}

/**
 * Un singur formular pentru date + un al doilea, separat, pentru parolă —
 * fiindcă succesul unuia nu trebuie să depindă de completarea celuilalt, iar
 * un submit accidental pe Enter în câmpul de nume nu trebuie să încerce să
 * schimbe și parola.
 */
export function FormularProfil({
  numeInitial,
  telefonInitial,
  avatarUrlInitial,
}: ProprietatiFormularProfil) {
  const router = useRouter();
  const [inCursDate, porniDate] = useTransition();
  const [eroareDate, setEroareDate] = useState<string | null>(null);
  const [reusitDate, setReusitDate] = useState(false);
  const idNume = useId();
  const idTelefon = useId();

  const [inCursParola, porniParola] = useTransition();
  const [eroareParola, setEroareParola] = useState<string | null>(null);
  const [reusitParola, setReusitParola] = useState(false);
  const idParolaNoua = useId();
  const idConfirmaParola = useId();

  function trimiteDate(formular: FormData): void {
    setEroareDate(null);
    setReusitDate(false);
    const telefon = String(formular.get("phone") ?? "").trim();
    porniDate(async () => {
      const rezultat = await actualizeazaProfilul({
        full_name: String(formular.get("full_name") ?? ""),
        phone: telefon.length === 0 ? null : telefon,
      });
      if (!rezultat.ok) {
        setEroareDate(rezultat.error.message);
        return;
      }
      setReusitDate(true);
      router.refresh();
    });
  }

  function trimiteParola(formular: FormData): void {
    setEroareParola(null);
    setReusitParola(false);
    porniParola(async () => {
      const rezultat = await schimbaParola({
        parola_noua: String(formular.get("parola_noua") ?? ""),
        confirma_parola: String(formular.get("confirma_parola") ?? ""),
      });
      if (!rezultat.ok) {
        setEroareParola(rezultat.error.message);
        return;
      }
      setReusitParola(true);
      (document.getElementById(idParolaNoua) as HTMLInputElement | null)?.form?.reset();
    });
  }

  return (
    <div className="space-y-6">
      <div className="border-border rounded-panou border p-4">
        <IncarcareAvatar
          urlInitial={avatarUrlInitial}
          nume={numeInitial}
          pregateste={pregatesteIncarcareAvatarulPropriu}
          salveaza={salveazaAvatarulPropriu}
        />
      </div>

      <form
        action={trimiteDate}
        className="border-border rounded-panou grid gap-4 border p-4 sm:grid-cols-2"
      >
        <p className="text-corp font-medium sm:col-span-2">Date de contact</p>

        <div className="flex flex-col gap-1">
          <label htmlFor={idNume} className="text-corp">
            Nume afișat
          </label>
          <input
            id={idNume}
            name="full_name"
            required
            maxLength={200}
            defaultValue={numeInitial}
            className="border-foreground/60 rounded-control text-corp border px-3 py-2"
          />
        </div>

        <div className="flex flex-col gap-1">
          <label htmlFor={idTelefon} className="text-corp">
            Telefon
          </label>
          <input
            id={idTelefon}
            name="phone"
            type="tel"
            maxLength={30}
            defaultValue={telefonInitial ?? ""}
            className="border-foreground/60 rounded-control text-corp border px-3 py-2"
          />
        </div>

        <div className="flex flex-wrap items-center gap-3 sm:col-span-2">
          <Buton varianta="primar" type="submit" inCurs={inCursDate} textInCurs="Se salvează…">
            Salvează datele
          </Buton>
          {eroareDate === null ? null : (
            <p role="alert" className="text-danger text-corp">
              {eroareDate}
            </p>
          )}
          {reusitDate ? (
            <p role="status" className="text-foreground text-corp">
              Datele au fost actualizate.
            </p>
          ) : null}
        </div>
      </form>

      <form
        action={trimiteParola}
        className="border-border rounded-panou grid gap-4 border p-4 sm:grid-cols-2"
      >
        <p className="text-corp font-medium sm:col-span-2">Schimbă parola</p>

        <div className="flex flex-col gap-1">
          <label htmlFor={idParolaNoua} className="text-corp">
            Parolă nouă
          </label>
          <input
            id={idParolaNoua}
            name="parola_noua"
            type="password"
            required
            minLength={8}
            autoComplete="new-password"
            className="border-foreground/60 rounded-control text-corp border px-3 py-2"
          />
        </div>

        <div className="flex flex-col gap-1">
          <label htmlFor={idConfirmaParola} className="text-corp">
            Confirmă parola
          </label>
          <input
            id={idConfirmaParola}
            name="confirma_parola"
            type="password"
            required
            minLength={8}
            autoComplete="new-password"
            className="border-foreground/60 rounded-control text-corp border px-3 py-2"
          />
        </div>

        <div className="flex flex-wrap items-center gap-3 sm:col-span-2">
          <Buton varianta="secundar" type="submit" inCurs={inCursParola} textInCurs="Se schimbă…">
            Schimbă parola
          </Buton>
          {eroareParola === null ? null : (
            <p role="alert" className="text-danger text-corp">
              {eroareParola}
            </p>
          )}
          {reusitParola ? (
            <p role="status" className="text-foreground text-corp">
              Parola a fost schimbată.
            </p>
          ) : null}
        </div>
      </form>
    </div>
  );
}
