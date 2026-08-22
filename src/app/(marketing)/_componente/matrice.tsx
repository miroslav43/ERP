import { ETICHETA_DOMENIU, MATRICE, ROLURI_MATRICE } from "@/content/landing/matrice-roluri";
import type { ContinutLanding } from "@/content/landing/tipuri";

/**
 * Matricea „cine ce vede".
 *
 * Stă OBLIGATORIU pe hârtie. Semnul „—" al refuzului e singurul text colorat de
 * pe toată pagina, iar cărămida `#A8443A` trece pragul AA doar pe hârtie
 * (5,10:1); pe cerneală ar cădea la 2,94:1. Poziția secțiunii în pagină vine,
 * așadar, dintr-un calcul de contrast, nu dintr-o preferință.
 *
 * E statică, nu comutabilă pe rol. Un comutator de chipsuri ar fi modulul de
 * landing al oricărui furnizor de autorizare, iar aici comparația între coloane
 * ESTE argumentul: se citesc toate patru deodată.
 */
export function MatriceRoluri({ text }: { text: ContinutLanding["roluri"] }) {
  return (
    <div className="mt-10">
      <div className="border-mk-rigla overflow-x-auto border">
        <table className="w-full border-collapse text-left">
          <thead>
            <tr className="border-mk-rigla border-b">
              <th
                scope="col"
                className="font-mk-date text-mk-text-slab px-3 py-2 text-[0.6875rem] font-medium tracking-[0.14em] uppercase"
              >
                {text.capResursa}
              </th>
              {ROLURI_MATRICE.map((rol) => (
                <th
                  key={rol.cheie}
                  scope="col"
                  className="border-mk-liniatura border-l px-3 py-2 text-right"
                >
                  <span className="block text-[0.9375rem] font-semibold">{rol.eticheta}</span>
                  <span className="font-mk-date text-mk-text-slab block text-[0.6875rem] tracking-[0.06em]">
                    {rol.cheie}
                  </span>
                </th>
              ))}
            </tr>
          </thead>
          <tbody>
            {MATRICE.map((rand) => (
              <tr key={rand.resursa} className="border-mk-liniatura border-b last:border-b-0">
                <th scope="row" className="px-3 py-2.5 text-[0.9375rem] font-normal">
                  {rand.eticheta}
                  <span className="font-mk-date text-mk-text-slab ml-2 text-[0.6875rem]">
                    {rand.resursa}:read
                  </span>
                </th>
                {ROLURI_MATRICE.map((rol) => {
                  const domeniu = rand.domenii[rol.cheie];
                  const refuz = domeniu === "none";
                  return (
                    <td
                      key={rol.cheie}
                      className={`border-mk-liniatura font-mk-date border-l px-3 py-2.5 text-right text-[0.8125rem] tracking-[0.01em] ${
                        refuz ? "text-mk-refuz font-medium" : ""
                      }`}
                    >
                      {ETICHETA_DOMENIU[domeniu]}
                      {refuz && <span className="sr-only"> (fără drept)</span>}
                    </td>
                  );
                })}
              </tr>
            ))}
          </tbody>
        </table>
      </div>

      <ol className="mt-8 grid gap-x-10 gap-y-4 md:grid-cols-2">
        {text.note.map((nota, index) => (
          <li key={nota} className="flex gap-3">
            <span
              aria-hidden="true"
              className="font-mk-date text-mk-text-slab pt-0.5 text-[0.6875rem] tabular-nums"
            >
              {index + 1}
            </span>
            <p className="text-mk-text-slab max-w-[52ch] text-[0.8125rem] leading-[1.55]">{nota}</p>
          </li>
        ))}
      </ol>

      <p className="border-mk-rigla/40 text-mk-text-slab mt-8 max-w-[62ch] border-t pt-5 text-[0.8125rem] leading-[1.55]">
        {text.notaPlatforma}
      </p>
    </div>
  );
}
