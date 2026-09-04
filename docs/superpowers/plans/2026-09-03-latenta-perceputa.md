# Latența percepută — plan de implementare

> **Pentru lucrătorii agentici:** SUB-SKILL OBLIGATORIU: folosește
> `superpowers:subagent-driven-development` (recomandat) sau
> `superpowers:executing-plans` ca să execuți planul sarcină cu sarcină. Pașii
> folosesc casete (`- [ ]`) pentru urmărire.

**Scop:** Un clic în ERP-ul Administrativo răspunde vizibil imediat și se termină în ~0,45 s la
navigare / ~1,0 s la salvare, de la 1,2–2,5 s / 2,8–3,3 s azi — fără infrastructură nouă.

**Arhitectură:** Nu se adaugă cache. Se **elimină** apeluri de rețea (verificare locală a JWT-ului
în locul unui drum la GoTrue), se **paralelizează** citiri care erau înlănțuite fără motiv, se
**oprește** o rafală de prefetch care se auto-invalidează, și se **arată** utilizatorului că i s-a
înregistrat clicul. Ordinea e parte din design: instrumentul întâi, ca fiecare câștig să fie
dovedibil.

**Tehnologii:** Next.js 16.3 (App Router, `proxy.ts`) · React 19.2 · `@supabase/ssr` 0.12.4 ·
`@supabase/supabase-js` 2.112.3 · Vitest 3 (trei proiecte: `unit`/node, `ui`/happy-dom, `rls`) ·
Docker Swarm, 2 replici · nginx partajat, 10 site-uri.

**Spec:** `docs/superpowers/specs/2026-09-03-latenta-perceputa-design.md` — planul argumentează din
spec; se citesc amândouă.

---

## Constrângeri globale

- **Limba:** cod, comentarii, mesaje și identificatori de domeniu în **română**, cu ș/ț cu virgulă
  dedesubt (`ș` U+0219, `ț` U+021B), **niciodată** cu sedilă turcească (U+015F, U+0163 — caractere
  pe care documentul ăsta le numește, nu le scrie). Mesajele de
  eroare se termină cu punct. Un test existent apără regula: `src/content/landing/continut.test.ts`.
- **`pnpm build` E INTERZIS local** (cerință explicită a utilizatorului, repetată de două ori).
  Lanțul de verificare al fiecărei sarcini e `pnpm typecheck && pnpm lint && pnpm test`. Ce rămâne
  de prins de build se **declară** în sarcina respectivă.
- **Linia de bază, măsurată 2026-09-03 07:57:** typecheck curat · lint 0 erori / **1 avertisment
  preexistent** (`src/app/(platform)/super-admin/organizatii/[orgId]/membri/panou-membri.tsx:173`,
  react-hook-form) · teste **2902 ✓ / 1 ✗ preexistent**
  (`src/content/landing/continut.test.ts`, sedilă turcească în `src/content/landing/contact.ts`,
  din diff-ul necomis al altei sesiuni). **Constată roșeața înainte de a scrie primul rând** —
  altfel o vei atribui muncii tale. Poarta corectă după fiecare sarcină e „2902 + N trec, același
  unul cade", nu „totul verde".
- **Arborele e partajat cu alte sesiuni.** `git status --short -- <căile tale>` înaintea oricărui
  `git add`; `git commit --only -- <căile tale>`; `git fetch origin main` și `git merge origin/main`
  (niciodată rebase) înaintea lui `git push`. Niciodată `git add -A` sau `.`.
- **Arborele e murdar acum** cu 11 fișiere ale altei sesiuni (`src/app/layout.tsx`,
  `src/content/landing/*.ts` ș.a.). Build-ul Docker ia întreg directorul ca context — orice rebuild
  ar publica munca lor. Sarcinile care cer rebuild folosesc rețeta de worktree curat din
  `DEPLOY.md:245-263`.
- **Nicio migrare, nicio schimbare de RLS, niciun `createAdminSupabase()`.** Planul nu atinge baza.
- **Fără agenți de implementare.** Memoria proiectului: 6 agenți paraleli au produs 91 de erori de
  compilare din căi de import inventate. Scrii direct, cu `Write`/`Edit`.

## Structura fișierelor

| fișier                                    | responsabilitate                                             | sarcină |
| ----------------------------------------- | ------------------------------------------------------------ | ------- |
| `deploy/nginx/30-administrativo.ro.conf`  | **sursa de adevăr** a vhostului; `log_format` + `access_log` | 0       |
| `src/components/data/rand-tabel.tsx`      | rândul apăsabil; capătă tranziție + afordant local           | 1       |
| `src/components/data/rand-tabel.test.tsx` | **nou** — apără feedbackul la clic                           | 1       |
| `src/lib/auth/current-user.ts`            | „cine e utilizatorul?"; trece pe verificare locală           | 2       |
| `src/lib/auth/current-user.test.ts`       | **nou** — apără maparea claims → `AuthUser`                  | 2       |
| `src/lib/supabase/middleware.ts`          | reîmprospătarea sesiunii; trece pe verificare locală         | 3       |
| `src/proxy.ts`                            | ieșiri devreme + matcher                                     | 3, 4    |
| `src/proxy.test.ts`                       | **nou** — apără ordinea ieșirilor                            | 4       |
| `next.config.ts`                          | `staleTimes.dynamic`                                         | 5       |
| `src/instrumentation.ts`                  | **nou** — dispatcher undici cu keep-alive lung               | 6       |
| `package.json`, `pnpm-lock.yaml`          | `undici` ca dependință reală                                 | 6       |
| `src/lib/actions/create-action.ts`        | preambulul acțiunii: `Promise.all` + audit în `after()`      | 7, 8    |
| `src/app/(app)/**/page.tsx`               | preambulul paginii: `Promise.all`                            | 9       |

---

## Sarcina 0: Jurnalizarea duratelor în nginx

**De ce prima:** azi jurnalul n-are nicio durată. Fără ea nici lentoarea nu se confirmă retroactiv,
nici reparația nu se dovedește — adică toate sarcinile care urmează ar fi necontrolabile.

**Nu e TDD.** E în afara codului aplicației; poarta e empirică.

**Fișiere:**

- Modifică: `deploy/nginx/30-administrativo.ro.conf`

**Interfețe:**

- Produce: jurnalul `/var/log/nginx/administrativo.log`, format `durate`, citit de toate sarcinile
  următoare ca serie de referință.

- [ ] **Pas 1: Citește vhostul și găsește blocul `map`**

```bash
sed -n '20,60p' deploy/nginx/30-administrativo.ro.conf
diff deploy/nginx/30-administrativo.ro.conf /srv/apps/Strawboss/nginx/conf.d/30-administrativo.ro.conf && echo "IDENTICE"
```

Așteptat: `IDENTICE`. Dacă diferă, **oprește-te** — cineva a editat copia live direct, iar
`nginx:vhost` ar șterge acea editare. Rezolvă divergența înainte de a continua.

- [ ] **Pas 2: Adaugă `log_format` la nivel de fișier, lângă `map`**

`log_format` **trebuie** să stea în contextul `http`. Fișierele din `conf.d` sunt incluse exact
acolo (`nginx.conf:31`), deci se pune la nivelul superior al fișierului, lângă `map
$connection_upgrade` — nu în `server{}`. **O singură declarație în tot VM-ul**: un `log_format`
duplicat face `nginx -t` să pice și blochează reload-ul pentru toate cele 10 site-uri.

```nginx
# `main` (implicitul nginx) n-are nici $host, nici vreo durată — de aceea seria
# istorică din `docker logs` nu se poate nici filtra pe site, nici folosi la o
# comparație înainte/după. Formatul ăsta le adaugă pe amândouă.
#
# $request_time  = de la primul octet citit de la client la ultimul trimis;
#                  include rețeaua omului. E ce SIMTE utilizatorul.
# $upstream_response_time = doar Next.js. E termenul onest pentru „am reparat".
#
# La nivel de fișier, nu în server{}: `log_format` cere contextul http, iar
# conf.d e inclus exact acolo (nginx.conf:31) — la fel ca `map` de mai jos.
# O A DOUA declarație, oriunde pe VM, face `nginx -t` să pice cu „duplicate
# log_format" și blochează reload-ul pentru toate cele 10 site-uri.
log_format durate '$remote_addr $host "$request" $status $body_bytes_sent '
                  'rt=$request_time urt=$upstream_response_time';
```

- [ ] **Pas 3: Adaugă `access_log` în `server{}`-ul de pe 443, fără să-l pierzi pe cel moștenit**

Un `access_log` în `server{}` **suprascrie** moștenirea din `http` — nu se adaugă la ea. Fără
prima linie de mai jos, traficul dispare din `docker logs strawboss-nginx-1` și
`./administrativo.sh logs:nginx` rămâne gol, fără nicio eroare.

```nginx
    # Două destinații, deliberat. Prima păstrează comportamentul de dinainte
    # (o directivă access_log în server{} SUPRASCRIE moștenirea din http, nu o
    # completează). A doua e seria de referință pentru lucrul la latență.
    #
    # NU trimite `durate` tot în /dev/stdout: jurnalul json-file al nginx are
    # deja 780 MB, fără max-size, pe un disc ocupat 81%.
    access_log /dev/stdout main;
    access_log /var/log/nginx/administrativo.log durate;
```

- [ ] **Pas 4: Instalează vhostul prin unealta proiectului**

```bash
./administrativo.sh nginx:vhost
```

Face backup ca `<vhost>.anterior.bak` (extensie deliberat non-`.conf`, altfel `include conf.d/*.conf`
l-ar încărca și ar produce `server_name` duplicat), rulează `nginx -t`, dă reload, și face rollback
automat dacă testul pică (`ops/06-nginx.sh:145-157`).

**NU** edita `conf.d` cu `mv`/`rm`/rsync-cu-redenumire: dacă inode-ul directorului e înlocuit cât
timp containerul rulează, montarea devine stale — directorul apare gol înăuntru, `nginx -t` **trece**
(un config gol e valid), iar primul reload lasă fără serviciu toate site-urile.

- [ ] **Pas 5: Confirmă că jurnalul curge**

```bash
curl -s -o /dev/null https://administrativo.ro/
docker exec strawboss-nginx-1 tail -n 5 /var/log/nginx/administrativo.log
```

