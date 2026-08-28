// src/app/(app)/reges/setari/formular-credentiale.tsx
"use client";

import { useRouter } from "next/navigation";
import { useState, useTransition } from "react";

import { Buton } from "@/components/ui/buton";
import { Callout } from "@/components/ui/callout";
import { Camp } from "@/components/ui/camp";
import { MEDII } from "../constante";
import { useSemnalIncarcare } from "@/components/incarcare/use-incarcare";
import {
  comutaActivarea,
  salveazaCredentialele,
  sincronizeazaNomenclatoarele,
  testeazaConexiunea,
} from "../actiuni-api";

export type RezumatAfisat = Readonly<{
  mediu: string;
  cuiAngajator: string;
  clientId: string;
  utilizator: string;
  areSecret: boolean;
  areParola: boolean;
  verificatOk: boolean | null;
  verificatMesaj: string | null;
  verificatLa: string | null;
  activ: boolean;
}>;

type Mesaj = Readonly<{ fel: "eroare" | "atentie" | "informativ"; text: string }>;

export function FormularCredentiale(props: {
  readonly rezumat: RezumatAfisat | null;
  readonly poateConfigura: boolean;
}) {
  const router = useRouter();
  const [mesaj, setMesaj] = useState<Mesaj | null>(null);
  const [erori, setErori] = useState<Readonly<Record<string, readonly string[]>> | null>(null);
  const [inCurs, startTransition] = useTransition();

  /*
    `useTransition` dă un singur `inCurs` pentru toate trei butoanele, iar
    „Testează conexiunea" și „Descarcă nomenclatoarele" vorbesc cu un serviciu
    EXTERN, prin Keycloak: pot ține zeci de secunde. Se stingeau toate trei și
    nimic nu spunea care lucrează. `actiune` marchează care e în zbor, ca rotița
    să apară pe butonul apăsat.
  */
  const [actiune, setActiune] = useState<"salvare" | "test" | "sincronizare" | null>(null);
  useSemnalIncarcare(inCurs && actiune !== "salvare", "răspunsul de la REGES");

  const r = props.rezumat;

  function salveaza(formular: FormData) {
    setMesaj(null);
    setErori(null);
    startTransition(async () => {
      const rezultat = await salveazaCredentialele({
        mediu: String(formular.get("mediu") ?? "test") as "test" | "productie",
        cuiAngajator: String(formular.get("cuiAngajator") ?? ""),
        clientId: String(formular.get("clientId") ?? ""),
        utilizator: String(formular.get("utilizator") ?? ""),
        // Șirul gol înseamnă „n-am atins câmpul": funcția SQL păstrează atunci
        // secretul existent. Trimis ca `undefined`, ar fi la fel — dar `""` e ce
        // dă un `<input>` gol, iar traducerea se face aici, nu în server.
        clientSecret: String(formular.get("clientSecret") ?? ""),
        parola: String(formular.get("parola") ?? ""),
      });
      if (rezultat.ok) {
        setMesaj({
          fel: "informativ",
          text: "Cheile au fost salvate. Testați conexiunea înainte de a porni transmiterea.",
        });
        router.refresh();
      } else {
        setMesaj({ fel: "eroare", text: rezultat.error.message });
        setErori(rezultat.error.fieldErrors);
      }
    });
  }

  function testeaza() {
    setMesaj(null);
    setActiune("test");
    startTransition(async () => {
      const rezultat = await testeazaConexiunea();
      if (rezultat.ok) {
        setMesaj({
          fel: rezultat.data.ok ? "informativ" : "atentie",
          text: rezultat.data.mesaj,
        });
        router.refresh();
      } else {
        setMesaj({ fel: "eroare", text: rezultat.error.message });
      }
    });
  }

  function comuta(activ: boolean) {
    setMesaj(null);
    startTransition(async () => {
      const rezultat = await comutaActivarea({ activ });
      if (rezultat.ok) {
        setMesaj({
          fel: "informativ",
          text: activ
            ? "Transmiterea automată e pornită. Ciclul preia coada la următoarea rulare."
            : "Transmiterea automată e oprită. Mesajele rămân în coadă.",
        });
        router.refresh();
      } else {
        setMesaj({ fel: "eroare", text: rezultat.error.message });
      }
    });
  }

  function sincronizeaza() {
    setMesaj(null);
    setActiune("sincronizare");
    startTransition(async () => {
      const rezultat = await sincronizeazaNomenclatoarele();
      setMesaj(
        rezultat.ok
          ? {
              fel: "informativ",
              text: `S-au actualizat ${rezultat.data.tipuri} nomenclatoare, ${rezultat.data.randuri} poziții.`,
            }
          : { fel: "eroare", text: rezultat.error.message },
      );
      if (rezultat.ok) router.refresh();
    });
  }

  if (!props.poateConfigura) {
    return (
      <Callout fel="informativ" titlu="Doar citire">
        Configurarea cheilor API cere permisiunea „REGES — configurare”.
      </Callout>
    );
  }

  return (
    <div className="space-y-6">
      {mesaj !== null ? (
        <Callout fel={mesaj.fel} {...(mesaj.fel === "eroare" ? { titlu: "Nu s-a putut" } : {})}>
          {mesaj.text}
        </Callout>
      ) : null}

      {r !== null && r.verificatOk !== null ? (
        <Callout
          fel={r.verificatOk ? "informativ" : "atentie"}
          titlu={r.verificatOk ? "Ultima verificare a reușit" : "Ultima verificare a eșuat"}
        >
          {r.verificatMesaj ?? "—"}
        </Callout>
      ) : null}

      <form action={salveaza} className="space-y-4">
        <Camp
          nume="mediu"
          eticheta="Mediul"
          erori={erori?.["mediu"] ?? []}
          obligatoriu
          fel="select"
        >
          {(a) => (
            <select {...a} defaultValue={r?.mediu ?? "test"}>
              {MEDII.map((m) => (
                <option key={m.valoare} value={m.valoare}>
                  {m.eticheta}
                </option>
              ))}
            </select>
          )}
        </Camp>

        <Camp
          nume="cuiAngajator"
          eticheta="CUI-ul angajatorului"
          ajutor="Codul fiscal al firmei, așa cum apare în contul REGES."
          erori={erori?.["cuiAngajator"] ?? []}
          obligatoriu
        >
          {(a) => <input {...a} type="text" defaultValue={r?.cuiAngajator ?? ""} maxLength={20} />}
        </Camp>

        <Camp
          nume="clientId"
          eticheta="Client ID"
          ajutor="De obicei „reges-api”, dar poate diferi de la un angajator la altul."
          erori={erori?.["clientId"] ?? []}
          obligatoriu
        >
          {(a) => (
            <input {...a} type="text" defaultValue={r?.clientId ?? "reges-api"} maxLength={120} />
          )}
        </Camp>

        <Camp
          nume="utilizator"
          eticheta="Utilizator"
          ajutor="Din portalul REGES: Setări → Acces → Chei API."
          erori={erori?.["utilizator"] ?? []}
          obligatoriu
        >
          {(a) => <input {...a} type="text" defaultValue={r?.utilizator ?? ""} maxLength={200} />}
        </Camp>

        <Camp
          nume="clientSecret"
          eticheta="Client Secret"
          ajutor={
            r?.areSecret === true
              ? "Este salvat. Lăsați gol ca să-l păstrați neschimbat."
              : "Nu este salvat încă."
          }
          erori={erori?.["clientSecret"] ?? []}
        >
          {(a) => (
            <input
              {...a}
              type="password"
              autoComplete="off"
              maxLength={400}
              placeholder="••••••••"
            />
          )}
        </Camp>

        <Camp
          nume="parola"
          eticheta="Parola"
          ajutor={
            r?.areParola === true
              ? "Este salvată. Lăsați gol ca s-o păstrați neschimbată."
              : "Nu este salvată încă."
          }
          erori={erori?.["parola"] ?? []}
        >
          {(a) => (
            <input
              {...a}
              type="password"
              autoComplete="off"
              maxLength={400}
              placeholder="••••••••"
            />
          )}
        </Camp>

        <p className="text-muted-foreground text-nota">
          Cheile se păstrează criptate (AES-256-GCM) și nu se mai afișează niciodată după salvare.
          Nu apar nici în jurnalul de audit: acolo se scrie doar CE câmp s-a schimbat.
        </p>

        <div className="flex flex-wrap gap-2">
          <Buton
            type="submit"
            varianta="primar"
            onClick={() => setActiune("salvare")}
            inCurs={inCurs && actiune === "salvare"}
            textInCurs="Se salvează…"
            disabled={inCurs}
          >
            Salvează cheile
          </Buton>
          <Buton
            type="button"
            varianta="secundar"
            onClick={testeaza}
            inCurs={inCurs && actiune === "test"}
            textInCurs="Se testează…"
            disabled={inCurs || r === null}
          >
            Testează conexiunea
          </Buton>
          <Buton
            type="button"
            varianta="secundar"
            onClick={sincronizeaza}
            inCurs={inCurs && actiune === "sincronizare"}
            textInCurs="Se descarcă…"
            disabled={inCurs || r === null}
          >
            Descarcă nomenclatoarele
          </Buton>
        </div>
      </form>

      <div className="border-border rounded-control border p-4">
        <h2 className="text-foreground font-medium">Transmiterea automată</h2>
        <p className="text-muted-foreground text-nota mt-1">
          Când e pornită, ciclul de reconciliere trimite mesajele de contract gata de plecare și
          culege răspunsurile Inspecției Muncii. Fișele de salariat pleacă tot manual, fiindcă
          conțin CNP-ul și citirea lui se auditează pe numele dumneavoastră.
        </p>
        <div className="mt-3">
          <Buton
            type="button"
            varianta={r?.activ === true ? "secundar" : "primar"}
            onClick={() => comuta(r?.activ !== true)}
            disabled={inCurs || r === null}
          >
            {r?.activ === true ? "Oprește transmiterea" : "Pornește transmiterea"}
          </Buton>
        </div>
      </div>
    </div>
  );
}
