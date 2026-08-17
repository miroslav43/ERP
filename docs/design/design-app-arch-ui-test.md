## 1. Theming per organizație (OKLCH, server-injected)

**Decizie contrast: WCAG 2.1 AA (4.5:1 text normal, 3:1 text mare/UI).** Motivare: (a) cerința contractuală a clientului e AA — APCA nu are prag legal, e încă în draft WCAG 3 și nu poate fi invocat într-un audit; (b) instituțiile publice românești (client tipic pentru ERP) cer conformitate cu SR EN 301 549 → WCAG 2.1 AA; (c) APCA e perceptual superior dar asimetric (text deschis pe fundal închis ≠ invers) și nu are un "ratio" unic de raportat în UI. **Implementare:** validăm și afișăm WCAG 2.1; opțional afișăm scorul APCA (Lc) ca informație secundară, niciodată ca criteriu de blocare.

```ts
// src/lib/theme/oklch.ts  — conversii sRGB <-> OKLab/OKLCh, fara dependinte
export type Rgb = Readonly<{ r: number; g: number; b: number }>;   // 0..1
export type Oklch = Readonly<{ l: number; c: number; h: number }>; // l 0..1, h grade

const clamp01 = (v: number): number => (v < 0 ? 0 : v > 1 ? 1 : v);

export function hexToRgb(hex: string): Rgb {
  const m = /^#?([0-9a-f]{6})$/i.exec(hex.trim());
  if (!m) throw new Error(`Culoare hex invalida: ${hex}`);
  const n = Number.parseInt(m[1], 16);
  return { r: ((n >> 16) & 255) / 255, g: ((n >> 8) & 255) / 255, b: (n & 255) / 255 };
}

export function rgbToHex({ r, g, b }: Rgb): string {
  const c = (v: number): string => Math.round(clamp01(v) * 255).toString(16).padStart(2, '0');
  return `#${c(r)}${c(g)}${c(b)}`.toUpperCase();
}

const toLinear = (v: number): number => (v <= 0.04045 ? v / 12.92 : ((v + 0.055) / 1.055) ** 2.4);
const toGamma = (v: number): number => (v <= 0.0031308 ? v * 12.92 : 1.055 * v ** (1 / 2.4) - 0.055);

export function rgbToOklch(rgb: Rgb): Oklch {
  const r = toLinear(rgb.r), g = toLinear(rgb.g), b = toLinear(rgb.b);
  const l = Math.cbrt(0.4122214708 * r + 0.5363325363 * g + 0.0514459929 * b);
  const m = Math.cbrt(0.2119034982 * r + 0.6806995451 * g + 0.1073969566 * b);
  const s = Math.cbrt(0.0883024619 * r + 0.2817188376 * g + 0.6299787005 * b);
  const L = 0.2104542553 * l + 0.793617785 * m - 0.0040720468 * s;
  const A = 1.9779984951 * l - 2.428592205 * m + 0.4505937099 * s;
  const B = 0.0259040371 * l + 0.7827717662 * m - 0.808675766 * s;
  const c = Math.hypot(A, B);
  const h = c < 1e-6 ? 0 : ((Math.atan2(B, A) * 180) / Math.PI + 360) % 360;
  return { l: L, c, h };
}

export function oklchToRgb({ l, c, h }: Oklch): Rgb {
  const rad = (h * Math.PI) / 180;
  const A = c * Math.cos(rad), B = c * Math.sin(rad);
  const l_ = (l + 0.3963377774 * A + 0.2158037573 * B) ** 3;
  const m_ = (l - 0.1055613458 * A - 0.0638541728 * B) ** 3;
  const s_ = (l - 0.0894841775 * A - 1.291485548 * B) ** 3;
  return {
    r: toGamma(4.0767416621 * l_ - 3.3077115913 * m_ + 0.2309699292 * s_),
    g: toGamma(-1.2684380046 * l_ + 2.6097574011 * m_ - 0.3413193965 * s_),
    b: toGamma(-0.0041960863 * l_ - 0.7034186147 * m_ + 1.707614701 * s_),
  };
}

const inGamut = ({ r, g, b }: Rgb): boolean =>
  [r, g, b].every((v) => v >= -1e-4 && v <= 1 + 1e-4);

/** Reduce croma pana intra in sRGB, pastrand L si H (binary search, 16 pasi). */
export function toSrgbGamut(color: Oklch): Oklch {
  if (inGamut(oklchToRgb(color))) return color;
  let lo = 0, hi = color.c;
  for (let i = 0; i < 16; i += 1) {
    const mid = (lo + hi) / 2;
    if (inGamut(oklchToRgb({ ...color, c: mid }))) lo = mid; else hi = mid;
  }
  return { ...color, c: lo };
}

export const formatOklch = ({ l, c, h }: Oklch): string =>
  `oklch(${(l * 100).toFixed(2)}% ${c.toFixed(4)} ${h.toFixed(2)})`;
```

```ts
// src/lib/theme/contrast.ts — WCAG 2.1 (sursa de adevar) + APCA informativ
import { hexToRgb, oklchToRgb, rgbToHex, rgbToOklch, toSrgbGamut, type Oklch, type Rgb } from './oklch';

const relLuminance = ({ r, g, b }: Rgb): number => {
  const f = (v: number): number => (v <= 0.04045 ? v / 12.92 : ((v + 0.055) / 1.055) ** 2.4);
  return 0.2126 * f(r) + 0.7152 * f(g) + 0.0722 * f(b);
};

export function contrastRatio(a: Rgb, b: Rgb): number {
  const la = relLuminance(a), lb = relLuminance(b);
  const [hi, lo] = la > lb ? [la, lb] : [lb, la];
  return (hi + 0.05) / (lo + 0.05);
}

export const WCAG_AA_TEXT = 4.5;
export const WCAG_AA_LARGE = 3;   // >=24px sau >=18.66px bold
export const WCAG_AA_NON_TEXT = 3; // borduri, iconuri, focus ring

/** Alege automat culoarea de text peste un fundal dat. Prefera tokenul de brand
 *  (ink #14213D) daca trece pragul; altfel alb; altfel negru pur ca ultima solutie. */
export function pickForeground(bgHex: string, min: number = WCAG_AA_TEXT): string {
  const bg = hexToRgb(bgHex);
  const candidates = ['#14213D', '#FFFFFF', '#000000'] as const;
  const scored = candidates.map((hex) => ({ hex, ratio: contrastRatio(bg, hexToRgb(hex)) }));
  const passing = scored.filter((s) => s.ratio >= min);
  const pool = passing.length > 0 ? passing : scored;
  return pool.reduce((best, s) => (s.ratio > best.ratio ? s : best)).hex;
}

export type ContrastCheck = Readonly<{
  ratio: number; passesAA: boolean; passesAALarge: boolean; suggestion: string | null;
}>;

/** Cea mai apropiata culoare conforma: pastreaza H si C, muta doar L in OKLCh
 *  (minimizeaza deriva perceptuala de nuanta). Cauta in ambele directii, alege
 *  varianta cu cel mai mic |ΔL| care trece pragul. */