Așteptat: rânduri cu `rt=` și `urt=`. Dacă fișierul nu există, nginx nu l-a putut crea — verifică
`docker exec strawboss-nginx-1 nginx -t`.

- [ ] **Pas 6: Strânge seria de referință și scoate-o din container**

Rulează cel puțin câteva ore de trafic real. Apoi:

```bash
docker cp strawboss-nginx-1:/var/log/nginx/administrativo.log ./referinta-latenta-$(date +%Y%m%d).log
awk '{for(i=1;i<=NF;i++) if($i ~ /^rt=/){split($i,a,"="); print a[2]}}' referinta-latenta-*.log \
  | sort -n | awk '{v[NR]=$1} END {print "n="NR, "p50="v[int(NR*0.5)], "p90="v[int(NR*0.9)], "p99="v[int(NR*0.99)]}'
```

**Copierea în afara containerului e obligatorie:** jurnalul trăiește în stratul de scriere și se
pierde la orice recreare a containerului. Notează și de la ce imagine pornești
(`docker service ls | grep administrativo`) — producția rulează azi un tag cu marcaj de timp,
construit dintr-un arbore murdar, deci nu corespunde niciunui commit curat.

- [ ] **Pas 7: Commit**

```bash
git status --short -- deploy/nginx/
git commit --only -m "perf(nginx): jurnalizează duratele pe vhostul aplicației

Formatul `main` n-are nici \$host, nici vreo durată, deci cele ~3400 de cereri
din 72 h nu se pot nici filtra pe site, nici folosi la o comparație
înainte/după. Fără ele, nicio reparație de latență nu e dovedibilă.

log_format stă la nivel de fișier (conf.d e inclus în contextul http), o
singură dată pe VM: un duplicat face nginx -t să pice și blochează reload-ul
pentru toate cele 10 site-uri.

access_log e declarat de două ori în server{} deliberat — o directivă în
server SUPRASCRIE moștenirea din http, iar fără prima linie traficul ar fi
dispărut din docker logs fără nicio eroare.

Co-Authored-By: Claude Opus 5 <noreply@anthropic.com>
Claude-Session: https://claude.ai/code/session_019x5wtXrnS5AeUPpXchWSJ4" -- deploy/nginx/30-administrativo.ro.conf
```

---

## Sarcina 1: Feedback la clicul pe un rând de tabel

**Fișiere:**

- Modifică: `src/components/data/rand-tabel.tsx`
- Creează: `src/components/data/rand-tabel.test.tsx`

**Interfețe:**

- Consumă: `useSemnalIncarcare(activ: boolean, eticheta?: string | undefined): void` din
  `@/components/incarcare/use-incarcare`; `goleste(): void` și
  `surseCurente(): readonly Sursa[]` din `@/lib/incarcare/depozit`.
- Produce: nimic nou exportat. `RandTabel` își păstrează exact aceleași props
  (`href: string | null`, `children`, `className?`) — `Tabel` (`src/components/ui/tabel.tsx:182`)
  nu se atinge.

**Suprafață:** `RandTabel` nu e importat de nicio pagină (`grep -rln "RandTabel" src/app` → zero).
Ajunge la ecrane exclusiv prin `Tabel`. O editare acoperă 20 de fișiere, 21 de instanțe, 22 de rute.

- [ ] **Pas 1: Scrie testul care pică**

Creează `src/components/data/rand-tabel.test.tsx`:

```tsx
// src/components/data/rand-tabel.test.tsx
import { fireEvent, render, screen } from "@testing-library/react";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

/**
 * `push` întoarce o promisiune care NU se rezolvă, deliberat. React 19 ține
 * tranziția deschisă cât timp promisiunea întoarsă de callback e în curs, iar
 * fără asta `inCurs` ar trece true→false într-un singur ciclu de randare și
 * n-ar rămâne nimic de observat. În aplicație `router.push` întoarce `void`
 * (`app-router-context.shared-runtime.d.ts:37`) și tranziția e ținută deschisă
 * de randarea rutei noi — mecanism diferit, aceeași stare vizibilă.
 */
vi.mock("next/navigation", () => ({
  useRouter: () => ({
    push: vi.fn(() => new Promise(() => {})),
    replace: () => {},
    refresh: () => {},
    prefetch: () => {},
  }),
  usePathname: () => "/angajati",
  useSearchParams: () => new URLSearchParams(),
}));

import { RandTabel } from "./rand-tabel";
import { goleste, surseCurente } from "@/lib/incarcare/depozit";

/**
 * Ce apără fișierul: clicul pe un rând producea `router.push` gol, în afara
 * oricărei tranziții. Nici voalul global nu se aprindea, nici rândul nu se
 * schimba — pe 22 de rute, apăsarea părea pur și simplu ignorată până sosea
 * pagina nouă, la 1,2–2,5 secunde.
 *
 * Cele două straturi verificate aici au roluri diferite: sursa din depozitar
 * aprinde voalul global la `PRAG_VOAL` (400 ms), iar `aria-busy` pe `<tr>` se
 * vede în același cadru cu clicul și spune PE CARE rând s-a apăsat — singura
 * informație pe care un voal peste tot ecranul nu o poate da.
 */
function randeaza(href: string | null) {
  return render(
    <table>
      <tbody>
        <RandTabel href={href}>
          <td>Ionescu Ana</td>
        </RandTabel>
      </tbody>
    </table>,
  );
}

describe("RandTabel", () => {
  beforeEach(() => {
    goleste();
  });
  afterEach(() => {
    goleste();
  });

  it("nu are nicio sursă aprinsă înainte de clic", () => {
    randeaza("/angajati/1");
    expect(surseCurente()).toHaveLength(0);
  });

  it("aprinde o sursă de încărcare la clic pe rând", () => {
    randeaza("/angajati/1");
    fireEvent.click(screen.getByText("Ionescu Ana"));
    expect(surseCurente()).toHaveLength(1);
  });

  it("marchează rândul apăsat cu aria-busy", () => {
    randeaza("/angajati/1");
    const rand = screen.getByRole("row");
    expect(rand.getAttribute("aria-busy")).toBeNull();

    fireEvent.click(screen.getByText("Ionescu Ana"));
    expect(rand.getAttribute("aria-busy")).toBe("true");
  });

  it("nu aprinde a doua sursă la un al doilea clic pe același rând", () => {
    randeaza("/angajati/1");
    const celula = screen.getByText("Ionescu Ana");
    fireEvent.click(celula);
    fireEvent.click(celula);
    // A doua sursă ar rămâne aprinsă după demontare: componenta care pornește
    // navigarea e exact cea pe care navigarea o demontează.
    expect(surseCurente()).toHaveLength(1);
  });

  it("nu navighează pentru un rând fără destinație și nu aprinde nimic", () => {
    randeaza(null);
    fireEvent.click(screen.getByText("Ionescu Ana"));
    expect(surseCurente()).toHaveLength(0);
    expect(screen.getByRole("row").getAttribute("aria-busy")).toBeNull();
  });
});
```

- [ ] **Pas 2: Rulează testul ca să verifici că pică**

```bash
pnpm vitest --run src/components/data/rand-tabel.test.tsx
```

Așteptat: **FAIL** pe „aprinde o sursă de încărcare la clic pe rând" cu
`expected [] to have a length of 1` — componenta încă nu pune nimic în depozitar.

- [ ] **Pas 3: Scrie implementarea**

Înlocuiește integral corpul lui `src/components/data/rand-tabel.tsx` de la importuri în jos:

```tsx
"use client";

import { useRouter } from "next/navigation";
import { useTransition, type MouseEvent, type ReactNode } from "react";

import { useSemnalIncarcare } from "@/components/incarcare/use-incarcare";

/**
 * Rândul întreg navighează la `href`, nu doar coloana cu numele — la cererea
 * explicită de a putea apăsa oriunde pe linie. Linkul accesibil pe nume rămâne
 * neatins pentru tastatură/cititor de ecran; acesta e strict o comoditate de
 * mouse suplimentară.
 *
 * Click-urile pe orice element interactiv din interiorul rândului (linkul de
 * pe nume, un buton de acțiune secundară, un checkbox) NU declanșează
 * navigarea dublă — `closest()` le lasă să-și facă treaba lor.
 *
 * DE CE O TRANZIȚIE, ȘI DE CE DOUĂ SEMNE
 * `router.push` gol nu spunea nimănui nimic: pe cele 22 de rute care folosesc
 * tabelul, apăsarea nu schimba niciun pixel până sosea pagina nouă, la peste o
 * secundă. Tranziția dă două lucruri diferite:
 *   - sursa din depozitar aprinde voalul GLOBAL, dar abia la `PRAG_VOAL`
 *     (400 ms, pragul Doherty — sub el un indicator e clipire, nu informație);
 *   - `aria-busy` + estomparea se văd în același cadru cu clicul și spun PE CARE
 *     rând s-a apăsat, singura informație pe care un voal peste tot ecranul nu
 *     o poate da pe o listă de rânduri identice.
 */
export function RandTabel({
  href,
  children,
  className = "",
}: {
  /** `null` când rândul nu are nicio destinație (ex. entitatea legată e ascunsă de RLS) — rândul rămâne un `<tr>` simplu, fără click. */
  readonly href: string | null;
  readonly children: ReactNode;
  readonly className?: string;
}) {
  const router = useRouter();
  // Cele două hook-uri stau ÎNAINTEA ieșirii devreme de mai jos. `href === null`
  // e un caz real, nu teoretic — apare ori de câte ori RLS ascunde entitatea
  // legată — iar sub acea ramură Rules of Hooks ar fi încălcată la primul astfel
  // de rând, adică exact pe ecranele cu drepturi parțiale.
  const [inCurs, porneste] = useTransition();
  useSemnalIncarcare(inCurs);

  if (href === null) {
    return <tr className={className}>{children}</tr>;
  }
  const destinatie = href;

  function gestioneazaClick(evenimet: MouseEvent<HTMLTableRowElement>): void {
    const tinta = evenimet.target as HTMLElement;
    if (tinta.closest("a, button, input, select, textarea, label")) return;
    // Al doilea clic cât timp primul încă navighează ar pune o a doua sursă în
    // depozitar, iar componenta e demontată de chiar navigarea pe care a
    // pornit-o: a doua ar rămâne aprinsă până la `PLAFON_TARE`, 30 de secunde.
    if (inCurs) return;
    // Corp-EXPRESIE, nu bloc: `router.push` întoarce `void` în aplicație, dar
    // React 19 ține tranziția deschisă dacă i se întoarce o promisiune. Forma
    // asta rămâne corectă dacă Next ajunge vreodată să întoarcă una.
    porneste(() => router.push(destinatie));
  }

  const claseStare = inCurs ? "opacity-60 cursor-wait" : "cursor-pointer";

  return (
    // `hover:bg-background` era `bg-background` peste `bg-background`: DELTA
    // ZERO. Rândul avea `cursor-pointer` și niciun răspuns vizual la trecerea
    // mouse-ului. `surface` (#f2ede1) pe `background` (#faf7f0) se vede.
    <tr
      onClick={gestioneazaClick}
      aria-busy={inCurs || undefined}
      className={`hover:bg-surface ${claseStare} ${className}`}
    >
      {children}
    </tr>
  );
}
```

