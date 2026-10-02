import type { Format } from "@/lib/unelte/document-tabelar";

const ETICHETE: Readonly<Record<Format, string>> = {
  pdf: "Descarcă PDF",
  docx: "Descarcă Word",
  xlsx: "Descarcă Excel",
};

/**
 * Descărcările unei unelte: butoane de trimitere, puse ÎN formularul ei.
 *
 * `formAction` trimite formularul (GET) spre ruta de API, cu `format=<x>` din
 * butonul apăsat, deci fișierul primește mereu valorile din câmpuri — și cele
 * completate fără „Generează”. Varianta dinainte, `<a href>` construit pe
 * server, dădea starea ultimului submit: cine completa și apăsa direct
 * „Descarcă” primea documentul gol. Merge tot fără JavaScript.
 */
export function Descarcari({
  actiune,
  eveniment,
  formate = ["pdf", "docx", "xlsx"],
}: Readonly<{ actiune: string; eveniment: string; formate?: readonly Format[] }>) {
  return (
    <div className="col-span-full flex flex-wrap gap-x-8 gap-y-2" data-tipar="ascunde">
      {formate.map((f) => (
        <button
          key={f}
          type="submit"
          formAction={actiune}
          name="format"
          value={f}
          data-umami-event={`${eveniment}-${f}`}
          className="cursor-pointer text-[0.9375rem] underline underline-offset-4"
        >
          {ETICHETE[f]}
        </button>
      ))}
    </div>
  );
}