export function nearestCompliant(fgHex: string, bgHex: string, min = WCAG_AA_TEXT): string | null {
  const bg = hexToRgb(bgHex);
  const base = rgbToOklch(hexToRgb(fgHex));
  const search = (dir: -1 | 1): { hex: string; dl: number } | null => {
    let lo = base.l, hi = dir === -1 ? 0 : 1;
    const test = (l: number): boolean => {
      const rgb = oklchToRgb(toSrgbGamut({ ...base, l }));
      return contrastRatio(bg, rgb) >= min;
    };
    if (!test(hi)) return null;
    for (let i = 0; i < 20; i += 1) {
      const mid = (lo + hi) / 2;
      if (test(mid)) hi = mid; else lo = mid;
    }
    return { hex: rgbToHex(oklchToRgb(toSrgbGamut({ ...base, l: hi }))), dl: Math.abs(hi - base.l) };
  };
  const options = [search(-1), search(1)].filter((o): o is { hex: string; dl: number } => o !== null);
  if (options.length === 0) return null;
  return options.reduce((a, b) => (a.dl <= b.dl ? a : b)).hex;
}

export function checkContrast(fgHex: string, bgHex: string): ContrastCheck {
  const ratio = contrastRatio(hexToRgb(fgHex), hexToRgb(bgHex));
  return {
    ratio: Math.round(ratio * 100) / 100,
    passesAA: ratio >= WCAG_AA_TEXT,
    passesAALarge: ratio >= WCAG_AA_LARGE,
    suggestion: ratio >= WCAG_AA_TEXT ? null : nearestCompliant(fgHex, bgHex),
  };
}

/** APCA simplificat, DOAR informativ in UI-ul de super-admin. Nu blocheaza salvarea. */
export function apcaLc(fgHex: string, bgHex: string): number {
  const y = (hex: string): number => {
    const { r, g, b } = hexToRgb(hex);
    return 0.2126729 * r ** 2.4 + 0.7151522 * g ** 2.4 + 0.072175 * b ** 2.4;
  };
  const yt = y(fgHex), yb = y(bgHex);
  const raw = yb > yt ? (yb ** 0.56 - yt ** 0.57) * 1.14 : (yb ** 0.65 - yt ** 0.62) * 1.14;
  return Math.round(Math.abs(raw) * 100);
}
```

```ts
// src/lib/theme/scale.ts — generarea scalei din culoarea primara aleasa de admin
import { formatOklch, hexToRgb, oklchToRgb, rgbToHex, rgbToOklch, toSrgbGamut } from './oklch';
import { pickForeground, WCAG_AA_NON_TEXT, contrastRatio } from './contrast';

export const SHADES = [50, 100, 200, 300, 400, 500, 600, 700, 800, 900, 950] as const;
export type Shade = (typeof SHADES)[number];

// Rampa de luminozitate calibrata pe navy #0F1E3D ca sa iasa 900 ≈ paleta implicita.
const L_RAMP: Readonly<Record<Shade, number>> = {
  50: 0.972, 100: 0.938, 200: 0.878, 300: 0.802, 400: 0.716, 500: 0.632,
  600: 0.548, 700: 0.462, 800: 0.378, 900: 0.296, 950: 0.212,
};
// Croma urmeaza o clopotnita: extremele se desatureaza, mijlocul ramane viu.
const C_CURVE: Readonly<Record<Shade, number>> = {
  50: 0.16, 100: 0.30, 200: 0.52, 300: 0.74, 400: 0.92, 500: 1.0,
  600: 0.98, 700: 0.90, 800: 0.78, 900: 0.64, 950: 0.48,
};

export type ThemeTokens = Readonly<Record<string, string>>;

/** Scala completa + culorile de text derivate automat. Totul rulat pe server. */
export function buildBrandScale(primaryHex: string): ThemeTokens {
  const base = rgbToOklch(hexToRgb(primaryHex));
  // Referinta de croma: croma bazei normalizata la pozitia ei pe rampa.
  const refC = Math.min(base.c, 0.37);
  const entries = SHADES.map((shade) => {
    const color = toSrgbGamut({ l: L_RAMP[shade], c: refC * C_CURVE[shade], h: base.h });
    return [shade, { css: formatOklch(color), hex: rgbToHex(oklchToRgb(color)) }] as const;
  });
  const byShade = Object.fromEntries(entries);
  const tokens: Record<string, string> = {};
  for (const [shade, v] of entries) {
    tokens[`--brand-${shade}`] = v.css;
    tokens[`--brand-${shade}-fg`] = pickForeground(v.hex);
  }
  // Alias-uri semantice. Actiunea principala = 700 (contrast bun pe crem si pe alb).
  const action = byShade[700].hex;
  tokens['--brand'] = byShade[700].css;
  tokens['--brand-fg'] = pickForeground(action);
  tokens['--brand-hover'] = byShade[800].css;
  tokens['--brand-active'] = byShade[900].css;
  // Ring-ul de focus trebuie sa aiba 3:1 fata de crem; coboram pana trece.
  const ring = SHADES.find((s) => contrastRatio(hexToRgb(byShade[s].hex), hexToRgb('#FAF7F0')) >= WCAG_AA_NON_TEXT) ?? 700;
  tokens['--brand-ring'] = byShade[ring].css;
  return Object.freeze(tokens);
}
```

**Maparea paletei implicite a platformei în tokens** (`src/app/globals.css`). Regula "crem = fundal, navy = structură/acțiuni, auriu = rar" se codifică prin faptul că accentul auriu **nu are** utilitare de fundal generice — există doar `--accent` folosit de 3 componente (badge „Premium”, marcaj perioadă activă în calendar, subliniere KPI principal).

```css
/* src/app/globals.css */
@import "tailwindcss";
@plugin "tailwindcss-animate";

/* Paleta FIXA a platformei: nu depinde de organizatie. */
@theme {
  --color-navy-900: #0F1E3D;   /* structura, butoane primare pe crem */
  --color-navy-800: #1B2A4E;   /* hover */
  --color-navy-700: #2A3D66;   /* activ / pressed */
  --color-cream-50: #FAF7F0;   /* fundal aplicatie */
  --color-cream-100: #F2EDE1;  /* surface: carduri, headere de tabel */
  --color-ink: #14213D;        /* text pe crem — 13.6:1 pe #FAF7F0 */
  --color-accent: #C9A227;     /* AURIU — folosit RAR, niciodata pentru text pe crem */
  --color-success: #1F7A5C;
  --color-warning: #B7791F;
  --color-danger: #B3261E;
  --color-line: #E3DBC9;

  --radius-card: 0.75rem;
  --font-sans: "Inter Variable", system-ui, sans-serif;
}

/* Valori implicite ale brandului = navy, suprascrise per organizatie din server. */
:root {
  --brand: oklch(24.20% 0.0640 265.5);
  --brand-fg: #FFFFFF;
  --brand-hover: oklch(28.5% 0.0620 265.5);
  --brand-active: oklch(33.0% 0.0600 265.5);
  --brand-ring: oklch(45.0% 0.0700 265.5);
  --brand-50: oklch(97.2% 0.0100 265.5);
  /* ... restul scalei, aceleasi nume ca in buildBrandScale */

  --background: var(--color-cream-50);
  --foreground: var(--color-ink);
  --card: #FFFFFF;
  --muted: var(--color-cream-100);
  --border: var(--color-line);
}