- [ ] **Pas 4: Rulează testul ca să verifici că trece**

```bash
pnpm vitest --run src/components/data/rand-tabel.test.tsx
```

Așteptat: **5 passed**.

- [ ] **Pas 5: Rulează lanțul complet**

```bash
pnpm typecheck && pnpm lint && pnpm test 2>&1 | tail -8
```

Așteptat: typecheck curat · lint 1 avertisment preexistent · **2907 ✓ / 1 ✗ preexistent**.

- [ ] **Pas 6: Verificare vizuală (manuală, o dată)**

`opacity` pe `<tr>` e bine suportat, dar tabelele proiectului folosesc `border-collapse` și au deja
o coloană lipită. Deschide o listă (ex. `/angajati`), apasă pe un rând și confirmă: rândul se
estompează, bordurile nu sar, coloana lipită rămâne pe loc. Dacă sar, înlocuiește `opacity-60` cu o
schimbare de fundal și notează asta în commit.

- [ ] **Pas 7: Commit**

```bash
git status --short -- src/components/data/
git commit --only -m "perf(ui): rândul de tabel răspunde la clic

router.push era gol, în afara oricărei tranziții: pe cele 22 de rute care
folosesc <Tabel href>, apăsarea nu schimba niciun pixel până sosea pagina
nouă, la 1,2–2,5 s. Nici voalul global nu se aprindea — nu avea de la ce.

Două semne, cu roluri diferite: sursa din depozitar aprinde voalul global la
PRAG_VOAL (400 ms, pragul Doherty), iar aria-busy + estomparea se văd în
același cadru cu clicul și spun PE CARE rând s-a apăsat — ce un voal peste
tot ecranul nu poate.

Hook-urile stau înaintea ieșirii devreme pentru href === null: e un caz real
(RLS ascunde entitatea legată), iar sub ramura aceea Rules of Hooks ar fi
încălcată exact pe ecranele cu drepturi parțiale.

Un singur fișier atinge 20 de pagini: RandTabel nu e importat de niciuna,
ajunge la ele doar prin Tabel (tabel.tsx:182).

Co-Authored-By: Claude Opus 5 <noreply@anthropic.com>
Claude-Session: https://claude.ai/code/session_019x5wtXrnS5AeUPpXchWSJ4" -- src/components/data/rand-tabel.tsx src/components/data/rand-tabel.test.tsx
```

---

## Sarcina 2: `getClaims()` în `current-user.ts`

**Postul cel mai mare din registru.** ~90 ms de rețea per randare → ~1,7 ms de verificare locală.

**Fișiere:**

- Modifică: `src/lib/auth/current-user.ts:1-33`
- Creează: `src/lib/auth/current-user.test.ts`

**Interfețe:**

- Consumă: `createServerSupabase(): Promise<ServerSupabase>` din `@/lib/supabase/server`.
- Produce: `getCurrentUser(): Promise<AuthUser | null>` — **semnătură neschimbată**.
  `AuthUser = Readonly<{ id: string; email: string; fullName: string | null }>`
  (`src/lib/tenant/types.ts:41-45`). Consumatorii (`resolveTenant`, `isPlatformAdmin`,
  `listUserOrganizations`, `requireUser`) nu se ating.

**Fapte verificate, de care depinde codul:**

- `getClaims()` fără argument cheamă `getSession()` (`GoTrueClient.js:5325`), care cheamă
  `_callRefreshToken()` la expirare (`:2554`) — **reîmprospătarea se păstrează**.
- `JwtPayload extends RequiredClaims` (`types.d.ts:1660-1695`): `sub: string` e obligatoriu,
  `email?: string` și `user_metadata?: UserMetadata` sunt opționale.
- Proiectul are chei asimetrice: `jwks.json` întoarce EC P-256, `alg ES256`.

- [ ] **Pas 1: Scrie testul care pică**

Creează `src/lib/auth/current-user.test.ts` (proiectul `unit`, node — are aliasul `server-only`):

```ts
// src/lib/auth/current-user.test.ts
import { beforeEach, describe, expect, it, vi } from "vitest";

/**
 * Ce apără fișierul: maparea claim-urilor din JWT în `AuthUser`, și mai ales
 * garda de la intrare.
 *
 * `getClaims()` are TREI variante de retur, nu două: succes,
 * `{ data: null, error: AuthError }`, și `{ data: null, error: null }` pentru
 * un vizitator fără sesiune. Un port mecanic al gărzii vechi (scrisă pentru
 * `getUser()`, unde `data` era mereu un obiect) ar trece de a treia variantă și
 * ar da TypeError pe `data.claims`.
 */
const getClaims = vi.fn();

vi.mock("@/lib/supabase/server", () => ({
  createServerSupabase: () => Promise.resolve({ auth: { getClaims } }),
}));

const { getCurrentUser } = await import("./current-user");

describe("getCurrentUser", () => {
  beforeEach(() => {
    getClaims.mockReset();
  });

  it("mapează claim-urile complete în AuthUser", async () => {
    getClaims.mockResolvedValue({
      data: {
        claims: {
          sub: "11111111-1111-4111-8111-111111111111",
          email: "ana@exemplu.ro",
          user_metadata: { full_name: "  Ionescu Ana  " },
        },
      },
      error: null,
    });

    await expect(getCurrentUser()).resolves.toEqual({
      id: "11111111-1111-4111-8111-111111111111",
      email: "ana@exemplu.ro",
      fullName: "Ionescu Ana",
    });
  });

  it("întoarce null când nu există sesiune (data null, error null)", async () => {
    getClaims.mockResolvedValue({ data: null, error: null });
    await expect(getCurrentUser()).resolves.toBeNull();
  });

  it("întoarce null la eroare de verificare", async () => {
    getClaims.mockResolvedValue({ data: null, error: new Error("semnătură invalidă") });
    await expect(getCurrentUser()).resolves.toBeNull();
  });

  it("acceptă un cont fără e-mail și fără nume", async () => {
    getClaims.mockResolvedValue({
      data: { claims: { sub: "22222222-2222-4222-8222-222222222222" } },
      error: null,
    });

    await expect(getCurrentUser()).resolves.toEqual({
      id: "22222222-2222-4222-8222-222222222222",
      email: "",
      fullName: null,
    });
  });

  it("tratează un nume format doar din spații ca lipsă", async () => {
    getClaims.mockResolvedValue({
      data: {
        claims: {
          sub: "33333333-3333-4333-8333-333333333333",
          email: "x@y.ro",
          user_metadata: { full_name: "   " },
        },
      },
      error: null,
    });

    await expect(getCurrentUser()).resolves.toMatchObject({ fullName: null });
  });
});
```

- [ ] **Pas 2: Rulează testul ca să verifici că pică**

```bash
pnpm vitest --run src/lib/auth/current-user.test.ts
```

Așteptat: **FAIL** — `getClaims` nu e chemat de implementarea actuală (care cheamă `getUser`), deci
mock-ul întoarce `undefined` și destructurarea crapă.

- [ ] **Pas 3: Scrie implementarea**

Înlocuiește `src/lib/auth/current-user.ts` integral:

```ts
// src/lib/auth/current-user.ts
import "server-only";

import { redirect } from "next/navigation";
import { cache } from "react";

import { createServerSupabase } from "@/lib/supabase/server";
import type { AuthUser } from "@/lib/tenant/types";

/**
 * Singurul loc din aplicație care întreabă „cine e utilizatorul?”.
 * Memoizat cu `React.cache()`: apelat de N ori într-un render, face un singur
 * drum — iar de la trecerea la `getClaims()`, de cele mai multe ori niciunul.
 */
export const getCurrentUser = cache(async (): Promise<AuthUser | null> => {
  const supabase = await createServerSupabase();

  // getClaims(), nu getUser(). AMÂNDOUĂ sunt de încredere pe server; diferă
  // unde se face verificarea. getUser() întreabă GoTrue peste rețea — ~90 ms de
  // pe VM, plătiți la FIECARE randare. getClaims() verifică semnătura ES256
  // local, cu JWKS-ul cache-uit la nivel de modul (TTL 10 min): 1,7 ms măsurat.
  //
  // Nu slăbește nicio graniță reală. PostgREST verifică și el tot local, cu
  // același JWKS, deci baza accepta oricum același token până la `exp`; iar
  // apartenența la firmă și permisiunile se citesc din bază la fiecare cerere,
  // deci o excludere sau o permisiune retrasă se aplică imediat. Ce se lățește
  // e strict fereastra pentru un cont BLOCAT în GoTrue: până la expirarea
  // access-tokenului. Decizie explicită, luată în specul de latență.
  //
  // FĂRĂ ARGUMENT, deliberat: `getClaims(token)` sare complet peste
  // `getSession()` (GoTrueClient.js:5320-5326) și pierde reînnoirea automată a
  // sesiunii. Nu pasa niciodată jwt-ul.
  const { data, error } = await supabase.auth.getClaims();

  // TREI variante de retur, nu două. A treia — `{ data: null, error: null }` —
  // e vizitatorul fără sesiune, și e singura pe care o gardă scrisă doar pe
  // `error` o lasă să treacă spre un TypeError.
  if (error !== null || data === null) return null;

  const claims = data.claims;

  // `user_metadata` e `{ [key: string]: any }`. Anotarea `unknown` nu e stil:
  // e singurul lucru care ține `any` afară din tipul dedus, iar regulile ESLint
  // tipate (`no-unsafe-*`) nu sunt pornite în acest proiect.
  const numeBrut: unknown = claims.user_metadata?.["full_name"];
  const nume = typeof numeBrut === "string" ? numeBrut.trim() : "";

  return {
    id: claims.sub,
    // `email` e opțional în JwtPayload (types.d.ts:1679), iar `AuthUser.email`
    // e `string`. Conturile fără e-mail nu sunt suportate în Faza 1a (vezi
    // `internal.handle_new_user`), dar tipul le permite.
    email: claims.email ?? "",
    fullName: nume.length > 0 ? nume : null,
  };
});

/** Pentru pagini/layout-uri RSC. În Server Actions se folosește `resolveTenant()`. */
export async function requireUser(): Promise<AuthUser> {
  const user = await getCurrentUser();
  if (user === null) redirect("/autentificare");
  return user;
}
```

