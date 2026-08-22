import type { ReactNode } from "react";

/**
 * Rândul de registru: cod mono la stânga, titlu, text, sub-puncte.
 *
 * Economia întregii direcții stă aici. Șase secțiuni — module, ecrane,
 * verticale, prețuri, fluxuri, comparație — sunt același obiect cu alt conținut.
 * Fără carduri, fără umbre, fără chenar complet și fără pictograme în pătrate
 * colorate: un formular are rigle, nu rame.
 *
 * Nu există bandă alternantă de rând. Măsurat, ar fi 1,07:1 pe hârtie —
 * imperceptibilă, deci decor cu poveste. Funcția pe care ar avea-o (să-ți țină
 * ochiul pe rând într-un tabel lat) există doar în foaie, deci acolo rămâne.
 */
export function Registru({ children }: { children: ReactNode }) {
  return <ul className="border-mk-rigla/40 mt-10 border-t">{children}</ul>;
}

export function RandRegistru({
  cod,
  titlu,
  text,
  puncte,
  dreapta,
}: {
  cod?: string;
  titlu: string;
  text?: string;
  puncte?: readonly string[];
  dreapta?: ReactNode;
}) {
  return (
    <li className="border-mk-rigla/40 grid grid-cols-1 gap-x-6 gap-y-2 border-b py-6 sm:grid-cols-12">
      {cod !== undefined && (
        <p className="font-mk-date text-mk-text-slab text-[0.6875rem] font-medium tracking-[0.14em] uppercase sm:col-span-2 sm:pt-1">
          {cod}
        </p>
      )}
      <div className={cod === undefined ? "sm:col-span-5" : "sm:col-span-4"}>
        <h3 className="font-mk-display text-[clamp(1.125rem,1.4vw,1.375rem)] leading-[1.18] font-semibold tracking-[-0.008em]">
          {titlu}
        </h3>
      </div>
      <div className="sm:col-span-6">
        {text !== undefined && (
          <p className="text-mk-text-slab max-w-[52ch] text-[0.875rem] leading-[1.55]">{text}</p>
        )}
        {puncte !== undefined && puncte.length > 0 && (
          <ul className="mt-3 space-y-1.5">
            {puncte.map((punct) => (
              <li
                key={punct}
                className="text-mk-text-slab flex gap-2.5 text-[0.875rem] leading-[1.5]"
              >
                <span aria-hidden="true" className="text-mk-rigla select-none">
                  ·
                </span>
                {punct}
              </li>
            ))}
          </ul>
        )}
        {dreapta}
      </div>
    </li>
  );
}