/* `inline` => utilitarele Tailwind emit var(--brand-*), deci suprascrierea
   runtime de pe <html> functioneaza fara recompilare. */
@theme inline {
  --color-primary: var(--brand);
  --color-primary-foreground: var(--brand-fg);
  --color-primary-hover: var(--brand-hover);
  --color-primary-active: var(--brand-active);
  --color-primary-50: var(--brand-50);
  --color-primary-100: var(--brand-100);
  --color-primary-200: var(--brand-200);
  --color-primary-300: var(--brand-300);
  --color-primary-400: var(--brand-400);
  --color-primary-500: var(--brand-500);
  --color-primary-600: var(--brand-600);
  --color-primary-700: var(--brand-700);
  --color-primary-800: var(--brand-800);
  --color-primary-900: var(--brand-900);
  --color-primary-950: var(--brand-950);
  --color-background: var(--background);
  --color-foreground: var(--foreground);
  --color-card: var(--card);
  --color-border: var(--border);
  --color-ring: var(--brand-ring);
}
```

**Injectarea din server, fără flash și fără `useEffect`.** Variabilele se pun ca `style` inline pe `<html>` — `<html>` *este* `:root`, deci cascada e identică cu un `:root {}`, iar HTML-ul ajunge la browser deja colorat.

```tsx
// src/app/(app)/layout.tsx  (RSC)
import type { CSSProperties, ReactNode } from 'react';
import { buildBrandScale } from '@/lib/theme/scale';
import { resolveTenant } from '@/lib/tenant/resolve-tenant';
import { getOrgBranding } from '@/lib/tenant/branding';

export const dynamic = 'force-dynamic'; // tema depinde de organizatia activa

export default async function AppLayout({ children }: { children: ReactNode }) {
  const tenant = await resolveTenant();                 // singurul loc care stie de subdomenii
  const branding = await getOrgBranding(tenant.organizationId); // cache React + unstable_cache 5 min
  const themeVars = buildBrandScale(branding.primaryHex) as unknown as CSSProperties;
  return (
    <html lang="ro" style={themeVars} suppressHydrationWarning>
      <body className="min-h-dvh bg-background text-foreground antialiased">{children}</body>
    </html>
  );
}
```

```tsx
// src/app/(platform)/super-admin/organizations/[id]/branding/contrast-preview.tsx  ('use client')
'use client';
import { useMemo } from 'react';
import { checkContrast, apcaLc } from '@/lib/theme/contrast';
import { buildBrandScale } from '@/lib/theme/scale';

export function ContrastPreview({ primaryHex, onFix }: { primaryHex: string; onFix: (hex: string) => void }) {
  const { onCream, onWhite, tokens } = useMemo(() => ({
    onCream: checkContrast(primaryHex, '#FAF7F0'),
    onWhite: checkContrast(primaryHex, '#FFFFFF'),
    tokens: buildBrandScale(primaryHex),
  }), [primaryHex]);

  return (
    <div className="space-y-3" style={tokens as React.CSSProperties}>
      {[['pe crem (#FAF7F0)', onCream], ['pe alb (#FFFFFF)', onWhite]].map(([label, c]) => {
        const check = c as ReturnType<typeof checkContrast>;
        return (
          <div key={label as string} className="flex items-center gap-3 rounded-card border border-border p-3">
            <span className="text-sm">{label as string}</span>
            <span className="font-mono text-sm">{check.ratio.toFixed(2)}:1</span>
            <span className="text-xs text-muted-foreground">APCA Lc {apcaLc(primaryHex, '#FAF7F0')}</span>
            {check.passesAA ? (
              <span className="text-success text-sm">Conform WCAG 2.1 AA</span>
            ) : (
              <div className="flex items-center gap-2">
                <span className="text-danger text-sm">
                  Sub pragul de 4,5:1 — textul nu va fi lizibil pentru toți utilizatorii.
                </span>
                {check.suggestion !== null && (
                  <button type="button" onClick={() => onFix(check.suggestion as string)}
                    className="rounded-md bg-primary px-2 py-1 text-xs text-primary-foreground hover:bg-primary-hover">
                    Folosește {check.suggestion} (cea mai apropiată conformă)
                  </button>
                )}
              </div>
            )}
          </div>
        );
      })}
    </div>
  );
}
```

Server Action-ul de salvare re-validează (strat 2): dacă `checkContrast(primaryHex, '#FFFFFF').ratio < 3` → refuz cu mesaj, culoarea nu poate fi salvată nici prin API.

---

## 2. Layout

| Zonă | shadcn/ui | Custom |
|---|---|---|
| Sidebar | `Sidebar` (blocul complet: `SidebarProvider`, `SidebarMenu`, `SidebarRail`, `SidebarTrigger`), `Collapsible`, `Tooltip` (label când e colapsat) | `<NavTree />` — filtrează itemii după feature flags + `role_permissions` **pe server**, primește doar itemii permiși |
| Topbar | `Breadcrumb`, `Command`+`CommandDialog`, `DropdownMenu`, `Avatar`, `Popover`, `Badge`, `Separator`, `ScrollArea` | `<OrgSwitcher />`, `<GlobalSearch />`, `<NotificationBell />` |
| Mobil | `Sheet` (sidebar → drawer, gestionat nativ de `SidebarProvider` prin `isMobile`), `Drawer` (vaul) pentru filtre/acțiuni | `<PortalBottomNav />` |
| Restul | `Table`+TanStack Table, `Form`, `Dialog`, `Sonner`, `Tabs`, `Select`, `Calendar` | `<DataTableShell />` (toolbar + paginare + stări) |

**Persistarea stării sidebar-ului, fără flash:** cookie `sidebar_state`, citit în layout-ul server și pasat ca `defaultOpen`. Zero JS la primul paint.

```tsx
// src/app/(app)/(dashboard)/layout.tsx
import { cookies } from 'next/headers';
import { SidebarProvider, SidebarInset } from '@/components/ui/sidebar';