- [ ] **Pas 4: Rulează testul ca să verifici că trece**

```bash
pnpm vitest --run src/lib/auth/current-user.test.ts
```

Așteptat: **5 passed**.

- [ ] **Pas 5: Rulează lanțul complet**

```bash
pnpm typecheck && pnpm lint && pnpm test 2>&1 | tail -8
```

Așteptat: **2912 ✓ / 1 ✗ preexistent**.

- [ ] **Pas 6: Commit**

```bash
git status --short -- src/lib/auth/
git commit --only -m "perf(auth): verifică JWT-ul local în getCurrentUser

getUser() întreba GoTrue peste rețea la fiecare randare: ~90 ms măsurat de pe
VM. Proiectul are deja chei asimetrice (jwks.json întoarce EC P-256, ES256),
iar getClaims() verifică semnătura local, cu JWKS-ul cache-uit la nivel de
modul — 1,7 ms măsurat (importKey 0,433 + verify 1,269).

Nu slăbește nicio graniță reală: PostgREST verifică tot local, cu același
JWKS, deci baza accepta oricum același token până la exp. Apartenența la
firmă și permisiunile se citesc din bază la fiecare cerere. Ce se lățește e
strict fereastra pentru un cont blocat în GoTrue.

Reîmprospătarea se păstrează: getClaims() fără argument cheamă getSession(),
care cheamă _callRefreshToken() la expirare. Cu argument ar sări peste ea —
de aceea jwt-ul nu se pasează niciodată.

Garda e pe `data`, nu doar pe `error`: getClaims are trei variante de retur,
iar { data: null, error: null } (vizitator fără sesiune) ar fi trecut de o
gardă scrisă doar pe eroare.

Primul test din proiect care mockuiește lanțul Supabase.

Co-Authored-By: Claude Opus 5 <noreply@anthropic.com>
Claude-Session: https://claude.ai/code/session_019x5wtXrnS5AeUPpXchWSJ4" -- src/lib/auth/current-user.ts src/lib/auth/current-user.test.ts
```

---

## Sarcina 3: `getClaims()` în `middleware.ts` (+ tipul din `proxy.ts`)

Al doilea dintre cele două apeluri. Rulează la **fiecare** cerere care trece de matcher.

**Fișiere:**

- Modifică: `src/lib/supabase/middleware.ts:5, 30-34, 67-79`
- Modifică: `src/proxy.ts:76, 94`

**Interfețe:**

- Consumă: nimic nou.
- Produce: `updateSession(request: NextRequest): Promise<SessionUpdate>` unde
  `SessionUpdate = Readonly<{ response: NextResponse; autentificat: boolean }>`.
  **Câmpul `user` dispare**, înlocuit de `autentificat`. Consumatorul unic e `src/proxy.ts:76`, care
  îl compara doar cu `null` (`:94`) — nu citea niciun câmp.

- [ ] **Pas 1: Confirmă că nimeni altcineva nu citește `user`**

```bash
grep -rn "updateSession" src/
grep -rn "SessionUpdate" src/
```

Așteptat: doar `src/proxy.ts` și `src/lib/supabase/middleware.ts`. Dacă apare altceva, oprește-te
și adaptează.

- [ ] **Pas 2: Schimbă tipul și apelul în `middleware.ts`**

Trei ediții în același fișier, toate obligatorii împreună:

1. Șterge `import type { User } from "@supabase/supabase-js";` de la `:5`. `noUnusedLocals: true`
   face typecheck-ul să pice pe el în clipa în care tipul nu-l mai folosește.

2. Înlocuiește tipul:

```ts
export type SessionUpdate = Readonly<{
  response: NextResponse;
  /**
   * Doar dacă cererea are o sesiune validă. Un `User` întreg ar fi fost o
   * promisiune pe care verificarea locală n-o poate ține: `getClaims()` întoarce
   * claim-urile din token, nu rândul din baza de auth. Singurul consumator —
   * `src/proxy.ts` — nu citea oricum niciun câmp.
   */
  autentificat: boolean;
}>;
```

3. Înlocuiește blocul de la `:67-79` (comentariul care justifică `fetchCuTermen`, apelul, și
   returul):

```ts
    // `fetchCuTermen` rămâne obligatoriu și după trecerea la verificarea locală:
    // acoperă în continuare reînnoirea de token (o dată pe oră per utilizator) și
    // aducerea JWKS-ului (o dată la 10 minute per proces). Un apel fără termen pe
    // oricare din ele agață traficul autentificat, ceea ce s-a și întâmplat pe 23
    // august — doar că acum se întâmplă mai rar, nu deloc.
    global: { fetch: fetchCuTermen() },
  });

  // getClaims(), nu getUser(): verifică semnătura ES256 LOCAL, cu JWKS-ul
  // cache-uit la nivel de modul, în loc să întrebe GoTrue peste rețea la fiecare
  // cerere care trece de matcher — inclusiv fiecare navigare RSC. ~90 ms → 1,7 ms.
  // getSession() singur NU e o alternativă: acela doar decodează cookie-ul, adică
  // date venite de la client, fără să verifice nimic.
  //
  // Fără argument: `getClaims(token)` ar sări peste `getSession()` și ar pierde
  // reînnoirea cookie-urilor sb-*, care e chiar motivul pentru care middleware-ul
  // ăsta există.
  const { data, error } = await supabase.auth.getClaims();

  return { response, autentificat: error === null && data !== null };
}
```

- [ ] **Pas 3: Adaptează `proxy.ts`**

La `:76`: `const { response, user } = await updateSession(request);` devine
`const { response, autentificat } = await updateSession(request);`

La `:94`: `if (user !== null) {` devine `if (autentificat) {`

- [ ] **Pas 4: Rulează lanțul**

```bash
pnpm typecheck && pnpm lint && pnpm test 2>&1 | tail -8
```

Așteptat: neschimbat față de Sarcina 2. Dacă typecheck pică cu `TS6133: 'User' is declared but its
value is never read`, ai uitat pasul 2.1.

- [ ] **Pas 5: Verificare empirică (necesită deploy — se poate amâna la Sarcina 11)**

După deploy, pentru o navigare autentificată, `mcp__supabase__query_logs` nu trebuie să arate
**niciun** `/auth/v1/user`. Va arăta ocazional `/.well-known/jwks.json` — o dată pe proces la 10
minute. Poarta e „zero `/auth/v1/user`", nu „zero cereri către Supabase".

- [ ] **Pas 6: Commit**

```bash
git status --short -- src/lib/supabase/middleware.ts src/proxy.ts
git commit --only -m "perf(auth): verifică JWT-ul local și în middleware

Al doilea dintre cele două getUser() per cerere, și cel mai scump: rula la
fiecare cerere care trece de matcher, inclusiv fiecare navigare RSC și
fiecare prefetch. ~90 ms de rețea, înlocuiți cu 1,7 ms de verificare locală.

SessionUpdate.user (User | null) devine autentificat (boolean): getClaims
întoarce claim-urile din token, nu rândul din baza de auth, iar singurul
consumator — proxy.ts:94 — nu citea oricum niciun câmp. Importul de tip User
se scoate în același edit, altfel noUnusedLocals face typecheck-ul să pice.

fetchCuTermen rămâne: acoperă reînnoirea de token și aducerea JWKS-ului, care
acum se întâmplă mai rar, nu deloc.

Co-Authored-By: Claude Opus 5 <noreply@anthropic.com>
Claude-Session: https://claude.ai/code/session_019x5wtXrnS5AeUPpXchWSJ4" -- src/lib/supabase/middleware.ts src/proxy.ts
```

---

## Sarcina 4: Ieșiri devreme și metadate în matcher (`proxy.ts`)

Trei tăieturi independente în același fișier. Împreună scot cea mai mare parte din amplificarea de
34,9× (11 745 de cereri pentru 336 de documente).

**Fișiere:**

- Modifică: `src/proxy.ts:33-46, 62-72, 76-81, 141`
- Creează: `src/proxy.test.ts`

**Interfețe:**

- Consumă: `updateSession` din Sarcina 3 (`autentificat: boolean`).
- Produce: `proxy(request: NextRequest): Promise<NextResponse>` — semnătură neschimbată.

- [ ] **Pas 1: Confirmă că `icon` nu se ciocnește de o rută reală**

```bash
find src/app -maxdepth 2 -name "icon*" -o -maxdepth 2 -name "apple-icon*" -o -maxdepth 2 -name "*-image*"
grep -rn "icon" src/config/routes.ts src/config/navigation.ts | head
```

Așteptat: doar rutele de metadate generate (`src/app/icon.tsx` ș.a.), nicio rută de aplicație care
începe cu `icon`. Dacă există una, **nu** adăuga `icon` în matcher — folosește un prefix mai lung.

- [ ] **Pas 2: Scrie testul care pică**

Creează `src/proxy.test.ts` (proiectul `unit`, node):

