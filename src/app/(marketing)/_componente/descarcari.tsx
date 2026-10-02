import type { Format } from "@/lib/unelte/document-tabelar";

const ETICHETE: Readonly<Record<Format, string>> = {
  pdf: "Descarcă PDF",
  docx: "Descarcă Word",
  xlsx: "Descarcă Excel",
};

/** Descărcările, ca `<a>` simple: merg fără JavaScript și se pot salva la favorite. */
export function Descarcari({
  href,
  eveniment,
  formate = ["pdf", "docx", "xlsx"],
}: Readonly<{
  href: (format: Format) => string;
  eveniment: string;
  formate?: readonly Format[];
}>) {
  return (
    <ul className="flex flex-wrap gap-x-8 gap-y-2" data-tipar="ascunde">
      {formate.map((f) => (
        <li key={f}>
          <a
            href={href(f)}
            data-umami-event={`${eveniment}-${f}`}
            className="text-[0.9375rem] underline underline-offset-4"
          >
            {ETICHETE[f]}
          </a>
        </li>
      ))}
    </ul>
  );
}
