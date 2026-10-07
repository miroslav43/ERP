// src/app/(app)/mentenanta/sesizari/[id]/galerie-foto.tsx
import { FileImage } from "lucide-react";
import type { ReactElement } from "react";

import { marimeCitibila } from "@/components/ui/incarcare-fisier";
import { formatDateTime } from "@/lib/format/date";
import type { Atasament } from "@/lib/queries/maintenance";

import { ButonStergeFisier } from "./buton-sterge-fisier";

interface Proprietati {
  readonly atasamente: readonly Atasament[];
  readonly urluri: ReadonlyMap<string, string>;
  /** Contul apelantului — își poate șterge propriile fotografii. */
  readonly userId: string;
  /** Gestionarul șterge orice fotografie de pe sesizare. */
  readonly poateGestiona: boolean;
}

/** Browserele nu redau HEIC/HEIF inline: se oferă ca fișier de deschis, nu ca imagine spartă. */
function seRedaInline(mime: string | null): boolean {
  return mime !== null && mime.startsWith("image/") && !/hei[cf]/iu.test(mime);
}

/**
 * Fotografiile sesizării, pe URL-uri semnate de 10 minute (bucketul e privat).
 * `loading="lazy"`: cinci poze de telefon sunt ușor 15 MB; nu se descarcă
 * înainte să ajungă omul la ele.
 */
export function GalerieFoto({
  atasamente,
  urluri,
  userId,
  poateGestiona,
}: Proprietati): ReactElement | null {
  if (atasamente.length === 0) return null;

  return (
    <ul className="grid grid-cols-2 gap-3 sm:grid-cols-3">
      {atasamente.map((a) => {
        const url = urluri.get(a.storage_path);
        const poateSterge = poateGestiona || a.created_by === userId;
        return (
          <li
            key={a.id}
            className="border-border rounded-panou flex flex-col overflow-hidden border"
          >
            {url === undefined ? (
              <div className="bg-surface text-muted-foreground flex aspect-[4/3] items-center justify-center">
                <FileImage aria-hidden="true" className="size-8" />
              </div>
            ) : seRedaInline(a.mime) ? (
              <a href={url} target="_blank" rel="noreferrer" className="block">
                {/* eslint-disable-next-line @next/next/no-img-element -- URL semnat, extern, de scurtă durată; `next/image` ar cere domeniul în config și ar re-optimiza o poză privată. */}
                <img
                  src={url}
                  alt={a.denumire}
                  loading="lazy"
                  className="aspect-[4/3] w-full object-cover"
                />
              </a>
            ) : (
              <a
                href={url}
                target="_blank"
                rel="noreferrer"
                className="bg-surface text-corp flex aspect-[4/3] flex-col items-center justify-center gap-2 p-3 text-center underline-offset-2 hover:underline"
              >
                <FileImage aria-hidden="true" className="size-8" />
                Deschide fotografia
              </a>
            )}
            <div className="flex items-start justify-between gap-2 p-2">
              <p className="text-muted-foreground text-nota min-w-0 truncate">
                <span className="text-foreground block truncate" title={a.denumire}>
                  {a.denumire}
                </span>
                {formatDateTime(a.created_at)}
                {a.marime_bytes === null ? "" : ` · ${marimeCitibila(a.marime_bytes)}`}
              </p>
              {poateSterge ? <ButonStergeFisier id={a.id} denumire={a.denumire} /> : null}
            </div>
          </li>
        );
      })}
    </ul>
  );
}