```ts
// src/proxy.test.ts
import { NextRequest, NextResponse } from "next/server";
import { beforeEach, describe, expect, it, vi } from "vitest";

/**
 * Ce apără fișierul: ORDINEA din `proxy()`. Fiecare cerere care ajunge la
 * `updateSession()` plătește o verificare de sesiune și o rescriere de
 * cookie-uri; ieșirile de mai jos există exact ca anumite clase de cereri să nu
 * le plătească.
 *
 * Rutele de API își verifică singure sesiunea și aruncau rezultatul. Prefetch-ul
 * de <Link> se face de zeci de ori per navigare — jurnalul nginx arată 74,7% din
 * trafic ca cereri `?_rsc=`, cu vârfuri de 38 într-o secundă.
 *
 * Testul verifică faptul mecanic (updateSession nu e chemat), nu efectul de
 * viteză, care nu se poate observa dintr-un test unitar.
 */
const updateSession = vi.fn();

vi.mock("@/lib/supabase/middleware", () => ({ updateSession }));

const { proxy } = await import("./proxy");

function cerere(cale: string, antete: Record<string, string> = {}): NextRequest {
  return new NextRequest(new URL(cale, "https://administrativo.ro"), { headers: antete });
}

describe("proxy", () => {
  beforeEach(() => {
    updateSession.mockReset();
    updateSession.mockResolvedValue({
      response: NextResponse.next(),
      autentificat: true,
    });
  });

  it("nu verifică sesiunea pentru rutele de API", async () => {
    await proxy(cerere("/api/reges/sincronizare"));
    expect(updateSession).not.toHaveBeenCalled();
  });

  it("nu verifică sesiunea pentru un prefetch de <Link>", async () => {
    await proxy(cerere("/pontaj", { "Next-Router-Prefetch": "1" }));
    expect(updateSession).not.toHaveBeenCalled();
  });

  it("verifică sesiunea pentru o navigare obișnuită", async () => {
    await proxy(cerere("/pontaj"));
    expect(updateSession).toHaveBeenCalledTimes(1);
  });

  it("verifică sesiunea și pentru o cerere RSC care nu e prefetch", async () => {
    await proxy(cerere("/pontaj", { RSC: "1" }));
    expect(updateSession).toHaveBeenCalledTimes(1);
  });
});
```

- [ ] **Pas 3: Rulează testul ca să verifici că pică**

```bash
pnpm vitest --run src/proxy.test.ts
```

Așteptat: **FAIL** pe primele două — `updateSession` e chemat la `:76`, înaintea oricărei ieșiri.

- [ ] **Pas 4: Mută ieșirile înaintea verificării de sesiune**

Înlocuiește începutul lui `proxy()` (de la `:75` până inclusiv fostul `:81`):

```ts
export async function proxy(request: NextRequest): Promise<NextResponse> {
  const { pathname, search } = request.nextUrl;

  // Rutele de API răspund în JSON și își verifică singure sesiunea. Un redirect
  // 307 către o pagină HTML le-ar strica pe toate, inclusiv webhook-urile.
  //
  // Ies ÎNAINTEA lui `updateSession()`, nu după: verificarea se făcea oricum,
  // iar rezultatul se arunca imediat. Un drum plătit degeaba pe fiecare apel de
  // API.
  if (pathname.startsWith("/api/")) return NextResponse.next({ request });

  // Prefetch-ul de <Link> nu are nevoie de sesiune reîmprospătată. Dacă ruta e
  // închisă, pagina o refuză singură prin `requireTenant()`, iar navigarea REALĂ
  // care urmează trece pe aici normal și reînnoiește cookie-urile.
  //
  // Contează cât cântărește: meniul are ~52 de intrări, iar `staleTimes.dynamic`
  // era la implicitul 0, deci fiecare navigare re-prefetcha tot. Jurnalul nginx
  // arată 74,7% din trafic ca `?_rsc=` — 11 745 de cereri pentru 336 de
  // documente — cu vârfuri de 38 într-o secundă, pe replici cu un singur fir JS.
  if (request.headers.get("Next-Router-Prefetch") === "1") {
    return NextResponse.next({ request });
  }

  const { response, autentificat } = await updateSession(request);
```

Șterge apoi vechea linie `if (pathname.startsWith("/api/")) return response;` și comentariul ei,
care acum e mai sus. Șterge și `const { pathname, search } = request.nextUrl;` din poziția veche —
a urcat la începutul funcției.

- [ ] **Pas 5: Scoate rutele de metadate din matcher**

Înlocuiește `:141`:

```ts
    "/((?!_next/static|_next/image|healthz|readyz|favicon\.ico|robots\.txt|sitemap\.xml|manifest\.webmanifest|icon|apple-icon|opengraph-image|twitter-image|.*\.(?:svg|png|jpg|jpeg|gif|webp|avif|ico|css|js|woff|woff2|ttf|otf|map)$).*)",
```

și adaugă în comentariul de deasupra:

```
     * `icon`, `apple-icon`, `opengraph-image` și `twitter-image` sunt rute de
     * metadate generate de Next, servite FĂRĂ extensie și cu un sufix de
     * conținut în URL (`/icon1-pwu6ef`), deci regexul de extensii de mai jos nu
     * le prinde. Sunt trimise cu `max-age=0, must-revalidate` și
     * `cf-cache-status: DYNAMIC`, deci browserul le re-cere la fiecare
     * încărcare de pagină. Măsurat A/B pe origine, 8 perechi intercalate: fără
     * cookie mediana ~21 ms, cu cookie de sesiune ~90 ms — +69 ms fiecare, de
     * 2–3 ori pe pagină, pentru o icoană.
```

- [ ] **Pas 6: Curăță `PREFIXE_METADATE`, care devine cod mort**

Odată excluse din matcher, cererile de metadate nu mai ajung la `proxy()`, deci ramura din
`estePublica` nu se mai execută niciodată. Șterge constanta `PREFIXE_METADATE` (`:62-72`, cu tot
docblock-ul ei) și linia din `estePublica` care o folosește
(`if (PREFIXE_METADATE.some(...)) return true;`). **Mută explicația despre roboții de
previzualizare** — de ce metadatele nu au voie să primească 307 — în comentariul matcher-ului de la
pasul 5: e singurul loc unde regula mai trăiește.

- [ ] **Pas 7: Rulează testul și lanțul**

```bash
pnpm vitest --run src/proxy.test.ts
pnpm typecheck && pnpm lint && pnpm test 2>&1 | tail -8
```

Așteptat: **4 passed** pe proxy; **2916 ✓ / 1 ✗ preexistent** pe lanț.

- [ ] **Pas 8: Commit**

```bash
git status --short -- src/proxy.ts src/proxy.test.ts
git commit --only -m "perf(proxy): scoate din calea sesiunii ce nu are nevoie de ea

Trei clase de cereri plăteau o verificare de sesiune degeaba:

1. Rutele de API își verifică singure sesiunea; verificarea din proxy se
   făcea oricum și rezultatul se arunca la linia imediat următoare.
2. Prefetch-ul de <Link>. Meniul are ~52 de intrări, iar staleTimes.dynamic
   era la implicitul 0, deci fiecare navigare re-prefetcha tot: jurnalul
   nginx arată 74,7% din trafic ca ?_rsc=, 11 745 de cereri pentru 336 de
   documente, cu vârfuri de 38 într-o secundă. Dacă ruta e închisă, pagina o
   refuză singură prin requireTenant.
3. Rutele de metadate (icon, apple-icon, opengraph-image, twitter-image).
   Servite fără extensie și cu sufix de conținut în URL, deci regexul de
   extensii nu le prindea; trimise cu max-age=0 must-revalidate, deci
   browserul le re-cere la fiecare încărcare. Măsurat A/B: +69 ms fiecare,
   de 2-3 ori pe pagină, pentru o icoană.

PREFIXE_METADATE devine cod mort odată excluse din matcher — se șterge, iar
explicația despre roboții de previzualizare se mută în comentariul
matcher-ului, singurul loc unde regula mai trăiește.

Co-Authored-By: Claude Opus 5 <noreply@anthropic.com>
Claude-Session: https://claude.ai/code/session_019x5wtXrnS5AeUPpXchWSJ4" -- src/proxy.ts src/proxy.test.ts
```

---

## Sarcina 5: `staleTimes.dynamic` în `next.config.ts`

Cauza rădăcină a amplificării. Cele 88 de `loading.tsx` — corecte — pun fiecare prefetch în găleata
`dynamic`, al cărei implicit e **0 secunde** (schimbat de la 30 s în v15.0.0). Prefetch-ul e
învechit în clipa în care aterizează.

**Fișiere:**

- Modifică: `next.config.ts`

**Nu e TDD.** Poarta e `tsc` plus jurnalul nginx după deploy.

- [ ] **Pas 1: Citește documentația instalată, nu memoria**

```bash
sed -n '1,45p' node_modules/next/dist/docs/01-app/03-api-reference/05-config/01-next-config-js/staleTimes.md
sed -n '55,70p' node_modules/next/dist/docs/01-app/02-guides/prefetching.md
```

Confirmă tabelul: rută **cu** `loading.js` → găleata `dynamic`, implicit **oprit**; **fără** →
`static`, 5 minute.

- [ ] **Pas 2: Adaugă cheia**

În `next.config.ts`, între `outputFileTracingIncludes` și `reactCompiler`:

```ts
  /**
   * Cache-ul de rutare al clientului, pentru rutele dinamice.
   *
   * Implicitul e 0 din v15.0.0 („not cached”), iar interacțiunea cu scheletele
   * de încărcare e contraintuitivă: o rută CU `loading.tsx` se prefetchează în
   * găleata `dynamic`, una FĂRĂ în `static` (5 min) — vezi tabelul din
   * `node_modules/next/dist/docs/01-app/02-guides/prefetching.md:61-62`.
   * Proiectul are 88 de `loading.tsx` care acoperă toate cele 117 pagini, deci
   * TOT prefetch-ul cădea în găleata neîncărcată: învechit în clipa în care
   * ateriza, re-cerut la fiecare navigare. Jurnalul nginx: 11 745 de cereri
   * pentru 336 de documente.
   *
   * 15 secunde, nu mai mult: e o fereastră în care poți vedea o listă fără
   * scrierea altcuiva. Scrierile TALE sunt acoperite oricum de `revalidate:`
   * din `createAction`. Nu e risc de izolare — Router Cache-ul e per-browser,
   * iar comutarea firmei îl purjează de două ori independent.
   */
  experimental: {
    staleTimes: { dynamic: 15 },
  },
```

- [ ] **Pas 3: Verifică tipul**

```bash
pnpm typecheck
```

Așteptat: curat. Dacă pică cu `TS2353: Object literal may only specify known properties`, cheia s-a
mutat în Next 16 — recitește documentația de la pasul 1 și adaptează. **Nu** o forța cu `as`.

- [ ] **Pas 4: Rulează lanțul și declară ce rămâne de prins de build**

```bash
pnpm lint && pnpm test 2>&1 | tail -6
```

