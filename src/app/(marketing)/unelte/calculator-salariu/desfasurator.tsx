import type { RezultatSalariu } from "@/lib/unelte/salariu";

import { lei } from "./lei";
import { randuriDesfasurator, type RandDesfasurator } from "./randuri";

function Tabel({
  legenda,
  randuri,
}: {
  readonly legenda: string;
  readonly randuri: readonly RandDesfasurator[];
}) {
  return (
    <table className="w-full border-collapse text-left text-[0.9375rem]">
      <caption className="font-mk-display mb-2 text-left text-[1.0625rem] font-semibold">
        {legenda}
      </caption>
      <tbody>
        {randuri.map(({ eticheta, valoare, fel }) => (
          <tr
            key={eticheta}
            className={`border-mk-rigla/40 border-b ${fel === "total" ? "font-semibold" : ""}`}
          >
            <th
              scope="row"
              className={`py-2 pr-4 font-normal ${fel === "info" ? "text-mk-text-slab" : ""}`}
            >
              {eticheta}
            </th>
            {/* Fără rupere: la 360 px, „− 2.137 lei” se despărțea pe două rânduri (auditul din 8 oct 2026). */}
            <td className="font-mk-date py-2 text-right whitespace-nowrap tabular-nums">
              {fel === "minus" ? "− " : ""}
              {lei(valoare)}
            </td>
          </tr>
        ))}
      </tbody>
    </table>
  );
}

/** Desfășurătorul salariului: ce primește angajatul și ce plătește firma. */
export function Desfasurator({ r }: { readonly r: RezultatSalariu }) {
  const { angajat, angajator } = randuriDesfasurator(r);
  return (
    <div className="grid max-w-[64rem] items-start gap-8 lg:grid-cols-2">
      <Tabel legenda="Angajatul" randuri={angajat} />
      <Tabel legenda="Firma" randuri={angajator} />
    </div>
  );
}
