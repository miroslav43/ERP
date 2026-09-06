// src/app/(onboarding)/bun-venit/alegere-patron-angajat.tsx
"use client";

/**
 * „Sunteți și angajat al firmei?" — întrebarea, la momentul potrivit.
 *
 * ┌ De ce AICI, și nu doar pe fișă ──────────────────────────────────────────
 * │ `0083` creează pentru fiecare `org_admin` o fișă `candidat`. Ea deblochează
 * │ ecranele personale, dar NU face pe nimeni salariat — iar foaia de pontaj
 * │ listează doar salariați. Un patron care voia să se ponteze descoperea asta
 * │ abia când nu se găsea în listă, fără niciun refuz care să-l lămurească.
 * │
 * │ Momentul în care întrebarea costă cel mai puțin e chiar înainte de
 * │ „Finalizează": omul e deja în modul „îmi configurez firma", are documentele
 * │ la îndemână, și nu s-a lovit încă de nimic.
 * └──────────────────────────────────────────────────────────────────────────
 *
 * ┌ De ce e în asistentul din `bun-venit`, nu în `Pas7Confirmare` ───────────
 * │ `Pas7Confirmare` e PARTAJAT cu `super-admin/organizatii/nou`, unde firma o
 * │ creăm noi, ca furnizor. Acolo întrebarea n-ar avea pe cine să întrebe —
 * │ persoana care completează nu e patronul — iar un „da" dat de noi ar
 * │ însemna că introducem noi CNP-ul și actul de identitate ale altcuiva.
 * │ Nu le avem, n-avem temei să le cerem, iar greșite ajung la ITM prin REGES.
 * │
 * │ Distincția nu costă o ramificație: firma creată de noi pornește tot cu
 * │ `status = 'pending'`, deci patronul trece prin ACELAȘI asistent la prima
 * │ autentificare. Un singur flux acoperă amândouă situațiile.
 * └──────────────────────────────────────────────────────────────────────────
 *
 * ┌ De ce răspunsul NU se salvează ──────────────────────────────────────────
 * │ Un „nu" păstrat ar deveni o stare de întreținut, care ar trebui apoi
 * │ resetată din altă parte când omul se răzgândește. Informația reală — are
 * │ contract sau nu — e deja în bază, exactă și mereu la zi. Alegerea de aici
 * │ decide un singur lucru: unde ajungi după „Finalizează".
 * └──────────────────────────────────────────────────────────────────────────
 */
export function AlegerePatronAngajat({
  valoare,
  laSchimbare,
}: {
  /** `null` = încă n-a ales; butonul de finalizare rămâne activ oricum. */
  readonly valoare: boolean | null;
  readonly laSchimbare: (esteAngajat: boolean) => void;
}) {
  const clasa = (activ: boolean) =>
    [
      "rounded-control border px-4 py-3 text-left text-corp transition",
      activ
        ? "border-accent bg-accent/10 text-foreground"
        : "border-hairline text-secundar hover:border-border",
    ].join(" ");

  return (
    <fieldset className="border-border rounded-panou space-y-3 border p-4">
      <legend className="text-foreground text-corp px-1 font-medium">
        Sunteți și angajat al firmei?
      </legend>
      <p className="text-corp-mic text-secundar">
        La majoritatea firmelor mici, administratorul are și contract de muncă. Contul dvs. poate
        administra aplicația oricum — întrebarea decide doar dacă vă puteți și ponta, cere concediu
        și apărea pe statul de plată.
      </p>

      <div className="grid gap-2 sm:grid-cols-2">
        <button
          type="button"
          onClick={() => {
            laSchimbare(true);
          }}
          className={clasa(valoare === true)}
        >
          <span className="block font-medium">Da, sunt și angajat</span>
          <span className="text-corp-mic text-secundar block">
            După finalizare vă ducem direct la înrolarea dvs., cu numele deja completat.
          </span>
        </button>

        <button
          type="button"
          onClick={() => {
            laSchimbare(false);
          }}
          className={clasa(valoare === false)}
        >
          <span className="block font-medium">Nu, doar administrez</span>
          <span className="text-corp-mic text-secundar block">
            Administrator pe contract de mandat. E o stare la fel de validă; vă puteți răzgândi
            oricând din fișa dvs.
          </span>
        </button>
      </div>
    </fieldset>
  );
}