**Rămâne de prins de `next build`:** dacă `NextConfig` tipizează `experimental` ca index-signature,
`tsc` trece și o cheie greșită trece cu ea. Prima poartă reală e build-ul din imagine, la
`./administrativo.sh prod`. Build-ul local e interzis de utilizator.

- [ ] **Pas 5: Commit**

```bash
git status --short -- next.config.ts
git commit --only -m "perf(next): ține prefetch-ul valid 15 secunde

Cauza rădăcină a amplificării de 34,9x. staleTimes.dynamic e 0 implicit din
v15.0.0, iar interacțiunea cu scheletele de încărcare e contraintuitivă: o
rută CU loading.tsx se prefetchează în găleata dynamic, una FĂRĂ în static
(5 min) — prefetching.md:61-62. Proiectul are 88 de loading.tsx care acoperă
toate cele 117 pagini, deci tot prefetch-ul cădea în găleata neîncărcată:
învechit la aterizare, re-cerut la fiecare navigare.

Scheletele nu sunt greșite. Fără staleTimes, ele transformau prefetch-ul
dintr-o optimizare într-o taxă.

Nu e risc de izolare: Router Cache-ul e per-browser, iar comutarea firmei îl
purjează de două ori independent.

Co-Authored-By: Claude Opus 5 <noreply@anthropic.com>
Claude-Session: https://claude.ai/code/session_019x5wtXrnS5AeUPpXchWSJ4" -- next.config.ts
```

---

## Sarcina 6: `instrumentation.ts` + `undici` ca dependință

Supabase nu trimite antet `Keep-Alive`, deci undici aplică implicitul de **4 000 ms**. Un om apasă
mai rar de-atât: fiecare clic începe cu TCP+TLS de la zero, **+125 ms** măsurat.

**Fișiere:**

- Creează: `src/instrumentation.ts`
- Modifică: `package.json`, `pnpm-lock.yaml`

**Nu e TDD.** `register()` e chemat de runtime; un test ar verifica cel mult că fișierul exportă o
funcție. Poarta e empirică.

**Faptul care face intervenția posibilă, verificat empiric pe `node:22-alpine` (v22.23.2, aceeași
imagine ca `Dockerfile:86`):** `globalThis` are `Symbol(undici.globalDispatcher.1)` — adică undici
din npm și fetch-ul încorporat al lui Node **împart** dispatcherul global prin acel simbol. Fără
asta, `setGlobalDispatcher` ar fi rulat fără eroare și fără efect.

- [ ] **Pas 1: Adaugă dependința**

```bash
pnpm add undici
git diff --stat package.json pnpm-lock.yaml
```

`undici` **nu** e dependință azi — apare în lockfile doar ca dependință opțională a lui jsdom, iar
`node_modules/undici` nu există. Fără regenerarea lockfile-ului, `pnpm install --frozen-lockfile`
(`Dockerfile:36`) oprește build-ul **înainte** de `next build`.

- [ ] **Pas 2: Verifică versiunea simbolului din pachetul instalat**

```bash
node -e "
const u = require('undici');
console.log('versiune:', require('undici/package.json').version);
u.setGlobalDispatcher(new u.Agent({ keepAliveTimeout: 30000 }));
const s = Object.getOwnPropertySymbols(globalThis).map(String).filter(x => /undici/.test(x));
console.log('simbol după setGlobalDispatcher:', s);
"
```

Așteptat: exact `Symbol(undici.globalDispatcher.1)`. **Dacă apare `.2` sau alt număr, oprește-te:**
undici din npm și cel din Node nu mai împart dispatcherul, iar intervenția n-ar avea niciun efect,
fără nicio eroare care s-o semnaleze. Fixează atunci versiunea din `package.json` la ultima care dă
`.1`.

- [ ] **Pas 3: Scrie fișierul**

Creează `src/instrumentation.ts`:

```ts
// src/instrumentation.ts

/**
 * Ține socketurile către Supabase deschise 30 de secunde, în loc de 4.
 *
 * DE CE EXISTĂ FIȘIERUL
 * Supabase nu trimite antet `Keep-Alive`, deci undici aplică implicitul lui:
 * 4 000 ms. Un om nu apasă mai des de-atât, deci practic FIECARE clic începea
 * cu TCP + TLS de la zero. Măsurat de pe VM: pauză 0–3 s → 53–68 ms per apel;
 * pauză 4–10 s → 87–149 ms. Suprataxa e ~125 ms, plătită pe primul apel al
 * fiecărei interacțiuni — adică exact acolo unde se vede.
 *
 * CUM AJUNGE SĂ CONTEZE
 * Node are propria copie de undici pentru `fetch`, diferită de pachetul npm.
 * Cele două împart totuși dispatcherul global, printr-un simbol bine-cunoscut:
 * `Symbol(undici.globalDispatcher.1)`. Verificat pe `node:22-alpine` v22.23.2,
 * aceeași imagine ca `Dockerfile:86`. Dacă o versiune viitoare de undici trece
 * la `.2` înaintea lui Node, legătura se rupe TĂCUT — linia de mai jos ar rula
 * fără eroare și fără efect. De aceea versiunea e fixată, iar poarta empirică
 * din planul de latență o verifică explicit.
 *
 * DE CE 30 s ȘI NU 60
 * Riscul reutilizării unui socket pe care marginea l-a închis între timp e
 * `ECONNRESET`. undici reia automat un `GET`, dar NU un `POST` — iar POST-urile
 * de aici sunt Server Actions, adică scrieri. 30 s stă confortabil sub orice
 * prag rezonabil al marginii Cloudflare; o valoare mai mare cere măsurarea
 * pragului real înainte.
 */
export async function register(): Promise<void> {
  // `register()` e chemat și pentru runtime-ul edge, unde nu există undici și
  // nici sockete de reutilizat.
  if (process.env["NEXT_RUNTIME"] !== "nodejs") return;

  const { Agent, setGlobalDispatcher } = await import("undici");
  setGlobalDispatcher(new Agent({ keepAliveTimeout: 30_000 }));
}
```

- [ ] **Pas 4: Rulează lanțul și declară ce rămâne de prins de build**

```bash
pnpm typecheck && pnpm lint && pnpm test 2>&1 | tail -6
```

**Rămâne de prins de `next build`, și e semnificativ:** `src/instrumentation.ts` e fișier nou pe
granița server, iar `undici` trebuie trasat în `.next/standalone` de `outputFileTracing`. Dacă nu e,
containerul pornește și cade cu `MODULE_NOT_FOUND` — exact tiparul pentru care există deja
`outputFileTracingIncludes` pentru `@swc/helpers` în `next.config.ts:24-37`. Build-ul local e
interzis; prima poartă e `./administrativo.sh prod`. **Dacă pică acolo**, adaugă `undici` în
`outputFileTracingIncludes` după modelul existent.

- [ ] **Pas 5: Commit**

```bash
git status --short -- src/instrumentation.ts package.json pnpm-lock.yaml
git commit --only -m "perf(retea): ține socketurile spre Supabase deschise 30 s

Supabase nu trimite antet Keep-Alive, deci undici aplică implicitul de
4000 ms. Un om nu apasă mai des de-atât, deci practic fiecare clic începea cu
TCP + TLS de la zero. Măsurat de pe VM: pauză 0-3 s → 53-68 ms per apel;
pauză 4-10 s → 87-149 ms. Suprataxa e ~125 ms, pe primul apel al fiecărei
interacțiuni.

Node are propria copie de undici pentru fetch, diferită de pachetul npm; cele
două împart dispatcherul global prin Symbol(undici.globalDispatcher.1),
verificat empiric pe node:22-alpine v22.23.2 — aceeași imagine ca
Dockerfile:86. Dacă simbolul devine .2 înaintea lui Node, legătura se rupe
tăcut, de aceea versiunea e fixată.

30 s și nu 60: ECONNRESET pe un socket închis de margine e reluat automat de
undici pentru GET, dar NU pentru POST — iar POST-urile de aici sunt scrieri.

undici nu era dependință (doar opțională a lui jsdom), deci lockfile-ul se
regenerează: fără el, pnpm install --frozen-lockfile oprește build-ul.

Co-Authored-By: Claude Opus 5 <noreply@anthropic.com>
Claude-Session: https://claude.ai/code/session_019x5wtXrnS5AeUPpXchWSJ4" -- src/instrumentation.ts package.json pnpm-lock.yaml
```

---

## Sarcina 7: `Promise.all` în preambulul lui `createAction`

**Fișiere:**

- Modifică: `src/lib/actions/create-action.ts:130-152`

**Interfețe:**

- Consumă: `getEnabledFeatures(organizationId: string)` din `@/lib/auth/features`;
  `getPermissionMap(organizationId: string, role: AppRole, memberId: string)` din
  `@/lib/auth/permissions`. Semnăturile nu se schimbă.
- Produce: `createAction` cu comportament observabil identic — aceleași coduri de eroare, în
  aceeași ordine.

**Nu e TDD în sensul strict.** Nu există în repo niciun precedent de test pe `createAction` (ar cere
mockuit `resolveTenant` + `createServerSupabase` + `readRequestMeta` + `writeAuditLog`), iar
construirea acelui harnais e o sarcină în sine, mai mare decât schimbarea. Poarta e `tsc` plus
citirea atentă de mai jos. **Asta se scrie, nu se maschează.**

- [ ] **Pas 1: Citește blocul actual**

```bash
sed -n '128,155p' src/lib/actions/create-action.ts
```

Confirmă: `:133` e `const features = await getEnabledFeatures(...)`, `:145` e
`const permissions = await getPermissionMap(...)`, iar între ele stă doar verificarea de modul.

- [ ] **Pas 2: Unește citirile, păstrează ordinea deciziilor**