export default async function DashboardLayout({ children }: { children: React.ReactNode }) {
  const store = await cookies();
  const defaultOpen = store.get('sidebar_state')?.value !== 'false';
  const nav = await getNavigationForCurrentUser(); // flags + permisiuni, server-side
  return (
    <SidebarProvider defaultOpen={defaultOpen}>
      <AppSidebar items={nav} />
      <SidebarInset>
        <Topbar />
        <main className="flex-1 p-4 md:p-6">{children}</main>
      </SidebarInset>
    </SidebarProvider>
  );
}
```

`SidebarProvider` scrie `document.cookie = "sidebar_state=..; max-age=31536000; path=/"` la fiecare toggle (comportament implicit shadcn) — nu adăugăm cod propriu.

**Cmd+K:** `CommandDialog` + Server Action `searchGlobal(q)` care întoarce rezultate grupate (Angajați / Concedii / Vehicule / Documente), fiecare grup filtrat de RLS și de feature flags. Debounce 200 ms, `useTransition`, rezultatele recente în `localStorage` doar ca ID-uri (nu date personale).

**Selector de organizație:** `DropdownMenu` care apelează Server Action `switchOrganization(orgId)` → validează apartenența în `organization_members`, scrie cookie `active_org` httpOnly + `revalidatePath('/', 'layout')`. Clientul nu trimite niciodată `organization_id` către alte endpoint-uri.

**Portalul Angajatului** — route group separat `src/app/(portal)/` cu shell propriu, mobile-first: fără sidebar, `<PortalBottomNav />` cu 5 destinații (Acasă, Prezență, Concedii, Documente, Profil), ținte de atingere ≥ 44px, `Drawer` (vaul) pentru orice formular, liste ca `Card`-uri (nu `Table`), `viewport-fit=cover` + `env(safe-area-inset-bottom)`, acțiunile principale (Pontaj intrare/ieșire, Cerere concediu) ca buton lat sticky. TanStack Query doar aici, pentru pontajul optimist.

---

## 3. Stări obligatorii: loading / empty / error / succes

```tsx
// src/components/state/skeletons.tsx
export const TableSkeleton = ({ rows = 8, cols = 5 }: { rows?: number; cols?: number }) => (
  <div className="rounded-card border border-border" role="status" aria-label="Se încarcă datele">
    <div className="flex gap-4 border-b border-border bg-muted p-3">
      {Array.from({ length: cols }, (_, i) => <Skeleton key={i} className="h-4 flex-1" />)}
    </div>
    {Array.from({ length: rows }, (_, r) => (
      <div key={r} className="flex gap-4 border-b border-border p-3 last:border-0">
        {Array.from({ length: cols }, (_, c) => <Skeleton key={c} className="h-4 flex-1" />)}
      </div>
    ))}
  </div>
);
export const CardGridSkeleton = ({ count = 6 }: { count?: number }) => (/* ... */ null);
export const FormSkeleton = ({ fields = 6 }: { fields?: number }) => (/* ... */ null);
```

```tsx
// src/components/state/empty-state.tsx  (RSC-safe)
import type { LucideIcon } from 'lucide-react';

type EmptyStateProps = Readonly<{
  icon: LucideIcon; title: string; description: string;
  action?: { label: string; href: string } | null;
  secondary?: React.ReactNode;
}>;

export function EmptyState({ icon: Icon, title, description, action, secondary }: EmptyStateProps) {
  return (
    <div className="flex flex-col items-center justify-center rounded-card border border-dashed border-border bg-card px-6 py-16 text-center">
      <Icon className="mb-4 size-10 text-primary-400" aria-hidden />
      <h3 className="text-lg font-semibold">{title}</h3>
      <p className="mt-1 max-w-prose text-sm text-muted-foreground">{description}</p>
      {action && (
        <Button asChild className="mt-6"><Link href={action.href}>{action.label}</Link></Button>
      )}
      {secondary}
    </div>
  );
}
// Utilizare: title="Niciun angajat înregistrat", description="Adaugă primul angajat
// sau importă lista din fișier Excel.", action={{ label: 'Adaugă angajat', href: '/angajati/nou' }}
```

```tsx
// src/components/state/error-state.tsx  ('use client' — are onClick)
'use client';
export function ErrorState({ title = 'Nu am putut încărca datele', description, onRetry, correlationId }: {
  title?: string; description?: string; onRetry: () => void; correlationId?: string;
}) {
  return (
    <div role="alert" className="rounded-card border border-danger/30 bg-danger/5 p-8 text-center">
      <AlertTriangle className="mx-auto mb-3 size-8 text-danger" aria-hidden />
      <h3 className="font-semibold">{title}</h3>
      <p className="mt-1 text-sm text-muted-foreground">
        {description ?? 'A apărut o eroare de rețea sau de server. Încearcă din nou.'}
      </p>
      <Button variant="outline" className="mt-5" onClick={onRetry}>
        <RotateCcw className="mr-2 size-4" aria-hidden />Reîncearcă
      </Button>
      {correlationId && <p className="mt-3 font-mono text-xs text-muted-foreground">Cod eroare: {correlationId}</p>}
    </div>
  );
}
```

**Convenția pe rută** (impusă prin lint rule custom: orice `page.tsx` sub `(app)` trebuie să aibă frați `loading.tsx` și `error.tsx`):

```
src/app/(app)/angajati/
├─ page.tsx        # RSC: <Suspense fallback={<TableSkeleton/>}><EmployeesTable …/></Suspense>
├─ loading.tsx     # export default () => <PageSkeleton><TableSkeleton/></PageSkeleton>
├─ error.tsx       # 'use client'; ({error, reset}) => <ErrorState onRetry={reset} correlationId={error.digest}/>
└─ _components/employees-table.tsx  # async RSC; daca rows.length===0 → <EmptyState/>
```

Regulă: `loading.tsx` acoperă navigarea; `<Suspense>` la nivel de secțiune acoperă streamingul (fiecare card de dashboard e propriul `Suspense`, ca un query lent să nu blocheze pagina). **Empty ≠ error ≠ zero rezultate la filtrare** — trei mesaje distincte, al treilea cu acțiune „Șterge filtrele".

**Succes:** `sonner` + `useActionState`. Server Action întoarce `ActionResult<T> = { ok: true; data: T } | { ok: false; error: string; fieldErrors?: Record<string,string[]> }`. Nu aruncă niciodată excepții spre client; `fieldErrors` se mapează în `react-hook-form` prin `setError`. Toast de succes cu text concret („Cererea de concediu a fost trimisă spre aprobare.”), nu „Salvat”.

---

## 4. PDF: `@react-pdf/renderer` — recomandare fermă

| Criteriu | `@react-pdf/renderer` | Puppeteer în Edge Function |
|---|---|---|
| Rulare în Supabase Edge Function (Deno) | **Da**, prin `npm:@react-pdf/renderer` | **Nu.** Deno Edge Runtime nu are Chromium, nu poate lansa procese, are ~256 MB memorie. Ar trebui un serviciu extern (browserless) — dependență + cost + date de salariu la terți |
| Bundle | ~1,4 MB minificat + fonturi embedate; sub limita funcției | 300+ MB Chromium sau apel HTTP la terț |
| Cold start | 150–400 ms | 1,5–4 s (lansare browser) sau latență rețea |
| Diacritice RO | Control total: font embedat + subsetare cu fontkit; garantat identic pe orice mediu | Depinde de fonturile din imaginea Chromium; pe imagini slim lipsesc Ș/Ț și apar tofu |
| Fidelitate A4 la print | Foarte bună pentru documente structurate (mm exacți, fără reflow de browser) | Superioară pentru layout HTML complex/CSS avansat |
| Cost | Zero infrastructură suplimentară | Serviciu extern facturat per render |
| Volum (fluturași × 500 angajați) | Randare secvențială în worker, ~40–80 ms/doc | Nefezabil în buget de timp/memorie |

Documentele noastre sunt formulare cu tabele fixe — exact zona unde `@react-pdf/renderer` e puternic și unde CSS-ul avansat nu lipsește. **Excepția**: dacă apare cerință de „PDF identic cu un HTML deja stilizat”, se rezolvă punctual, nu se schimbă arhitectura.

**Unde rulează:** un singur pachet `src/pdf/` cu documentele, importat din două locuri — Route Handler Node (`export const runtime = 'nodejs'`) pentru descărcare individuală și Edge Function `generate-documents` (invocată de `pg_cron` prin `pg_net`) pentru loturi lunare care scriu în Storage. *Risc asumat:* dacă `npm:@react-pdf/renderer` dă probleme în Deno, planul B este ca `pg_cron` să apeleze Route Handler-ul Node cu un token de serviciu — schimbare într-un singur fișier.

**Fonturi cu ă, â, î, ș (U+0219), ț (U+021B):** DejaVu Sans acoperă complet Latin Extended-B; Noto Sans idem. Se comite `Regular` + `Bold` în repo (`src/pdf/fonts/`), **nu** se descarcă la runtime.

```ts
// src/pdf/fonts.ts
import { Font } from '@react-pdf/renderer';
import { readFileSync } from 'node:fs';
import { join } from 'node:path';

