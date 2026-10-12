/**
 * Ce a schimbat unealta din ce a primit, spus pe pagină.
 *
 * Uneltele normalizează intrarea în loc s-o refuze: o adresă construită de mână,
 * un link vechi sau o listă lipită din Excel dau tot un document. Fără aviz însă,
 * omul primea altceva decât ceruse fără niciun semn — foaia pentru altă lună sau
 * 60 de angajați din 70 (auditul din 8 oct 2026).
 *
 * `role="status"`: cititorul de ecran îl anunță fără să întrerupă. Nu se tipărește.
 */
export function AvizCorectari({ avize }: { avize: readonly string[] }) {
  if (avize.length === 0) return null;
  return (
    <div
      role="status"
      data-tipar="ascunde"
      className="border-mk-rigla bg-mk-sl-hartie mt-6 border p-4 text-[0.9375rem] leading-[1.6]"
    >
      <p className="font-medium">Am ajustat ce ai trimis:</p>
      <ul className="mt-2 list-disc space-y-1 pl-5">
        {avize.map((aviz) => (
          <li key={aviz}>{aviz}</li>
        ))}
      </ul>
    </div>
  );
}
