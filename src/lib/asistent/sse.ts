// src/lib/asistent/sse.ts
/**
 * Parser incremental de flux `text/event-stream`.
 *
 * E izolat într-un fișier propriu, fără rețea și fără DOM, pentru că aici se
 * strică lucrurile în practică — și se strică rar, sub sarcină, în producție.
 * Un flux SSE NU sosește pe evenimente întregi: sosește pe bucăți de octeți,
 * tăiate oriunde. `data: {"choices":[{"delta":{"content":"bu` într-o bucată și
 * `nă ziua"}}]}\n\n` în următoarea e cazul normal, nu cazul limită. Un parser
 * scris pe presupunerea „o bucată = un eveniment" merge perfect local, unde
 * răspunsul e mic și vine dintr-o dată, și pierde text în producție, unde nu.
 *
 * De aceea starea (tamponul) e ținută explicit, iar funcția e testabilă
 * hrănind-o cu bucăți tăiate intenționat prost.
 *
 * Se implementează specificația reală, nu doar cazul comun: un eveniment se
 * încheie la rând gol, mai multe linii `data:` din același eveniment se
 * concatenează cu `\n`, iar liniile care încep cu `:` sunt comentarii de
 * menținere a conexiunii — OpenRouter trimite `: OPENROUTER PROCESSING` la
 * fiecare câteva secunde cât timp modelul se gândește, iar tratarea lor ca
 * date ar produce JSON invalid exact în pauzele lungi.
 */

/** Sfârșitul convențional al unui flux compatibil OpenAI. */
export const SEMNAL_FINAL = "[DONE]";

export type CititorSse = Readonly<{
  /** Bucata primită → încărcăturile `data:` complete din ea, în ordine. */
  adauga: (bucata: string) => readonly string[];
  /** Ce a rămas în tampon la închiderea fluxului, dacă e un eveniment întreg. */
  incheie: () => readonly string[];
}>;

export function creeazaCititorSse(): CititorSse {
  let tampon = "";
  // Liniile `data:` ale evenimentului aflat în construcție.
  let dateleEvenimentului: string[] = [];

  function inchideEveniment(): string | null {
    if (dateleEvenimentului.length === 0) return null;
    const incarcatura = dateleEvenimentului.join("\n");
    dateleEvenimentului = [];
    return incarcatura;
  }

  function consumaLinie(linie: string, iesire: string[]): void {
    // Rând gol = sfârșit de eveniment.
    if (linie === "") {
      const incarcatura = inchideEveniment();
      if (incarcatura !== null) iesire.push(incarcatura);
      return;
    }
    // Comentariu de menținere a conexiunii.
    if (linie.startsWith(":")) return;

    const douaPuncte = linie.indexOf(":");
    const camp = douaPuncte === -1 ? linie : linie.slice(0, douaPuncte);
    if (camp !== "data") return; // `event:`, `id:`, `retry:` — nu ne interesează

    let valoare = douaPuncte === -1 ? "" : linie.slice(douaPuncte + 1);
    // Specificația cere să se taie UN SINGUR spațiu de după două puncte, nu
    // toate: un `data:  x` transportă legitim un spațiu la începutul valorii.
    if (valoare.startsWith(" ")) valoare = valoare.slice(1);
    dateleEvenimentului.push(valoare);
  }

  return {
    adauga(bucata: string): readonly string[] {
      tampon += bucata;
      const iesire: string[] = [];
      let inceput = 0;
      for (;;) {
        const capat = tampon.indexOf("\n", inceput);
        if (capat === -1) break;
        // `\r\n` la fel de valid ca `\n`; se taie separatorul, nu conținutul.
        const brut = tampon.slice(inceput, capat);
        consumaLinie(brut.endsWith("\r") ? brut.slice(0, -1) : brut, iesire);
        inceput = capat + 1;
      }
      // Restul e o linie neterminată: rămâne în tampon până sosește `\n`.
      tampon = tampon.slice(inceput);
      return iesire;
    },

    incheie(): readonly string[] {
      const iesire: string[] = [];
      if (tampon !== "") {
        consumaLinie(tampon.endsWith("\r") ? tampon.slice(0, -1) : tampon, iesire);
        tampon = "";
      }
      // Un flux tăiat fără rândul gol final ar pierde ultimul eveniment altfel.
      const incarcatura = inchideEveniment();
      if (incarcatura !== null) iesire.push(incarcatura);
      return iesire;
    },
  };
}