const dir = join(process.cwd(), 'src/pdf/fonts');
Font.register({
  family: 'DejaVuSans',
  fonts: [
    { src: readFileSync(join(dir, 'DejaVuSans.ttf')), fontWeight: 400 },
    { src: readFileSync(join(dir, 'DejaVuSans-Bold.ttf')), fontWeight: 700 },
  ],
});
// Fara asta, @react-pdf sparge cuvintele cu diacritice in locuri gresite.
Font.registerHyphenationCallback((word) => [word]);

const CEDILLA_TO_COMMA: ReadonlyMap<string, string> = new Map([
  ['\u015E', '\u0218'], ['\u015F', '\u0219'], // Ş ş -> Ș ș
  ['\u0162', '\u021A'], ['\u0163', '\u021B'], // Ţ ţ -> Ț ț
]);

/** Datele vechi din ERP-uri romanesti contin cedila (gresit tipografic) si
 *  forme descompuse. Normalizam la NFC + virgula inainte de randare. */
export const roText = (input: string): string =>
  input.normalize('NFC').replace(/[\u015E\u015F\u0162\u0163]/g, (c) => CEDILLA_TO_COMMA.get(c) ?? c);
```

```tsx
// src/pdf/documents/foaie-colectiva-prezenta.tsx  (A4 landscape, 31 coloane)
import { Document, Page, Text, View, StyleSheet } from '@react-pdf/renderer';
import { roText } from '../fonts';

const s = StyleSheet.create({
  page: { fontFamily: 'DejaVuSans', fontSize: 7, paddingTop: 14, paddingHorizontal: 12, paddingBottom: 20 },
  title: { fontSize: 11, fontWeight: 700, textAlign: 'center', marginBottom: 6 },
  row: { flexDirection: 'row', borderBottomWidth: 0.5, borderColor: '#333' },
  name: { width: 120, padding: 2, borderRightWidth: 0.5, borderColor: '#333' },
  day: { width: 16, padding: 2, textAlign: 'center', borderRightWidth: 0.5, borderColor: '#333' },
});

export const FoaieColectivaPrezenta = ({ luna, organizatie, randuri }: FoaieProps) => (
  <Document title={`Foaie colectivă de prezență ${luna}`} author={organizatie}>
    <Page size="A4" orientation="landscape" style={s.page} wrap>
      <Text style={s.title}>{roText(`FOAIE COLECTIVĂ DE PREZENȚĂ — ${organizatie} — ${luna}`)}</Text>
      <View style={s.row} fixed>
        <Text style={s.name}>Nume și prenume</Text>
        {Array.from({ length: 31 }, (_, i) => <Text key={i} style={s.day}>{i + 1}</Text>)}
      </View>
      {randuri.map((r) => (
        <View key={r.employeeId} style={s.row} wrap={false}>
          <Text style={s.name}>{roText(r.numeComplet)}</Text>
          {r.zile.map((z, i) => <Text key={i} style={s.day}>{z}</Text>)}
        </View>
      ))}
      <Text fixed style={{ position: 'absolute', bottom: 8, right: 12 }}
        render={({ pageNumber, totalPages }) => `Pagina ${pageNumber} din ${totalPages}`} />
    </Page>
  </Document>
);
```

---

## 5. Testarea izolării între tenanți (cloud, fără Docker)

**Resetarea bazei de test** — proiect Supabase dedicat `administrativo-test`, separat de dev și producție:

```bash
# scripts/reset-test-db.sh
set -euo pipefail
: "${SUPABASE_TEST_PROJECT_REF:?lipseste SUPABASE_TEST_PROJECT_REF}"
: "${SUPABASE_TEST_DB_PASSWORD:?lipseste SUPABASE_TEST_DB_PASSWORD}"
# Bariera anti-accident: nu resetam niciodata proiectul de productie.
if [ "$SUPABASE_TEST_PROJECT_REF" = "nybmhorngsajoqaxjlbr" ]; then
  echo "REFUZ: proiectul tinta este cel de productie."; exit 1
fi
supabase link --project-ref "$SUPABASE_TEST_PROJECT_REF" -p "$SUPABASE_TEST_DB_PASSWORD"
# --linked ruleaza pe proiectul cloud: dropeaza schema, rejoaca supabase/migrations/, apoi seed.sql.
supabase db reset --linked --yes
# Curatam utilizatorii ramasi din rulari anterioare (auth.users nu e atins de reset-ul schemei publice).
psql "$SUPABASE_TEST_DB_URL" -v ON_ERROR_STOP=1 \
  -c "delete from auth.users where email like '%@rls-test.invalid';"
```

Nu e nevoie de Docker: `db reset --linked` și `psql` lucrează direct pe Postgres-ul cloud. Testele RLS rulează **serializat** (`concurrency` în CI) pentru că resetează baza.

```ts
// tests/rls/setup.ts
import { createClient, type SupabaseClient } from '@supabase/supabase-js';
import postgres from 'postgres';

const need = (k: string): string => {
  const v = process.env[k];
  if (!v) throw new Error(`Variabila de mediu ${k} lipseste`);
  return v;
};
export const env = {
  url: need('SUPABASE_TEST_URL'),
  anonKey: need('SUPABASE_TEST_ANON_KEY'),
  serviceKey: need('SUPABASE_TEST_SERVICE_ROLE_KEY'),
  dbUrl: need('SUPABASE_TEST_DB_URL'),
} as const;

export const sql = postgres(env.dbUrl, { prepare: false, max: 4 });
export const admin: SupabaseClient = createClient(env.url, env.serviceKey, {
  auth: { persistSession: false, autoRefreshToken: false },
});

export type Actor = Readonly<{ userId: string; email: string; orgId: string; client: SupabaseClient }>;

