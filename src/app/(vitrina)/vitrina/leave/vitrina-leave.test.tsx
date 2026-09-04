import { act, fireEvent, render, screen } from "@testing-library/react";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

import { ZonaToast, golesteToasturi } from "@/components/ui/toast";
import { CHEIE_CONCEDII } from "@/demo/depozit";
import { angajatiVizibili } from "@/demo/roluri";

import { VitrinaConcedii } from "./vitrina-leave";

/**
 * `Formular` cheamă necondiționat `useSemnalPanaLaRuta()`
 * (`src/components/ui/formular.tsx:104`) → `usePathname()`
 * (`src/components/incarcare/use-incarcare.ts:43`). Fără export aici, orice
 * test care DESCHIDE formularul de cerere nouă cade la montare — tiparul e
 * copiat din `src/components/ui/formular-dialog.test.tsx:9-20`.
 */
vi.mock("next/navigation", () => ({
  useRouter: () => ({
    refresh: vi.fn(),
    push: vi.fn(),
    replace: vi.fn(),
    prefetch: vi.fn(),
  }),
  usePathname: () => "/vitrina/leave",
}));

/**
 * Poarta anti-minciună. Precedentul din casă: vinieta-fluturaș a desenat un
 * inel INVIZIBIL în producție, fără nicio eroare, fiindcă nimic nu verifica
 * randarea. Un demo cu date fabricate n-are, din oficiu, o astfel de poartă.
 */

// Coada de notificări a lui `ZonaToast` e la nivel de MODUL și supraviețuiește
// între teste (`src/components/ui/formular.test.tsx:9-14`).
beforeEach(() => {
  golesteToasturi();
});

afterEach(() => {
  window.sessionStorage.clear();
  vi.unstubAllGlobals();
});

/** `ZonaToast` alături de vitrină: fără ea, mesajul de reușită al lui `Formular` nu apare nicăieri. */
function deseneaza(azi = "2026-03-10") {
  return render(
    <>
      <ZonaToast />
      <VitrinaConcedii azi={azi} />
    </>,
  );
}

/**
 * Trimite formularul deschis prin `fireEvent.submit`, NU printr-un clic pe
 * buton. Tiparul e copiat din `formular-dialog.test.tsx:119-123` și
 * `formular.test.tsx:71-75`: `<form action={fn}>` al lui React 19 înlocuiește
 * atributul `action` cu un DOM-guard care ARUNCĂ dacă formularul e trimis
 * prin calea nativă de submit-la-clic, în loc de handler-ul sintetic al lui
 * React. Sub happy-dom, un `userEvent.click` pe butonul de submit lovește
 * exact acest guard — butonul rămâne blocat pe „Se trimite…” — deci se
 * trimite direct evenimentul, ca peste tot în casă.
 */
async function trimiteFormularul(): Promise<void> {
  await act(async () => {
    fireEvent.submit(document.querySelector("form")!);
  });
}

