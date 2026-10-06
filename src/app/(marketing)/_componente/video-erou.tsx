"use client";

import { useEffect, useRef, useState } from "react";

/**
 * Videoclipul din spatele eroului.
 *
 * ── DE CE E INSULĂ, NU TOT EROUL ──────────────────────────────────────────
 * Eroul — titlul, butoanele, posterul — rămâne Server Component, randat o dată
 * și nehidratat (vezi nota din `foaia-vie.tsx` despre ce a costat hidratarea
 * pe pagina de start). Aici stă doar ce cere JavaScript: decizia dacă pornește
 * videoclipul și butonul care îl oprește.
 *
 * ── CÂND NU PORNEȘTE ──────────────────────────────────────────────────────
 * Nu se încarcă nimic până la montare (`preload="none"`, fără `src` în
 * HTML-ul de server), iar după montare doar dacă omul n-a cerut mișcare redusă
 * și nici economie de date. În toate celelalte cazuri rămâne posterul de
 * dedesubt — aceeași imagine, nemișcată. Videoclipul apare peste poster abia
 * când chiar rulează, cu o trecere de opacitate: fără ea, cine are internet
 * încet ar vedea o clipă de negru între poster și primul cadru.
 *
 * ── BUTONUL DE OPRIRE ─────────────────────────────────────────────────────
 * WCAG 2.2.2: mișcarea care pornește singură, durează peste cinci secunde și
 * stă lângă alt conținut trebuie să se poată opri. Butonul apare doar după ce
 * videoclipul a pornit — înainte n-ar avea ce opri. Starea afișată e intenția
 * omului, nu evenimentul `pause` al elementului: browserul poate pune pe pauză
 * singur un videoclip dintr-un tab ascuns, iar butonul n-are de ce să se
 * răzgândească din cauza asta.
 */
export function VideoErou({
  webm,
  mp4,
  etichete,
}: {
  readonly webm: string;
  readonly mp4: string;
  readonly etichete: Readonly<{ opreste: string; porneste: string }>;
}) {
  const video = useRef<HTMLVideoElement>(null);
  const [aPornit, setAPornit] = useState(false);
  const [opritDeOm, setOpritDeOm] = useState(false);

  /*
   * Sursa se pune imperativ, nu ca `<source>` randat din stare: decizia ține de
   * browser (mișcare redusă, economie de date, ce format știe să redea), iar o
   * stare setată în efect doar ca s-o citească tot efectul ar fi o randare în
   * plus, fără nimic de arătat. Singura stare e cea din evenimentele elementului.
   */
  useEffect(() => {
    const v = video.current;
    if (v === null) return;
    const miscareRedusa = window.matchMedia("(prefers-reduced-motion: reduce)").matches;
    const conexiune = (navigator as Navigator & { connection?: { saveData?: boolean } }).connection;
    if (miscareRedusa || conexiune?.saveData === true) return;
    // WebM e cu o cincime mai mic; MP4 (H.264) merge oriunde, inclusiv unde
    // VP9 e doar „maybe”.
    v.src = v.canPlayType('video/webm; codecs="vp9"') === "probably" ? webm : mp4;
    // `muted` ca proprietate, înainte de `play()`: React nu-l scrie sigur ca
    // atribut, iar fără el browserul refuză redarea automată.
    v.muted = true;
    v.play().catch(() => {
      // Redare automată refuzată (economie de energie, politică de site):
      // rămâne posterul, care e oricum starea de bază.
    });
  }, [webm, mp4]);

  function comuta() {
    const v = video.current;
    if (v === null) return;
    if (opritDeOm) {
      setOpritDeOm(false);
      v.play().catch(() => undefined);
    } else {
      setOpritDeOm(true);
      v.pause();
    }
  }

  return (
    <>
      <video
        ref={video}
        aria-hidden="true"
        tabIndex={-1}
        muted
        loop
        playsInline
        preload="none"
        onPlaying={() => setAPornit(true)}
        className={`absolute inset-0 -z-20 h-full w-full object-cover transition-opacity duration-700 ${
          aPornit ? "opacity-100" : "opacity-0"
        }`}
      />
      {aPornit && (
        <button
          type="button"
          onClick={comuta}
          className="font-mk-date border-mk-text-inv/40 text-mk-text-inv hover:border-mk-text-inv bg-mk-cerneala/60 absolute right-[clamp(1rem,4vw,2.5rem)] bottom-4 z-10 inline-flex h-9 items-center rounded border px-3 text-[0.6875rem] tracking-[0.14em] uppercase backdrop-blur-sm transition-colors"
        >
          {opritDeOm ? etichete.porneste : etichete.opreste}
        </button>
      )}
    </>
  );
}
