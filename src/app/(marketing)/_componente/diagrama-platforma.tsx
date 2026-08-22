/**
 * Diagrama legăturilor dintre module.
 *
 * E DECOR care orientează, nu conținut: explicațiile stau în registrul de sub
 * ea, care rămâne complet și pe telefon. De aceea desenul e `aria-hidden` și
 * dispare sub 768px — n-ar mai fi lizibil la scara aia, iar informația nu se
 * pierde, fiindcă n-a fost niciodată doar aici.
 */
const NODURI = [
  { x: 40, y: 30, w: 150, eticheta: "Angajați" },
  { x: 300, y: 30, w: 150, eticheta: "Scadențe" },
  { x: 40, y: 130, w: 150, eticheta: "Concedii" },
  { x: 300, y: 130, w: 150, eticheta: "Pontaj" },
  { x: 560, y: 130, w: 170, eticheta: "Salarizare" },
  { x: 40, y: 222, w: 150, eticheta: "Diurne" },
] as const;

const SAGETI = [
  { d: "M190 52 H288", eticheta: "expirables", lx: 196, ly: 44 },
  { d: "M190 152 H288", eticheta: "sincronizare_concedii", lx: 196, ly: 144 },
  { d: "M450 152 H548", eticheta: "agregare în SQL", lx: 456, ly: 144 },
  { d: "M190 244 H645 V186", eticheta: "plafon neimpozabil", lx: 196, ly: 236 },
] as const;

export function DiagramaPlatforma({ notaAudit }: { notaAudit: string }) {
  return (
    <svg
      viewBox="0 0 960 350"
      className="text-mk-text mt-10 hidden h-auto w-full md:block"
      aria-hidden="true"
      focusable="false"
    >
      <defs>
        <marker
          id="mk-varf"
          viewBox="0 0 10 10"
          refX="9"
          refY="5"
          markerWidth="7"
          markerHeight="7"
          orient="auto-start-reverse"
        >
          <path d="M0 0 L10 5 L0 10 z" fill="var(--color-mk-rigla)" />
        </marker>
      </defs>

      {SAGETI.map((sageata) => (
        <g key={sageata.eticheta}>
          <path
            d={sageata.d}
            fill="none"
            stroke="var(--color-mk-rigla)"
            strokeWidth="1"
            markerEnd="url(#mk-varf)"
          />
          <text
            x={sageata.lx}
            y={sageata.ly}
            className="font-mk-date"
            fontSize="11"
            letterSpacing="0.06em"
            fill="var(--color-mk-text-slab)"
          >
            {sageata.eticheta}
          </text>
        </g>
      ))}

      {NODURI.map((nod) => (
        <g key={nod.eticheta}>
          <rect
            x={nod.x}
            y={nod.y}
            width={nod.w}
            height={44}
            fill="var(--color-mk-hartie)"
            stroke="var(--color-mk-text)"
            strokeWidth="1"
          />
          <text
            x={nod.x + nod.w / 2}
            y={nod.y + 28}
            textAnchor="middle"
            fontSize="15"
            fill="currentColor"
          >
            {nod.eticheta}
          </text>
        </g>
      ))}

      <rect
        x="40"
        y="296"
        width="880"
        height="38"
        fill="var(--color-mk-cerneala)"
        stroke="var(--color-mk-cerneala)"
      />
      <text
        x="56"
        y="320"
        className="font-mk-date"
        fontSize="11"
        letterSpacing="0.14em"
        fill="var(--color-mk-text-inv)"
      >
        JURNAL DE AUDIT
      </text>
      <text x="220" y="320" fontSize="13" fill="var(--color-mk-text-inv-slab)">
        {notaAudit}
      </text>
    </svg>
  );
}