/** Creeaza un utilizator real + membru intr-o organizatie si intoarce un client cu JWT-ul lui. */
export async function createActor(orgId: string, role: string, tag: string): Promise<Actor> {
  const email = `${tag}-${crypto.randomUUID().slice(0, 8)}@rls-test.invalid`;
  const password = `Test!${crypto.randomUUID()}`;
  const { data: created, error: cErr } = await admin.auth.admin.createUser({
    email, password, email_confirm: true,
  });
  if (cErr || !created.user) throw new Error(`createUser esuat: ${cErr?.message}`);
  await sql`insert into public.organization_members (organization_id, user_id, role, status)
            values (${orgId}, ${created.user.id}, ${role}::app_role, 'active')`;
  const anon = createClient(env.url, env.anonKey, { auth: { persistSession: false, autoRefreshToken: false } });
  const { data: session, error: sErr } = await anon.auth.signInWithPassword({ email, password });
  if (sErr || !session.session) throw new Error(`signIn esuat: ${sErr?.message}`);
  return { userId: created.user.id, email, orgId, client: anon };
}

export type TableInfo = Readonly<{
  name: string; rlsEnabled: boolean; rlsForced: boolean;
  hasOrgId: boolean; commands: ReadonlySet<string>;
}>;

/** Descopera TOATE tabelele din schema public direct din catalog (nu prin PostgREST). */
export async function discoverTables(): Promise<readonly TableInfo[]> {
  const rows = await sql<Array<{
    name: string; rls: boolean; forced: boolean; has_org: boolean; cmds: string[];
  }>>`
    select c.relname as name,
           c.relrowsecurity as rls,
           c.relforcerowlevelsecurity as forced,
           exists (select 1 from information_schema.columns col
                   where col.table_schema = 'public' and col.table_name = c.relname
                     and col.column_name = 'organization_id') as has_org,
           coalesce((select array_agg(distinct p.cmd::text)
                     from pg_policies p
                     where p.schemaname = 'public' and p.tablename = c.relname), '{}') as cmds
    from pg_class c
    join pg_namespace n on n.oid = c.relnamespace
    where n.nspname = 'public' and c.relkind = 'r'
      and c.relname not like 'pg_%' and c.relname <> 'schema_migrations'
    order by c.relname`;
  return rows.map((r) => ({
    name: r.name, rlsEnabled: r.rls, rlsForced: r.forced, hasOrgId: r.has_org,
    commands: new Set(r.cmds),
  }));
}
```

```ts
// tests/rls/tenant-isolation.spec.ts
import { beforeAll, afterAll, describe, expect, it } from 'vitest';
import { admin, createActor, discoverTables, sql, type Actor, type TableInfo } from './setup';

/** Tabele fara organization_id, deliberat globale. Orice tabela noua care NU e aici
 *  si nu are organization_id => testul pica si obliga la o decizie explicita. */
const GLOBAL_TABLES: ReadonlySet<string> = new Set([
  'organizations',        // RLS: doar organizatiile in care esti membru
  'role_permissions',     // matricea de permisiuni, lizibila de oricine autentificat
  'feature_definitions',  // catalog module
  'county_registry',      // nomenclator judete
  'legal_values',         // valori fiscale cu istoric
  'audit_log',            // are organization_id, dar e append-only si nelizibil clientilor
]);
const REQUIRED_COMMANDS = ['SELECT', 'INSERT', 'UPDATE', 'DELETE'] as const;

let tables: readonly TableInfo[];
let alfa: Actor;   // org A
let beta: Actor;   // org B
let orgA: string;
let orgB: string;

beforeAll(async () => {
  // Fixture-ul creeaza DOUA organizatii complete, cu cel putin un rand in fiecare
  // tabela tenant-scoped. Fisier: supabase/tests/fixtures/two-orgs.sql
  const fixture = await Bun.file?.('supabase/tests/fixtures/two-orgs.sql').text()
    ?? (await import('node:fs/promises')).readFile('supabase/tests/fixtures/two-orgs.sql', 'utf8');
  await sql.unsafe(await fixture);
  const [a, b] = await sql<Array<{ id: string; slug: string }>>`
    select id, slug from public.organizations where slug in ('alfa-test', 'beta-test') order by slug`;
  orgA = a.id; orgB = b.id;
  alfa = await createActor(orgA, 'org_admin', 'alfa');
  beta = await createActor(orgB, 'org_admin', 'beta');
  tables = await discoverTables();
  expect(tables.length, 'nicio tabela descoperita — fixture-ul sau migrarile nu s-au aplicat').toBeGreaterThan(10);
}, 120_000);

afterAll(async () => {
  await admin.auth.admin.deleteUser(alfa.userId);
  await admin.auth.admin.deleteUser(beta.userId);
  await sql.end();
});

describe('(a) RLS activat pe FIECARE tabela', () => {
  it('nicio tabela din public fara row level security', () => {
    const fara = tables.filter((t) => !t.rlsEnabled).map((t) => t.name);
    expect(fara, `Tabele FARA RLS activat: ${fara.join(', ')}`).toEqual([]);
  });

  it('RLS fortat si pentru proprietarul tabelei', () => {
    const nefortate = tables.filter((t) => !t.rlsForced).map((t) => t.name);
    expect(nefortate, `Tabele fara FORCE ROW LEVEL SECURITY: ${nefortate.join(', ')}`).toEqual([]);
  });
});

describe('(c) acoperire cu politici pe fiecare operatie', () => {
  it.each(REQUIRED_COMMANDS)('exista politica pentru %s pe fiecare tabela', (cmd) => {
    const lipsa = tables
      .filter((t) => !t.commands.has(cmd) && !t.commands.has('ALL'))
      .map((t) => t.name);
    expect(lipsa, `Tabele fara politica ${cmd}: ${lipsa.join(', ')}`).toEqual([]);
  });
});