```ts
// ── 3+4. MODULUL ACTIV ȘI PERMISIUNEA ─────────────────────────────────
// Cele două CITIRI sunt independente — tabele diferite
// (`organization_features` și `role_permissions`), amândouă depinzând doar
// de `tenant` — dar erau înlănțuite: două dus-întorsuri seriale spre
// PostgREST, ~110 ms fiecare de pe VM. Postgres însuși le execută în 1–2 ms;
// costul era integral rețea.
//
// Se paralelizează CITIRILE. DECIZIILE rămân în ordinea de dinainte: modul
// dezactivat înaintea permisiunii lipsă, ca un apelant fără drept să
// primească exact același mesaj ca înainte.
const [features, permissions] = await Promise.all([
  getEnabledFeatures(tenant.organizationId),
  getPermissionMap(tenant.organizationId, tenant.role, tenant.memberId),
]);

// Verificat pe server, nu doar ascuns în meniu.
if (def.feature !== undefined && !features.has(def.feature)) {
  return refuza(
    "MODUL_DEZACTIVAT",
    "Modulul necesar acestei operațiuni nu este activ pentru organizația dvs.",
    tenant.organizationId,
  );
}

// Absența cheii se tratează ca `none`: refuz. `none` explicit din
// role_permissions bate implicitul global al platformei.
const scope = permissions.get(def.permission) ?? "none";
if (RANK[scope] < RANK[def.minScope]) {
  return refuza(
    "INTERZIS",
    "Nu aveți permisiunea necesară pentru această acțiune.",
    tenant.organizationId,
  );
}
```

- [ ] **Pas 3: Verifică cele două invariante, prin citire**

1. **Ordinea refuzurilor.** `MODUL_DEZACTIVAT` trebuie să rămână înaintea lui `INTERZIS`. Un
   apelant căruia i s-a dezactivat modulul **și** îi lipsește permisiunea trebuie să primească
   același cod ca înainte.
2. **Cursa de erori.** ⚠️ **CORECTAT după revizie, 2026-09-03:** prima versiune a acestui pas
   avertiza că un `notFound()` din `getEnabledFeatures` ar putea deveni 500. **Premisa era falsă pe
   acest traseu.** `notFound()` aparține lui `requireFeature()` (`features.ts:84-90`), folosit în
   **pagini** — vezi Sarcina 9, unde avertismentul e corect. `createAction` cheamă
   `getEnabledFeatures()` (`features.ts:38-75`), care nu cheamă niciodată `notFound()`: întoarce un
   `Set` sau aruncă un `Error` generic.

   Ce rămâne adevărat: dacă oricare dintre cele două citiri aruncă, `Promise.all` respinge cu prima
   eroare, iar acum nu se mai poate ști care a fost. Înainte, ordinea serială o făcea evidentă din
   stiva de apel. Ambele aruncă `Error` generic și niciuna nu e prinsă de un `try/catch` în
   `createAction` — nici înainte, nici după. Contra-partea e sigură: `Promise.all` atașează handler
   pe fiecare element, deci al doilea reject nu devine unhandled rejection.

- [ ] **Pas 4: Rulează lanțul**

```bash
pnpm typecheck && pnpm lint && pnpm test 2>&1 | tail -6
```

Așteptat: neschimbat. `tsc` prinde destructurarea de tuplu dacă tipurile nu se potrivesc.

- [ ] **Pas 5: Commit**

```bash
git status --short -- src/lib/actions/create-action.ts
git commit --only -m "perf(actiuni): citește modulul și permisiunile în paralel

Două citiri independente — organization_features și role_permissions,
amândouă depinzând doar de tenant — erau înlănțuite: două dus-întorsuri
seriale spre PostgREST, ~110 ms fiecare de pe VM. Postgres le execută în
1-2 ms; costul era integral rețea.

Se paralelizează CITIRILE, nu DECIZIILE: modul dezactivat rămâne verificat
înaintea permisiunii lipsă, ca un apelant fără drept să primească exact
același cod de eroare ca înainte.

Schimbare reală de comportament, notată: dacă getPermissionMap aruncă
înaintea unui notFound() din getEnabledFeatures, rejectul ei câștigă cursa și
un 404 ar deveni 500. Nereproductibil cu un tenant valid — resolveTenant l-a
validat deja.

Co-Authored-By: Claude Opus 5 <noreply@anthropic.com>
Claude-Session: https://claude.ai/code/session_019x5wtXrnS5AeUPpXchWSJ4" -- src/lib/actions/create-action.ts
```

---

## Sarcina 8: Auditul de succes în `after()`

`writeAuditLog` de la `:233` e `await`-uit pe calea fericită — ~110 ms adăugați la fiecare scriere,
înainte ca răspunsul să plece.

**Fișiere:**

- Modifică: `src/lib/actions/create-action.ts:1-20 (importuri), 230-247`

- [ ] **Pas 1: Confirmă că `after` e disponibil și necitit azi**

```bash
grep -rn "\bafter\b" src/ --include="*.ts" --include="*.tsx" | grep -v "// " | head
sed -n '1,30p' node_modules/next/dist/docs/01-app/03-api-reference/04-functions/after.md
```

Așteptat: zero folosiri în `src/`. Documentația confirmă că `after()` rulează după ce răspunsul a
fost trimis (sau prerenderizarea s-a terminat), în același context de request.

- [ ] **Pas 2: Mută doar auditul de SUCCES**

Adaugă `after` la importurile din `next/server` (sau creează importul dacă nu există), apoi:

```ts
// ── 7. AUDITUL DE SUCCES ──────────────────────────────────────────────
// În `after()`, nu `await`: rândul de audit se scrie după ce răspunsul a
// plecat spre client, deci nu mai adaugă ~110 ms la fiecare salvare.
//
// NUMAI succesele. Auditul de REFUZ (din `refuza()`, mai sus) rămâne
// `await`-uit: un refuz pierdut e o gaură în urmă, pe când un succes pierdut
// e o linie lipsă dintr-un jurnal care are deja rândul de date scris. Cele
// două nu au aceeași valoare, deci nu merită același preț.
after(async () => {
  await writeAuditLog(supabase, {
    organizationId: tenant.organizationId,
    action: def.audit.action,
    status: "success",
    entityType: def.audit.entityType,
    entityId: def.audit.entityId?.(input, data) ?? null,
    before: null,
    after: redactPayload(input, def.audit.allow),
    errorCode: null,
    requestId,
    meta,
  });
});
```

**Capcană:** câmpul obiectului se numește `after` și acum e și numele funcției importate. Nu e o
coliziune reală (unul e cheie de obiect), dar dacă `tsc` sau ESLint se plâng, redenumește importul:
`import { after as dupaRaspuns } from "next/server";`

- [ ] **Pas 3: Rulează lanțul**

```bash
pnpm typecheck && pnpm lint && pnpm test 2>&1 | tail -6
```

Dacă vreun test existent cade cu „`after` was called outside a request scope", acel test cheamă o
Server Action direct. Adaugă în el `vi.mock("next/server", ...)` care execută callback-ul sincron.

- [ ] **Pas 4: Verificare empirică, obligatorie**

Un test verde aici nu dovedește câștigul — ar dovedi doar că auditul e **programat**. După deploy:
fă o scriere reală (aprobă un pontaj), apoi confirmă în bază că rândul a apărut:

```sql
select action, status, created_at from audit_logs order by created_at desc limit 5;
```

Dacă rândurile de succes lipsesc, `after()` nu rulează în containerul standalone — **revino la
`await`** și notează asta. Un audit pierdut e mai scump decât 110 ms.

- [ ] **Pas 5: Commit**

```bash
git status --short -- src/lib/actions/create-action.ts
git commit --only -m "perf(actiuni): scrie auditul de succes după răspuns

writeAuditLog era await-uit pe calea fericită: ~110 ms adăugați fiecărei
salvări, înainte ca răspunsul să plece spre client. after() din next/server
îl mută după răspuns, în același context de request. Prima folosire a lui
after() în proiect.

Numai succesele. Auditul de refuz rămâne await-uit: un refuz pierdut e o
gaură în urmă, un succes pierdut e o linie lipsă dintr-un jurnal care are
deja rândul de date. Nu au aceeași valoare, deci nu merită același preț.

Poarta e empirică, nu de test: un test verde ar dovedi doar că auditul e
programat. Se confirmă în audit_logs după o scriere reală.

Co-Authored-By: Claude Opus 5 <noreply@anthropic.com>
Claude-Session: https://claude.ai/code/session_019x5wtXrnS5AeUPpXchWSJ4" -- src/lib/actions/create-action.ts
```

---

## Sarcina 9: Preambulul paginilor, pe subarbori de rute

Tiparul e identic în **110 din 117 de pagini**: `await requireFeature(...)` urmat pe linia imediat
următoare de `await getPermissionMap(...)` — două citiri independente, pe tabele diferite.

**Se sparge pe subarbori**, niciodată într-un commit de 110 fișiere: repo-ul are sesiuni
concurente, iar o sesiune care le atinge pe toate se ciocnește aproape sigur de altcineva.

**Câștigul e ZERO la încărcarea completă**, și asta trebuie știut înainte de a măsura:
`(app)/layout.tsx:92-95` cheamă deja `getEnabledFeatures`, iar el și `getPermissionMap` sunt
`React.cache()`. Când layoutul se randează în același request cu pagina, `requireFeature` e cache
hit. Câștigul apare **exclusiv la navigarea pe client**, unde layoutul nu se re-randează — adică
exact plângerea. **Poarta se pune pe o navigare client, nu pe un `curl`.**

- [ ] **Pas 1: Fă inventarul și alege subarborele**

```bash
grep -rn "await requireFeature" "src/app/(app)" --include=page.tsx -A 2 | grep -c "getPermissionMap"
for d in pontaj concedii angajati ssm mentenanta flota salarizare inventar onboarding cursuri reges diurna; do
  echo "$d: $(grep -rl 'await requireFeature' "src/app/(app)/$d" --include=page.tsx 2>/dev/null | wc -l)"
done
```

Lucrează **un subarbore pe commit**, în ordinea traficului: `pontaj`, `concedii`, `angajati`, apoi
restul.

- [ ] **Pas 2: Aplică transformarea, pagină cu pagină**

Forma de dinainte:

```ts
const { tenant } = await requireTenant();
await requireFeature("pontaj");
const permisiuni = await getPermissionMap(tenant.organizationId, tenant.role, tenant.memberId);
```

Forma de după:

```ts
const { tenant } = await requireTenant();
// Două citiri independente, pe tabele diferite. Înlănțuite erau două
// dus-întorsuri seriale spre PostgREST; costul e integral rețea, nu bază.
// Câștigul se vede la navigarea pe CLIENT, unde layoutul nu se re-randează —
// la o încărcare completă `requireFeature` e cache hit din layout.
const [, permisiuni] = await Promise.all([
  requireFeature("pontaj"),
  getPermissionMap(tenant.organizationId, tenant.role, tenant.memberId),
]);
```