describe("vitrina de concedii", () => {
  it("randează toți angajații vizibili administratorului, rolul implicit", () => {
    render(<VitrinaConcedii azi="2026-03-10" />);
    for (const angajat of angajatiVizibili("org_admin")) {
      // `getAllByText`, nu `getByText`: numele apare și în coloana de nume, și în
      // descrierea `sr-only` a fiecărei celule cu absență a omului — un angajat
      // cu absențe apare de 5-6 ori în DOM, iar `getByText` ar arunca pe el.
      expect(screen.getAllByText(new RegExp(angajat.nume)).length).toBeGreaterThan(0);
    }
  });

  it("randează absențe, nu starea goală", () => {
    render(<VitrinaConcedii azi="2026-03-10" />);
    // Proiectul nu are `@testing-library/jest-dom` instalat, deci `toBeInTheDocument`
    // nu există aici — convenția din `src/components/**/*.test.tsx` e `.toBeNull()`
    // pe rezultatul lui `queryByText` (ex. `bara-filtre.test.tsx:137`).
    expect(screen.queryByText(/Nicio absență de echipă/)).toBeNull();
  });

  it("se mută odată cu luna primită", () => {
    render(<VitrinaConcedii azi="2027-11-15" />);
    // Componenta nu scrie numele lunii nicăieri. Singura urmă a lunii pe ecran e
    // data din descrierea celulelor cu absență, în forma `DD.MM.AAAA`
    // (`descriereCelula`, src/domain/leave/planificator.ts:176-180).
    expect(screen.getAllByText(/\d{2}\.11\.2027/).length).toBeGreaterThan(0);
  });

  it("comutatorul de rol schimbă cine apare pe calendar", async () => {
    // `@testing-library/jest-dom` nu e instalat: `toBeInTheDocument()` nu
    // există aici — vezi comentariul de mai sus. Numele apare de mai multe ori
    // în DOM (coloana de nume + `sr-only` per celulă de absență), deci
    // `getByText`/`queryByText` ar arunca „found multiple elements” — se
    // folosește `getAllByText`/`queryAllByText`, la fel ca în testul de mai sus.
    const { default: userEvent } = await import("@testing-library/user-event");
    const utilizator = userEvent.setup();
    render(<VitrinaConcedii azi="2026-03-10" />);

    expect(screen.getAllByText(/Toma Gabriela/).length).toBeGreaterThan(0);

    await utilizator.click(screen.getByRole("button", { name: "Angajat" }));

    expect(screen.queryAllByText(/Toma Gabriela/)).toHaveLength(0);
    expect(screen.getAllByText(/Popescu Ion/).length).toBeGreaterThan(0);
  });

  it("nu cade dacă sub cheia de depozit stă altceva decât un tablou de cereri", async () => {
    // Declanșatorul realist: extinderea demonstrației la alte module schimbă
    // forma stocată sub aceeași cheie, iar un vizitator cu sesiune veche
    // prinde exact asta. `cereri` se iterează cu `for...of` — fără garda de
    // formă din `citesteDepozit`, asta ar arunca `TypeError`.
    //
    // Citirea NU se întâmplă în `render()`: inițializatorul lui `useState`
    // pornește gol dinadins (nepotrivirea de hidratare, `0ed3f9f`), iar
    // depozitul se citește într-un `requestAnimationFrame` programat din
    // `useEffect` (`vitrina-leave.tsx:97-108`), DUPĂ ce `render()` s-a
    // întors. Un `expect(() => render(...)).not.toThrow()` nu mai vede nimic
    // din două motive suprapuse: (a) cadrul rulează în afara apelului lui
    // `render()`, deci excepția n-are cum să iasă din el; (b) sub happy-dom,
    // `requestAnimationFrame` rulează prin `TIMER.setImmediate`, care își
    // prinde singur excepția într-un `try/catch` și o dispecerizează ca
    // eveniment de eroare pe `window`, nu ca excepție sincronă
    // (`happy-dom/lib/window/BrowserWindow.js:2118-2129`).
    //
    // Un simplu `await waitFor(...)` NU repară asta: verificarea de mai jos
    // (angajații apar pe calendar) e deja adevărată din primul randaj, cu
    // `cereri` gol — `waitFor` face o verificare SINCRONĂ înainte de orice
    // așteptare și, găsind-o adevărată pe loc, se întoarce imediat, fără să
    // mai lase bucla de evenimente să ajungă la cadrul programat. Verificat
    // empiric: un `waitFor` naiv aici rămâne verde chiar cu garda scoasă din
    // `citesteDepozit`.
    //
    // Reparația reală: `requestAnimationFrame` se înlocuiește cu unul care nu
    // programează nimic, ci doar REȚINE cadrul — testul îl declanșează
    // singur, într-un `act`, când vrea el, nu bucla de evenimente. Dacă
    // depozitul stricat trece de gardă, `setCereri` primește un obiect, nu un
    // tablou, `for...of` aruncă în timpul randării, iar `act` propagă
    // excepția direct în test — fără nicio cursă cu timere reale.
    const cadre: Array<FrameRequestCallback> = [];
    vi.stubGlobal("requestAnimationFrame", (cadru: FrameRequestCallback) => {
      cadre.push(cadru);
      return cadre.length;
    });
    vi.stubGlobal("cancelAnimationFrame", () => {});

    window.sessionStorage.setItem(CHEIE_CONCEDII, JSON.stringify({ nu: "un tablou de cereri" }));
    render(<VitrinaConcedii azi="2026-03-10" />);
    expect(cadre).toHaveLength(1);

    await act(async () => {
      cadre[0]!(0);
    });

    for (const angajat of angajatiVizibili("org_admin")) {
      expect(screen.getAllByText(new RegExp(angajat.nume)).length).toBeGreaterThan(0);
    }
  });

  it("managerul nu vede butonul de cerere nouă — nu are `leave:create`", async () => {
    // Seed-ul (`0002_authz.sql:1179`) dă managerului doar `{read,approve}` pe
    // `leave` — poate citi și aproba cererile echipei, n-are `create`. Sursa
    // de adevăr rămâne `poateCrea` din `@/demo/roluri`, deja verificată contra
    // seed-ului de propriul ei test.
    const { default: userEvent } = await import("@testing-library/user-event");
    const utilizator = userEvent.setup();
    deseneaza();

    expect(screen.queryByRole("button", { name: /Cerere nouă/ })).not.toBeNull();
    await utilizator.click(screen.getByRole("button", { name: "Manager" }));
    expect(screen.queryByRole("button", { name: /Cerere nouă/ })).toBeNull();
  });

  describe("cerere nouă", () => {
    afterEach(() => {
      vi.unstubAllGlobals();
    });

    it("o cerere depusă apare pe calendar și NU pleacă spre server", async () => {
      const apeluri: string[] = [];
      vi.stubGlobal("fetch", (...a: unknown[]) => {
        apeluri.push(String(a[0]));
        return Promise.reject(new Error("vitrina nu are voie să cheme rețeaua"));
      });

      const { default: userEvent } = await import("@testing-library/user-event");
      const utilizator = userEvent.setup();
      deseneaza();

      await utilizator.click(screen.getByRole("button", { name: /Cerere nouă/ }));
      await utilizator.type(screen.getByLabelText(/De la/), "2026-03-02");
      await utilizator.type(screen.getByLabelText(/Până la/), "2026-03-03");
      await trimiteFormularul();

      // (a) confirmarea reușitei — vine printr-un TOAST, nu prin text pe pagină.
      const mesaj = await screen.findByText(/cerere înregistrată în demonstrație/i);
      expect(mesaj).toBeTruthy();

      // (b) argumentul central: nimic nu pleacă spre server.
      expect(apeluri).toEqual([]);

      // (c) cerința (c) din spec — cererea chiar APARE pe calendar, nu doar
      // confirmarea de succes. `descriereCelula` scrie data în `sr-only` ca
      // `DD.MM.AAAA` (src/domain/leave/planificator.ts:176-181).
      expect(screen.getAllByText(/02\.03\.2026/).length).toBeGreaterThan(0);
    });
  });
});