describe('(b) izolare de citire intre organizatii', () => {
  it('fiecare tabela tenant-scoped este acoperita de fixture pentru org B', async () => {
    const tenant = tables.filter((t) => t.hasOrgId && !GLOBAL_TABLES.has(t.name));
    const goale: string[] = [];
    for (const t of tenant) {
      const [{ count }] = await sql<Array<{ count: number }>>`
        select count(*)::int as count from ${sql(t.name)} where organization_id = ${orgB}`;
      if (count === 0) goale.push(t.name);
    }
    // Fara date in org B, testul de scurgere ar trece fals-pozitiv.
    expect(goale, `Fixture incomplet — fara randuri pentru org B in: ${goale.join(', ')}`).toEqual([]);
  }, 60_000);

  it('userul din org A nu vede NICIUN rand din org B', async () => {
    const tenant = tables.filter((t) => t.hasOrgId);
    const scurgeri: string[] = [];
    for (const t of tenant) {
      const { data, error } = await alfa.client.from(t.name).select('organization_id').limit(1000);
      if (error) {
        // 42501 / tabela nelizibila = acceptabil (deny-by-default). Orice altceva e suspect.
        if (!['42501', 'PGRST301', '42P01'].includes(error.code ?? '')) {
          scurgeri.push(`${t.name}: eroare neasteptata ${error.code} ${error.message}`);
        }
        continue;
      }
      const straine = (data ?? []).filter((r) => (r as { organization_id: string }).organization_id !== orgA);
      if (straine.length > 0) scurgeri.push(`${t.name}: ${straine.length} randuri din alta organizatie`);
    }
    expect(scurgeri, `SCURGERE INTRE TENANTI:\n${scurgeri.join('\n')}`).toEqual([]);
  }, 120_000);

  it('userul din org A nu poate scrie in org B', async () => {
    const { error } = await alfa.client.from('departments')
      .insert({ organization_id: orgB, name: 'Injectat' } as never);
    expect(error, 'INSERT cross-tenant a reusit — politica WITH CHECK lipseste').not.toBeNull();
  });

  it('clientul anonim nu citeste nimic', async () => {
    const anon = createAnonClient();
    for (const t of tables) {
      const { data, error } = await anon.from(t.name).select('*').limit(1);
      expect(error !== null || (data ?? []).length === 0, `Tabela ${t.name} e lizibila anonim`).toBe(true);
    }
  }, 60_000);

  it('datele sensibile nu sunt lizibile nici de propriul org_admin prin PostgREST', async () => {
    const { data, error } = await alfa.client.from('employee_sensitive_data').select('*').limit(1);
    expect(error !== null || (data ?? []).length === 0,
      'employee_sensitive_data trebuie citita DOAR prin Server Action cu audit').toBe(true);
  });
});
```

```ts
// vitest.rls.config.ts — proiect separat, secvential, fara paralelism
import { defineConfig } from 'vitest/config';
export default defineConfig({
  test: {
    include: ['tests/rls/**/*.spec.ts'],
    fileParallelism: false,
    pool: 'forks',
    poolOptions: { forks: { singleFork: true } },
    hookTimeout: 180_000,
    testTimeout: 180_000,
    globalSetup: ['tests/rls/global-setup.ts'], // ruleaza scripts/reset-test-db.sh
  },
});
```

---

## 6. Notificări: outbox tranzacțional + dispecer

**Arhitectură:** Server Action-ul **nu trimite niciodată** email direct. Scrie, în aceeași tranzacție cu modificarea de business, două rânduri: `notifications` (in-app) și `notification_outbox` (email). Un dispecer separat trimite.

```
Server Action ──(1 tranzactie, RPC plpgsql)──► notifications + notification_outbox
                                                        │
                             Supabase Realtime ◄────────┤ (in-app, instant)
                                                        │
   pg_cron la 1 min ──► pg_net ──► Edge Function `dispatch-notifications`
                                          │ claim FOR UPDATE SKIP LOCKED (lot de 50)
                                          ├─► Resend API (Idempotency-Key = outbox.id)
                                          └─► update status/attempts/provider_message_id
   Resend webhook ──► Edge Function `resend-webhook` ──► delivered | bounced | complained
```

**Dubla trimitere se evită pe 3 nivele:** (1) index unic pe `(dedupe_key)` în outbox — cheia e deterministă, ex. `leave_request:{id}:approved:{approver_id}`, deci un retry al acțiunii nu creează al doilea rând; (2) `FOR UPDATE SKIP LOCKED` + `status='sending'` — două invocări concurente ale dispecerului nu iau același rând; (3) `Idempotency-Key` trimis către Resend — dacă răspunsul se pierde după ce Resend a acceptat, reîncercarea nu retrimite.

**Eșec de livrare:** `attempts++`, `next_attempt_at = now() + (interval '1 min' * pow(3, attempts))` (1m, 3m, 9m, 27m, 81m), maximum 5 încercări; apoi `status='dead'`, notificare in-app către `org_admin` („Emailul către X nu a putut fi livrat”) și rândul rămâne vizibil în ecranul „Jurnal notificări” cu buton „Retrimite”. `bounced`/`complained` din webhook marchează `user_email_status='suppressed'` și opresc trimiterile viitoare fără să blocheze in-app-ul. Erorile 4xx de la Resend (adresă invalidă) sunt terminale — fără retry.

**Modul de test (DNS neconfigurat):** `RESEND_MODE=test` → dispecerul scrie în `notification_outbox.rendered_html` și marchează `status='sent_test'` fără apel HTTP; `RESEND_MODE=redirect` → toate emailurile merg la `RESEND_TEST_INBOX`, cu subiectul prefixat `[TEST → destinatar_real]`. Un singur `if` în adaptorul `src/lib/email/resend-adapter.ts`.

**In-app + Realtime:** da, `supabase.channel('notif').on('postgres_changes', { event: 'INSERT', schema: 'public', table: 'notifications', filter: `user_id=eq.${userId}` })`. RLS pe `notifications` filtrează `user_id = auth.uid()`; publicația Realtime respectă RLS. Clopoțelul afișează contorul din server la primul render (fără flash), apoi îl incrementează din Realtime. Marcarea ca citit = Server Action, nu update direct din client.

---

## 7. CI — GitHub Actions

```yaml
# .github/workflows/ci.yml
name: CI
on:
  pull_request:
  push: { branches: [main] }
concurrency: { group: ci-${{ github.ref }}, cancel-in-progress: true }
env:
  NODE_VERSION: '22'