**Trei reguli, în fiecare fișier:**

1. **`can()` rămâne DUPĂ `await`**, niciodată între cele două apeluri — altfel ordinea „modul
   dezactivat (404) înaintea permisiunii lipsă (`AccesRestrictionat`)" se pierde.
2. **Condiționalele nu se pierd.** O citire păzită de o permisiune rămâne ternar în interiorul
   array-ului. Tiparul există deja: `scope === "all" ? citesteRezumatDateSensibile(...) : null`
   (`angajati/[id]:220`), `poateAproba ? numarDeAprobat(...) : Promise.resolve(0)`
   (`concedii/echipa:71`).
3. **Nu muta citiri deasupra unei ieșiri devreme.** `pontaj/aprobare:195-214`,
   `pontaj/page.tsx:370-392`, `mentenanta/echipamente/[id]:80`, `onboarding/[id]:48` se întorc
   înainte de valurile de mai jos; o citire urcată deasupra lor se plătește degeaba pe ramura scurtă.

**Nu unifica `angajatiDupaId`.** Există în cinci module cu semnătură identică dar tipuri
`AngajatRezumat` locale (`checklist.ts:666`, `maintenance.ts:901`, `fleet.ts:678`,
`per-diem.ts:525`, `ssm.ts:971`). Importul rămâne din modulul paginii — o „unificare" ar fi exact
calea de import inventată care a produs istoric 91 de erori.

- [ ] **Pas 3: Rulează lanțul după fiecare subarbore**

```bash
pnpm typecheck && pnpm lint && pnpm test 2>&1 | tail -6
```

`tsc` prinde destructurarea de tuplu. Nimic altceva nu prinde o regresie de ordine — `src/lib/auth/`
și `src/lib/tenant/` n-au niciun test, nicio pagină n-are test de randare. Citește diff-ul.

- [ ] **Pas 4: Commit per subarbore**

```bash
git status --short -- "src/app/(app)/pontaj"
git commit --only -m "perf(pontaj): citește modulul și permisiunile în paralel

Tiparul de preambul e identic în 110 din 117 pagini: requireFeature urmat pe
linia imediat următoare de getPermissionMap — două citiri independente, pe
tabele diferite, înlănțuite fără motiv. Costul e rețea (~110 ms per apel de
pe VM), nu bază (1-2 ms în Postgres).

Se aplică pe subarbori, nu într-un commit de 110 fișiere: arborele e partajat
cu alte sesiuni.

Câștigul se vede la navigarea pe CLIENT, unde layoutul (app) nu se
re-randează. La o încărcare completă requireFeature e cache hit din layout,
deci zero — de aceea poarta de verificare e o navigare, nu un curl.

can() rămâne după await, ca modulul dezactivat (404) să fie verificat
înaintea permisiunii lipsă (AccesRestrictionat).

Co-Authored-By: Claude Opus 5 <noreply@anthropic.com>
Claude-Session: https://claude.ai/code/session_019x5wtXrnS5AeUPpXchWSJ4" -- "src/app/(app)/pontaj"
```

Repetă pentru fiecare subarbore.

---

## Sarcină ANULATĂ: „fișierele cu pending fără semn vizual" — defectul nu există

**Nu există niciun fișier care să ducă lipsă de feedback.** Spec-ul a spus 13, inventarul a spus 10;
la numărătoare **sunt zero**. Verificat fișier cu fișier pe 2026-09-03:

| candidat                                        | de ce e corect deja                                                                                                                                                     |
| ----------------------------------------------- | ----------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| `src/app/(app)/ssm/use-actiune-rand.ts`         | e un hook, nu randează nimic. **Toți** cei trei consumatori leagă `inCurs` de `<Buton inCurs>`: `suspendare-autorizatie.tsx:53,87,92`, `actiuni-eip.tsx:51,109,115,130` |
| `src/app/(app)/concedii/incarcare-document.tsx` | are semn propriu la `:139` — `{inCurs ? <p>Se încarcă documentul…</p> : null}`                                                                                          |
| `src/components/ui/formular.tsx`                | folosește `useSemnalPanaLaRuta` (`:11`, `:104`), nu `useSemnalIncarcare` — de aceea nu apărea în `grep`                                                                 |
| celelalte ~103                                  | duc pending-ul într-un `<Buton inCurs textInCurs>`, care are deja rotiță, `aria-busy` și blocare (`buton.tsx:120-125`)                                                  |

**De ce toate cele trei estimări au greșit, în aceeași direcție:** au numărat **declarații**, nu
**efecte**. `grep -rl "useTransition"` găsește 106 fișiere; câte dintre ele chiar lasă utilizatorul
fără răspuns e o întrebare la care numai citirea răspunde. Aceeași formă a produs și „19 pagini de
listă" (erau 20 de fișiere, dar **un singur** punct de editare) și „lipsesc 36 de `loading.tsx`"
(erau **zero** pagini descoperite — testul număra pe director propriu, nu pe strămoși).

Singurul loc care chiar ducea lipsă de feedback era `rand-tabel.tsx`, adică Sarcina 1.

**Nu redeschide asta** fără să citești fișierele, nu doar să le numeri.

---

## Sarcina 10: Deploy și măsurare

**Abia acum.** Un rebuild înaintea jurnalizării ar face câștigul imposibil de dovedit.

- [ ] **Pas 1: Cere confirmarea utilizatorului**

Deploy-ul în producție cere confirmare explicită. Un „da" anterior nu acoperă acest deploy.

- [ ] **Pas 2: Construiește dintr-un arbore CURAT**

Arborele are fișiere ale altei sesiuni, iar build-ul Docker ia întreg directorul ca context — un
rebuild direct ar publica munca lor nerevizuită, inclusiv cod care poate chema funcții dintr-o
migrare încă neaplicată. Rețeta din `DEPLOY.md:245-263`, reprodusă ca să n-o cauți:

```bash
git status --short                       # vezi ce NU e al tău
git fetch origin main && git merge origin/main

W=/tmp/erp-deploy
git worktree add --detach "$W" HEAD
cp .env.production "$W/.env.production" && chmod 600 "$W/.env.production"
cd "$W" && ./administrativo.sh prod
cd - && shred -u "$W/.env.production" && git worktree remove --force "$W"
```

Înainte de build, confirmă că fișierele celeilalte sesiuni chiar lipsesc din worktree
(`git -C "$W" status --short` trebuie să fie gol) — e diferența dintre a publica ce ai vrut și a
publica ce s-a nimerit.

- [ ] **Pas 3: Deploy**

```bash
./administrativo.sh prod
```

`./administrativo.sh prod` **nu** atinge nginx și nu reinstalează vhostul (`ops/01-main.sh:87-90`) —
vhostul din Sarcina 0 e deja instalat separat.

Aici cade build-ul dacă `undici` nu e trasat în `.next/standalone` sau dacă `experimental.staleTimes`
nu e o cheie validă — cele două lucruri pe care `tsc` nu le prinde și build-ul local, interzis, nu
le-a verificat.

- [ ] **Pas 4: Confirmă că rulează codul nou**

```bash
docker service ps administrativo_administrativo-web --no-trunc | head -5
```

Tagul trebuie să corespundă commit-ului tău. Semnul verdelui fals: „Running 23 hours ago" după un
deploy „reușit".

- [ ] **Pas 5: Măsoară și compară**

```bash
docker exec strawboss-nginx-1 tail -n 2000 /var/log/nginx/administrativo.log \
  | awk '{for(i=1;i<=NF;i++) if($i ~ /^urt=/){split($i,a,"="); print a[2]}}' \
  | sort -n | awk '{v[NR]=$1} END {print "n="NR, "p50="v[int(NR*0.5)], "p90="v[int(NR*0.9)]}'
```

Compară cu seria de referință din Sarcina 0, pasul 6. **Compară `urt=` cu `urt=`** —
`$request_time` include rețeaua utilizatorului și e mai zgomotos.

- [ ] **Pas 6: Verifică porțile care cer producția**

| ce                       | cum                                                                               |
| ------------------------ | --------------------------------------------------------------------------------- |
| getClaims (S2, S3)       | `mcp__supabase__query_logs`: zero `/auth/v1/user` pentru o navigare autentificată |
| sesiunea supraviețuiește | rămâi logat peste ora de expirare a tokenului                                     |
| prefetch (S4, S5)        | proporția `?_rsc=` din jurnal scade sub 74,7%                                     |
| faviconuri (S4)          | `/icon1` cu cookie de sesiune revine la ~21 ms                                    |
| keep-alive (S6)          | două cereri la 6 s distanță: a doua nu mai plătește TLS                           |
| audit în `after()` (S8)  | rândurile de succes apar în continuare în `audit_logs`                            |

- [ ] **Pas 7: Cere măsurătoarea din browserul utilizatorului**

Noi am măsurat de pe VM; el e în Timișoara, pe RCS & RDS, rutat prin Frankfurt. DevTools → Network,
_Disable cache_, un clic din meniu, sortare după **Time**: dacă prima linie e documentul cu 1–3 s,
mai e server; dacă sunt 30 de linii mici, mai e coadă de prefetch. Tab **Performance**: dacă bara
galbenă trece de 300 ms, ipoteza rămasă e hidratarea — 247 KB pe `/panou`, nemăsurată de nimeni.

---

## Ce NU face acest plan

- **Redis.** Prematur, nu greșit — argumentul lui real (invalidarea între cele două replici Swarm)
  se aplică abia după ce există un cache. Faza B, cu cele 10 reguli de izolare din specul §7.
- **Cele 152 `router.refresh()`** din 105 fișiere. Fiecare cere verificarea manuală că `revalidate:`
  acoperă calea afișată; un ecran învechit după salvare e clasa de defecte cea mai scumpă.
- **Afordant local pentru `<Link>`** (meniu, paginare, antet sortabil). `SenzorLink` primește deja
  `pending` de la `useLinkStatus` și îl trimite doar la voal. Aceeași jumătate lipsește și acolo.
- **Eticheta per tabel.** Ar cere un prop nou pe `Tabel` și normalizarea a 20 de `caption`.
- **Rescrierea RLS în `(select …)`**, indexuri noi, mutarea aplicației lângă bază — respinse pe
  cifre în specul §5.
- **Cele două caractere cu sedilă** din `src/content/landing/contact.ts`. E fișierul altei sesiuni;
  se semnalează, nu se repară aici.
