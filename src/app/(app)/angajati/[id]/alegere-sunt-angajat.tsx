// src/app/(app)/angajati/[id]/alegere-sunt-angajat.tsx
import { Callout } from "@/components/ui/callout";

/**
 * Alegerea „administratorul e ȘI angajat", spusă ca alegere.
 *
 * ┌ De ce era nevoie ────────────────────────────────────────────────────────
 * │ `0083_fisa_de_angajat_pentru_patron.sql` creează, pentru fiecare
 * │ `org_admin`, o fișă cu status `candidat` — deliberat: deblochează ecranele
 * │ personale fără să declare pe nimeni salariat. Antetul migrării spune de ce:
 * │ „un cont care administrează tot produsul, dar n-are unde să-și scrie
 * │ propria săptămână, e o fundătură".
 * │
 * │ Numai că starea aia nu se prezenta nicăieri. Fișa arăta ca un rând gol, iar
 * │ trecerea la „angajat" se întâmpla doar ca EFECT SECUNDAR al creării unui
 * │ contract de bază (`actions.ts`, `creeazaContract`). Un patron care voia să
 * │ se ponteze nu avea de unde ști nici că e blocat, nici de ce, nici ce să
 * │ facă — pontajul pur și simplu nu-l lista, fără niciun refuz.
 * └──────────────────────────────────────────────────────────────────────────
 *
 * ┌ De ce NU un comutator care schimbă statusul ─────────────────────────────
 * │ Ar fi fost mai scurt: un buton care pune `status = 'activ'` și gata. Dar ar
 * │ fi produs un salariat FĂRĂ contract de muncă — o minciună în evidență, pe
 * │ care salarizarea, REGES și adeverințele ar fi luat-o de bună. Un om cu
 * │ contract e angajat; unul fără, nu e, oricâte comutatoare am pune.
 * │
 * │ Alegerea rămâne deci reală, nu declarativă: se face creând contractul, din
 * │ formularul de dedesubt. Componenta asta nu adaugă o cale nouă — o NUMEȘTE
 * │ pe cea existentă și spune ce deblochează.
 * └──────────────────────────────────────────────────────────────────────────
 */
export function AlegereSuntAngajat({
  esteFisaProprie,
  poateCreaContract,
}: {
  readonly esteFisaProprie: boolean;
  /** Fără dreptul de a crea contractul, îndemnul ar duce într-un refuz. */
  readonly poateCreaContract: boolean;
}) {
  const cine = esteFisaProprie ? "Contul dvs." : "Acest cont";
  const posesiv = esteFisaProprie ? "dvs." : "al persoanei";

  return (
    <Callout fel="informativ" titlu="Administrator, fără contract de muncă">
      <p>
        {cine} administrează firma, dar nu e declarat salariat: fișa a fost creată automat, ca
        ecranele personale să funcționeze, și rămâne „candidat” până la primul contract de muncă.
      </p>
      <p className="mt-2">
        Până atunci, {esteFisaProprie ? "nu vă puteți" : "persoana nu se poate"} ponta — foaia
        colectivă listează doar salariații — iar salarizarea, REGES și adeverințele nu iau fișa în
        calcul.
      </p>
      <p className="mt-2">
        {poateCreaContract ? (
          <>
            Dacă administratorul {posesiv} e <strong>și angajat</strong> al firmei, completați
            contractul de mai jos: fișa devine activă în aceeași operațiune. Dacă e administrator pe
            contract de mandat, lăsați-o așa — e starea corectă.
          </>
        ) : (
          <>
            Trecerea la „salariat” se face prin crearea contractului de muncă, iar pentru asta e
            nevoie de dreptul de a înrola angajați. Cereți-i unui administrator să o facă.
          </>
        )}
      </p>
    </Callout>
  );
}