jobs:
  static:
    name: Typecheck, lint, teste unitare
    runs-on: ubuntu-latest
    steps:
      - uses: actions/checkout@v4
      - uses: pnpm/action-setup@v4
      - uses: actions/setup-node@v4
        with: { node-version: '${{ env.NODE_VERSION }}', cache: pnpm }
      - run: pnpm install --frozen-lockfile
      - name: Typecheck (strict, zero any)
        run: pnpm tsc --noEmit
      - name: Lint
        run: pnpm eslint . --max-warnings=0
      - name: Formatare
        run: pnpm prettier --check .
      - name: Teste unitare + acoperire
        run: pnpm vitest run --coverage --coverage.thresholds.lines=80 --coverage.thresholds.functions=80

  migrations:
    name: Migrarile aplica curat pe baza goala + tipuri sincronizate
    runs-on: ubuntu-latest
    services:
      postgres:
        image: supabase/postgres:15.8.1.020
        env: { POSTGRES_PASSWORD: postgres }
        ports: ['5432:5432']
        options: >-
          --health-cmd "pg_isready -U postgres" --health-interval 5s
          --health-timeout 5s --health-retries 20
    steps:
      - uses: actions/checkout@v4
      - uses: supabase/setup-cli@v1
        with: { version: latest }
      - name: Aplica toate migrarile pe o baza complet goala
        env: { DB_URL: 'postgresql://postgres:postgres@localhost:5432/postgres' }
        run: |
          for f in supabase/migrations/*.sql; do
            echo "→ $f"
            psql "$DB_URL" -v ON_ERROR_STOP=1 -f "$f"
          done
      - name: Verifica idempotenta seed-ului
        run: psql "postgresql://postgres:postgres@localhost:5432/postgres" -v ON_ERROR_STOP=1 -f supabase/seed.sql
      - name: Regenereaza tipurile si verifica ca nu difera de cele comise
        run: |
          supabase gen types typescript \
            --db-url "postgresql://postgres:postgres@localhost:5432/postgres" \
            --schema public > src/types/database.generated.ts
          git diff --exit-code -- src/types/database.generated.ts \
            || { echo "::error::Tipurile sunt invechite. Ruleaza 'pnpm db:types' si comite rezultatul."; exit 1; }

  rls:
    name: Izolarea intre tenanti (proiect Supabase de test)
    runs-on: ubuntu-latest
    if: github.event_name == 'push' || github.event.pull_request.head.repo.full_name == github.repository
    concurrency: { group: rls-test-project, cancel-in-progress: false }  # baza e partajata: serializam
    env:
      SUPABASE_TEST_PROJECT_REF: ${{ secrets.SUPABASE_TEST_PROJECT_REF }}
      SUPABASE_TEST_DB_PASSWORD: ${{ secrets.SUPABASE_TEST_DB_PASSWORD }}
      SUPABASE_TEST_DB_URL: ${{ secrets.SUPABASE_TEST_DB_URL }}
      SUPABASE_TEST_URL: ${{ secrets.SUPABASE_TEST_URL }}
      SUPABASE_TEST_ANON_KEY: ${{ secrets.SUPABASE_TEST_ANON_KEY }}
      SUPABASE_TEST_SERVICE_ROLE_KEY: ${{ secrets.SUPABASE_TEST_SERVICE_ROLE_KEY }}
      SUPABASE_ACCESS_TOKEN: ${{ secrets.SUPABASE_ACCESS_TOKEN }}
    steps:
      - uses: actions/checkout@v4
      - uses: pnpm/action-setup@v4
      - uses: actions/setup-node@v4
        with: { node-version: '${{ env.NODE_VERSION }}', cache: pnpm }
      - uses: supabase/setup-cli@v1
      - run: pnpm install --frozen-lockfile
      - name: Reset baza de test (cloud, fara Docker)
        run: bash scripts/reset-test-db.sh
      - name: Teste de izolare RLS
        run: pnpm vitest run --config vitest.rls.config.ts --reporter=verbose

  build:
    name: Build productie
    runs-on: ubuntu-latest
    needs: [static]
    steps:
      - uses: actions/checkout@v4
      - uses: pnpm/action-setup@v4
      - uses: actions/setup-node@v4
        with: { node-version: '${{ env.NODE_VERSION }}', cache: pnpm }
      - run: pnpm install --frozen-lockfile
      - name: Build
        env:
          NEXT_PUBLIC_SUPABASE_URL: https://placeholder.supabase.co
          NEXT_PUBLIC_SUPABASE_ANON_KEY: placeholder
          ENCRYPTION_KEY: ${{ secrets.CI_DUMMY_ENCRYPTION_KEY }}
          RESEND_MODE: test
        run: pnpm build
      - name: Buget de bundle
        run: pnpm size-limit

  e2e:
    name: E2E Playwright
    runs-on: ubuntu-latest
    needs: [rls, build]
    if: github.event_name == 'push'
    steps:
      - uses: actions/checkout@v4
      - uses: pnpm/action-setup@v4
      - uses: actions/setup-node@v4
        with: { node-version: '${{ env.NODE_VERSION }}', cache: pnpm }
      - run: pnpm install --frozen-lockfile
      - run: pnpm exec playwright install --with-deps chromium
      - run: pnpm exec playwright test
        env:
          NEXT_PUBLIC_SUPABASE_URL: ${{ secrets.SUPABASE_TEST_URL }}
          NEXT_PUBLIC_SUPABASE_ANON_KEY: ${{ secrets.SUPABASE_TEST_ANON_KEY }}
      - uses: actions/upload-artifact@v4
        if: failure()
        with: { name: playwright-report, path: playwright-report/, retention-days: 7 }
```

Jobul `migrations` rulează pe imaginea `supabase/postgres` ca *service container* (GitHub Actions, nu Docker pe mașina dezvoltatorului) — respectă „fără Docker local” și verifică migrările pe o bază complet goală. Jobul `rls` folosește proiectul cloud de test.

---

## 8. i18n: pregătit pentru next-intl, livrând doar `ro`

Fără segment `[locale]` în rute acum (ar dubla toate căile pentru zero beneficiu). Locale-ul vine dintr-un singur loc, `getLocale()`, care astăzi întoarce constanta `'ro'`; când apare a doua limbă se schimbă acolo + se adaugă middleware-ul next-intl.

```
src/i18n/
├─ config.ts                # LOCALES = ['ro'] as const; DEFAULT_LOCALE = 'ro'
├─ request.ts               # getRequestConfig: locale, messages, timeZone, formats
├─ get-locale.ts            # singurul loc care decide limba (azi: 'ro')
└─ messages/ro/
   ├─ common.json           # butoane, stari, validari — folosite peste tot
   ├─ nav.json              # meniu, breadcrumb
   ├─ auth.json
   ├─ employees.json        # un fisier per MODUL, aliniat 1:1 cu feature flags
   ├─ attendance.json  leave.json  fleet.json  ssm.json  maintenance.json
   ├─ inventory.json  onboarding.json  announcements.json  payroll.json
   ├─ per-diem.json  employee-portal.json
   └─ documents.json        # texte din PDF-uri (formulare oficiale)
```

```ts
// src/i18n/request.ts
import { getRequestConfig } from 'next-intl/server';
import { getLocale } from './get-locale';

const NAMESPACES = ['common','nav','auth','employees','attendance','leave','fleet','ssm',
  'maintenance','inventory','onboarding','announcements','payroll','perDiem',
  'employeePortal','documents'] as const;

const fileOf = (ns: string): string => ns.replace(/[A-Z]/g, (c) => `-${c.toLowerCase()}`);

export default getRequestConfig(async () => {
  const locale = await getLocale();
  const loaded = await Promise.all(
    NAMESPACES.map(async (ns) => [ns, (await import(`./messages/${locale}/${fileOf(ns)}.json`)).default] as const),
  );
  return {
    locale,
    messages: Object.fromEntries(loaded),
    timeZone: 'Europe/Bucharest',
    now: new Date(),
    formats: {
      dateTime: {
        short: { day: '2-digit', month: '2-digit', year: 'numeric' },       // 17.08.2026
        long: { day: 'numeric', month: 'long', year: 'numeric' },
      },
      number: {
        lei: { style: 'currency', currency: 'RON', minimumFractionDigits: 2 }, // 1.234,56 RON
        hours: { minimumFractionDigits: 1, maximumFractionDigits: 2 },
      },
    },
  };
});
```

```ts
// src/types/i18n.d.ts — chei tipate, greselile de cheie devin erori de compilare
import type ro from '@/i18n/messages-index';
declare module 'next-intl' {
  interface AppConfig {
    Messages: typeof ro;
    Locale: 'ro';
    Formats: { dateTime: { short: object; long: object }; number: { lei: object; hours: object } };
  }
}
```

Reguli ca să nu devină povară: (1) **un namespace per modul**, niciodată un `ro.json` monolit — un fișier nou apare odată cu modulul; (2) chei ierarhice cu sens semantic (`employees.list.empty.title`), nu textul ca și cheie; (3) toate textele UI trec prin `useTranslations`/`getTranslations` de la început, inclusiv mesajele de eroare din Server Actions (întorc chei, nu propoziții); (4) regulă ESLint `no-literal-string` limitată la `src/app/**` și `src/components/**` ca să prindă textele scăpate; (5) formatarea datelor/sumelor **nu** trece prin i18n — folosim `date-fns` cu `ro` și `Intl.NumberFormat('ro-RO')` prin helperi în `src/lib/format/`, deci schimbarea limbii nu atinge formatarea fiscală românească, care rămâne fixă indiferent de limba interfeței.