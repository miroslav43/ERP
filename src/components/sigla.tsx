/**
 * Sigla Administrativo — sigla-cuvânt „ADMINISTRATIVO”.
 *
 * ── DE UNDE VINE ──────────────────────────────────────────────────────────
 * Din `docs/comercial/sigla/sigla-administrativo.pdf` (TeX Gyre Adventor,
 * regular, culoarea `#475569`), convertită cu `pdftocairo -svg` și aplatizată:
 * cele paisprezece glife, poziționate prin `<use>`, au devenit un singur
 * `<path>`, cu cutia strânsă pe litere (fără marginea de 14pt a lui
 * `standalone`). Nu e o imagine din `public/`: e vectorială, se colorează cu
 * `currentColor` și nu cere nicio cerere în plus la încărcare.
 *
 * Când se schimbă sigla din `docs/comercial/sigla/`, calea de aici se
 * regenerează din PDF-ul nou — nu se desenează de mână.
 *
 * Literele sunt subțiri: sub ~14px înălțime nu se mai citesc bine. Antetul o
 * folosește la 15–17px.
 */

/** `viewBox`-ul siglei: lățimea și înălțimea literelor, în unitățile PDF-ului. */
export const SIGLA_LATIME = 752.87;
export const SIGLA_INALTIME = 72.5;

/** Culoarea siglei din materialele tipărite (`brandSlate` din `sigla-administrativo.tex`). */
export const SIGLA_CULOARE = "#475569";

export const SIGLA_CALE =
  "M0 71.27L7.39 71.27L17.62 47.67L50.21 47.67L60.35 71.27L68.03 71.27L37.9 1.24L30.03 1.24ZM20.28 41.31L34.01 9.19L47.46 41.31ZM20.28 41.31M76.27 71.27L95.13 71.27C122.52 71.27 135.41 56.67 135.41 36.49C135.41 23.31 129.91 12.89 119.49 6.74C112.85 2.75 105.46 1.24 92.76 1.24L76.27 1.24ZM83.29 64.92L83.29 7.58L93.04 7.58C103.66 7.58 110.29 8.91 115.6 12.13C123.65 16.97 128.3 25.78 128.3 36.21C128.3 45.39 124.7 53.46 118.26 58.66C112.66 63.11 105.46 64.92 93.04 64.92ZM83.29 64.92M146.78 71.27L153.79 71.27L153.79 8.91L180.04 71.27L186.1 71.27L212.45 8.91L212.45 71.27L219.46 71.27L219.46 1.24L208.56 1.24L183.17 60.85L157.67 1.24L146.78 1.24ZM146.78 71.27M233.86 71.27L240.88 71.27L240.88 1.24L233.86 1.24ZM233.86 71.27M255.28 71.27L262.29 71.27L262.29 9.67L303.98 71.27L310.99 71.27L310.99 1.24L303.98 1.24L303.98 59.33L264.74 1.24L255.28 1.24ZM255.28 71.27M325.4 71.27L332.41 71.27L332.41 1.24L325.4 1.24ZM325.4 71.27M341.69 51.66C342.36 64.25 350.99 72.5 363.58 72.5C375.72 72.5 384.72 63.69 384.72 51.75C384.72 45.58 382.16 40.1 377.7 36.77C374.86 34.69 371.92 33.36 364.72 31.19C358.38 29.28 356.19 28.44 354.39 26.83C352.41 25.11 351.08 21.89 351.08 18.67C351.08 11.66 356.19 6.46 363.2 6.46C370.31 6.46 375.72 11.38 375.72 18.96L383.02 18.96C383.02 7.58 374.86 -0 363.39 -0C352.13 -0 343.97 7.97 343.97 18.86C343.97 23.69 345.77 28.35 348.89 31.28C351.64 33.92 353.83 34.97 361.97 37.44C374.02 41.13 377.61 44.46 377.61 52.13C377.61 60.17 371.74 66.05 363.78 66.05C355.91 66.05 350.22 61.03 349.19 51.66ZM341.69 51.66M387.46 7.58L403.47 7.58L403.47 71.27L410.49 71.27L410.49 7.58L426.5 7.58L426.5 1.24L387.46 1.24ZM387.46 7.58M434.37 71.27L441.39 71.27L441.39 7.58L451.25 7.58C467.54 7.58 474.75 11.85 474.75 23.5C474.75 36.11 468.11 39.52 448.5 39.52L472.09 71.27L480.81 71.27L461.18 45.11C474.65 43.69 481.86 36.21 481.86 23.78C481.86 9.19 473.7 1.24 451.72 1.24L434.37 1.24ZM434.37 71.27M485.73 71.27L493.13 71.27L503.36 47.67L535.95 47.67L546.09 71.27L553.77 71.27L523.64 1.24L515.77 1.24ZM506.02 41.31L519.75 9.19L533.2 41.31ZM506.02 41.31M550.82 7.58L566.84 7.58L566.84 71.27L573.85 71.27L573.85 7.58L589.87 7.58L589.87 1.24L550.82 1.24ZM550.82 7.58M597.74 71.27L604.75 71.27L604.75 1.24L597.74 1.24ZM597.74 71.27M612.9 1.24L641.7 71.27L648.53 71.27L677.53 1.24L669.95 1.24L645.22 62.55L620.58 1.24ZM612.9 1.24M678.85 35.83C678.85 56.21 695.34 72.5 715.9 72.5C736.18 72.5 752.87 56.11 752.87 36.3C752.87 16.3 736.18 -0 715.9 -0C695.81 -0 678.85 16.39 678.85 35.83ZM685.96 36.02C685.96 20 699.7 6.46 715.9 6.46C732.2 6.46 745.76 20 745.76 36.39C745.76 52.6 732.2 66.05 715.9 66.05C699.42 66.05 685.96 52.6 685.96 36.02ZM685.96 36.02";

export function Sigla({
  clasa,
  eticheta,
}: {
  readonly clasa?: string;
  /**
   * Numele citit de cititorul de ecran. Lipsește când sigla stă într-o
   * legătură care își poartă singură `aria-label`-ul — altfel numele s-ar
   * anunța de două ori.
   */
  readonly eticheta?: string;
}) {
  return (
    <svg
      viewBox={`0 0 ${String(SIGLA_LATIME)} ${String(SIGLA_INALTIME)}`}
      className={clasa}
      fill="currentColor"
      focusable="false"
      {...(eticheta === undefined
        ? { "aria-hidden": true }
        : { role: "img", "aria-label": eticheta })}
    >
      <path d={SIGLA_CALE} />
    </svg>
  );
}
