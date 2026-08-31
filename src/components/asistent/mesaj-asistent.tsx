// src/components/asistent/mesaj-asistent.tsx
"use client";

import type { ReactElement } from "react";

import type { Destinatie } from "@/lib/asistent/destinatii";
import type { MesajAfisat } from "@/lib/asistent/depozit";
import { imparteRaspuns } from "@/lib/asistent/marcaje";
import { imparteText, type Bloc, type Parte } from "@/lib/asistent/text";
import { cn } from "@/lib/ui/cn";

import { ReferintaRuta } from "./referinta-ruta";

/**
 * Un mesaj din conversație.
 *
 * Textul modelului trece prin DOUĂ treceri pure, în ordine: `imparteRaspuns`
 * scoate marcajele de rută, apoi `imparteText` face paragrafe și liste din ce
 * rămâne. Nicăieri nu se atinge `dangerouslySetInnerHTML` și nicăieri nu se
 * construiește markup dintr-un șir — tot ce ajunge pe ecran trece prin `{…}`.
 *
 * `inCurs` se propagă până la parser: cât timp răspunsul curge, un marcaj
 * neterminat de la coadă se reține, ca să nu clipească `[[ruta:ponta` pe ecran.
 */
export function MesajAsistent({
  mesaj,
  inCurs,
  efemere,
  laNavigare,
}: Readonly<{
  mesaj: MesajAfisat;
  inCurs: boolean;
  efemere: ReadonlyMap<string, Destinatie>;
  laNavigare?: () => void;
}>): ReactElement {
  if (mesaj.rol === "om") {
    return (
      <div className="flex justify-end">
        <p className="bg-primary text-primary-foreground rounded-panou text-corp max-w-[85%] px-3 py-2 whitespace-pre-wrap">
          {mesaj.text}
        </p>
      </div>
    );
  }

  const segmente = imparteRaspuns(mesaj.text, {
    inCurs,
    ...(efemere.size === 0 ? {} : { extra: efemere }),
  });

  return (
    <div className="flex flex-col gap-2">
      {segmente.map((segment, i) =>
        segment.tip === "ruta" ? (
          <ReferintaRuta
            key={`${segment.destinatie.id}-${String(i)}`}
            destinatie={segment.destinatie}
            {...(laNavigare === undefined ? {} : { laNavigare })}
          />
        ) : (
          <BlocuriText key={`text-${String(i)}`} text={segment.text} />
        ),
      )}
    </div>
  );
}

function BlocuriText({ text }: Readonly<{ text: string }>): ReactElement | null {
  const blocuri = imparteText(text);
  if (blocuri.length === 0) return null;
  return (
    <div className="text-corp text-foreground flex flex-col gap-2">
      {blocuri.map((bloc, i) => (
        <UnBloc key={i} bloc={bloc} />
      ))}
    </div>
  );
}

function UnBloc({ bloc }: Readonly<{ bloc: Bloc }>): ReactElement {
  if (bloc.tip === "lista") {
    return (
      <ul className="flex list-disc flex-col gap-1 ps-5">
        {bloc.elemente.map((parti, i) => (
          <li key={i}>
            <Parti parti={parti} />
          </li>
        ))}
      </ul>
    );
  }
  return (
    <p>
      <Parti parti={bloc.parti} />
    </p>
  );
}

function Parti({ parti }: Readonly<{ parti: readonly Parte[] }>): ReactElement {
  return (
    <>
      {parti.map((parte, i) => (
        <span key={i} className={cn(parte.ingrosat ? "font-semibold" : "")}>
          {parte.text}
        </span>
      ))}
    </>
  );
}
