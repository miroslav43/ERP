"use client";

import { IncarcareAvatar } from "@/components/forms/incarcare-avatar";
import { Buton } from "@/components/ui/buton";
import { Camp } from "@/components/ui/camp";
import { Formular } from "@/components/ui/formular";
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
 *
 * ── CE S-A SCHIMBAT ȘI DE CE ──────────────────────────────────────────────
 * Ambele formulare erau `useTransition` + `<form action={fn}>` cu câmpuri
 * necontrolate. React 19 cere resetarea formularului după ce acțiunea se
 * încheie — INDIFERENT dacă a reușit sau a eșuat. Consecința măsurabilă: un om
 * își schimba numele afișat, greșea telefonul, primea „Textul nu poate depăși
 * 30 de caractere." și găsea ambele câmpuri întoarse la valorile de dinainte.
 * Munca lui dispărea din cauza unei erori de validare.
 *
 * `<Formular>` ține rezultatul prin `useActionState` și predă înapoi
 * `valoriTrimise`, deci după reset câmpurile își reiau exact conținutul trimis.
 *
 * A doua pierdere era a MESAJULUI. `schimbaParola` întoarce
 * `fieldErrors.confirma_parola = ["Parolele nu coincid."]` (vezi
 * `schemas/profile.ts:32-34`), iar ecranul afișa `error.message`, adică
 * „Datele introduse nu sunt valide.” — propoziția exactă exista pe fir și se
 * arunca. `<Camp erori>` o pune lângă câmpul vinovat și o leagă prin
 * `aria-describedby`.
 */
export function FormularProfil({
  numeInitial,
  telefonInitial,
  avatarUrlInitial,
}: ProprietatiFormularProfil) {
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

      <Formular
        className="border-border rounded-panou border p-4"
        mesajReusita="Datele au fost actualizate."
        actiune={async (date) => {
          const telefon = String(date.get("phone") ?? "").trim();
          return actualizeazaProfilul({
            full_name: String(date.get("full_name") ?? ""),
            // Telefonul gol se trimite ca `null`, nu ca "": schema îl
            // normalizează oricum, dar trimițând `null` explicit ecranul și
            // baza spun același lucru despre „lipsește”.
            phone: telefon.length === 0 ? null : telefon,
          });
        }}
      >
        {({ inCurs, erori, valoriTrimise }) => (
          <>
            <p className="text-corp font-medium">Date de contact</p>

            <div className="grid gap-4 sm:grid-cols-2">
              <Camp
                nume="full_name"
                eticheta="Nume afișat"
                obligatoriu
                {...(erori["full_name"] === undefined ? {} : { erori: erori["full_name"] })}
              >
                {(a) => (
                  <input
                    {...a}
                    maxLength={200}
                    autoComplete="name"
                    defaultValue={valoriTrimise["full_name"] ?? numeInitial}
                  />
                )}
              </Camp>

              <Camp
                nume="phone"
                eticheta="Telefon"
                {...(erori["phone"] === undefined ? {} : { erori: erori["phone"] })}
              >
                {(a) => (
                  <input
                    {...a}
                    type="tel"
                    maxLength={30}
                    autoComplete="tel"
                    defaultValue={valoriTrimise["phone"] ?? telefonInitial ?? ""}
                  />
                )}
              </Camp>
            </div>

            <div>
              <Buton varianta="primar" type="submit" inCurs={inCurs} textInCurs="Se salvează…">
                Salvează datele
              </Buton>
            </div>
          </>
        )}
      </Formular>

      <Formular
        className="border-border rounded-panou border p-4"
        mesajReusita="Parola a fost schimbată."
        actiune={async (date) =>
          schimbaParola({
            parola_noua: String(date.get("parola_noua") ?? ""),
            confirma_parola: String(date.get("confirma_parola") ?? ""),
          })
        }
      >
        {({ inCurs, erori }) => (
          <>
            <p className="text-corp font-medium">Schimbă parola</p>

            {/*
              Aici NU se restaurează `valoriTrimise`, spre deosebire de
              formularul de deasupra. O parolă întoarsă în `defaultValue` ar
              ajunge într-un atribut din DOM, vizibil oricui inspectează pagina
              sau face o captură a arborelui; iar retastarea unei parole e
              gestul normal după o greșeală, nu o pierdere de muncă. Golirea
              după trimitere e aici efectul dorit, nu defectul.
            */}
            <div className="grid gap-4 sm:grid-cols-2">
              <Camp
                nume="parola_noua"
                eticheta="Parolă nouă"
                obligatoriu
                ajutor="Cel puțin 8 caractere."
                {...(erori["parola_noua"] === undefined ? {} : { erori: erori["parola_noua"] })}
              >
                {(a) => <input {...a} type="password" minLength={8} autoComplete="new-password" />}
              </Camp>

              <Camp
                nume="confirma_parola"
                eticheta="Confirmă parola"
                obligatoriu
                {...(erori["confirma_parola"] === undefined
                  ? {}
                  : { erori: erori["confirma_parola"] })}
              >
                {(a) => <input {...a} type="password" minLength={8} autoComplete="new-password" />}
              </Camp>
            </div>

            <div>
              <Buton varianta="secundar" type="submit" inCurs={inCurs} textInCurs="Se schimbă…">
                Schimbă parola
              </Buton>
            </div>
          </>
        )}
      </Formular>
    </div>
  );
}
