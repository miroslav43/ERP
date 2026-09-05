import type { MesajPush } from "./mesaj";

/**
 * Clientul serviciului de push al Expo.
 *
 * Fără cheie: `exp.host` acceptă mesajele pe baza jetonului destinatarului.
 * Credențialele de platformă (contul de serviciu FCM V1 și cheia APNs) stau la
 * EAS, nu aici — de-aia fișierul ăsta n-are nimic secret și nu citește `env`.
 */

const ENDPOINT = "https://exp.host/--/api/v2/push/send";

/** Plafonul documentat de Expo pentru un singur apel. */
export const MAX_PE_LOT = 100;

/**
 * Termenul pe apelul către `exp.host`.
 *
 * DE CE EXISTĂ. `fetch` din Node NU are termen implicit — aceeași cauză
 * mecanică descrisă pe larg în `src/lib/supabase/fetch-cu-termen.ts`, după
 * incidentul din 23 august 2026. Chemarea de mai jos era, până la 2026-09-04,
 * SINGURA ieșire de rețea din tot lanțul de livrare fără niciun termen.
 *
 * CE SE ÎNTÂMPLA FĂRĂ EL. `exp.host` acceptă conexiunea și tace ⇒ `trimiteUnLot`
 * nu se întoarce ⇒ rândurile rămân pe `in_lucru` ⇒ după 10 minute
 * `push_ia_din_coada` le recuperează și le trimite DIN NOU. Dacă primul apel
 * ajunsese totuși la Expo, omul primește notificarea de două ori — și tot așa,
 * la fiecare ciclu. Drumul cel mai scurt către dublarea notificărilor trecea
 * exact pe aici.
 *
 * 15 SECUNDE. Un lot are cel mult 100 de mesaje (`MAX_PE_LOT`), iar `exp.host`
 * răspunde în mod normal în sub o secundă. Pragul e cu un ordin de mărime peste
 * și rămâne mult sub `TimeoutStartSec=90` al unității systemd — deci termenul
 * se atinge ÎNAINTE ca systemd să omoare procesul, iar rândurile apucă să fie
 * marcate reîncercabile în loc să rămână agățate pe `in_lucru`.
 *
 * La expirare, `fetch` respinge cu `TimeoutError`, prins de `catch`-ul de mai
 * jos: tot lotul devine `{ fel: "eroare" }`, deci `in_asteptare` cu `incercari`
 * deja incrementat de RPC — mărginit de `MAX_INCERCARI`, nu la nesfârșit.
 */
const TERMEN_MS = 15_000;

export type RezultatBilet =
  | { readonly fel: "ok" }
  /** Jetonul nu mai există: aplicația a fost dezinstalată sau reinstalată. */
  | { readonly fel: "jeton-mort" }
  /** Orice altceva. Rămâne reîncercabil până la plafonul de încercări. */
  | { readonly fel: "eroare"; readonly mesaj: string };

type Bilet = {
  status?: string;
  message?: string;
  details?: { error?: string };
};

function citesteBilet(bilet: Bilet | undefined | null): RezultatBilet {
  if (bilet === undefined || bilet === null) {
    // `undefined`: Expo a răspuns cu mai puține bilete decât mesaje. `null`:
    // array-ul de bilete conține el însuși `null` pe o poziție — o formă pe
    // care tipul `Bilet[]` n-o arată, fiindcă valoarea vine dintr-un `as` peste
    // un corp JSON, iar `Array.isArray` acceptă un array cu elemente `null`.
    // Fără ramura asta, `bilet.status` mai jos ar arunca în afara oricărui
    // try din `trimiteUnLot` și ar rupe contractul pozițional.
    return { fel: "eroare", mesaj: "Răspuns fără bilet pentru acest mesaj." };
  }
  if (bilet.status === "ok") return { fel: "ok" };
  if (bilet.details?.error === "DeviceNotRegistered") return { fel: "jeton-mort" };
  return { fel: "eroare", mesaj: bilet.message ?? "Eroare necunoscută de la Expo." };
}

async function trimiteUnLot(lot: readonly MesajPush[]): Promise<readonly RezultatBilet[]> {
  let raspuns: Response;
  try {
    raspuns = await fetch(ENDPOINT, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        Accept: "application/json",
        "Accept-Encoding": "gzip, deflate",
      },
      body: JSON.stringify(lot),
      signal: AbortSignal.timeout(TERMEN_MS),
    });
  } catch (eroare) {
    const mesaj = eroare instanceof Error ? eroare.message : "Rețea indisponibilă.";
    return lot.map(() => ({ fel: "eroare", mesaj }) as const);
  }

  if (!raspuns.ok) {
    // Nu se citește corpul: un 5xx de la exp.host e reîncercabil pentru tot
    // lotul, indiferent ce scrie în el.
    return lot.map(() => ({ fel: "eroare", mesaj: `HTTP ${raspuns.status}.` }) as const);
  }

  let bilete: Bilet[];
  try {
    const corp = (await raspuns.json()) as { data?: Bilet[] } | null;
    // `?.` nu e cosmetic: un corp literal `null` e JSON VALID, deci `.json()`
    // rezolvă cu `null` fără să arunce. Fără `?.`, `corp.data` ar arunca
    // TypeError chiar aici — catch-ul de mai jos tot l-ar prinde, dar rezultatul
    // ar fi „eroare" prin mesajul generic de corp nevalid, nu prin ramura
    // normală „fără bilet" a lui `citesteBilet`. `?.` ține `null` pe drumul
    // firesc, nu pe cel de avarie.
    // `Array.isArray` acoperă un `data` care e string, număr sau obiect:
    // indexarea lui ar întoarce `undefined` tăcut, iar toate mesajele ar cădea
    // pe ramura „fără bilet" fără să se vadă de ce.
    bilete = Array.isArray(corp?.data) ? corp.data : [];
  } catch {
    // 200 cu corp nevalid. Se tratează ca eroare de lot, NU se aruncă: apelantul
    // potrivește pozițional rândurile din coadă cu rezultatele, iar o excepție
    // aici ar pierde și loturile trimise cu succes înaintea acestuia — care
    // s-ar retrimite la următoarea golire, ca push duplicat.
    return lot.map(() => ({ fel: "eroare", mesaj: "Răspuns nevalid de la Expo." }) as const);
  }
  return lot.map((_, i) => citesteBilet(bilete[i]));
}

/**
 * Trimite mesajele, spărgându-le în loturi de cel mult `MAX_PE_LOT`.
 *
 * Întoarce EXACT un rezultat per mesaj, în aceeași ordine. Apelantul se bazează
 * pe potrivirea pozițională ca să știe ce rând din coadă a plecat.
 */
export async function trimiteLot(mesaje: readonly MesajPush[]): Promise<readonly RezultatBilet[]> {
  const rezultate: RezultatBilet[] = [];
  for (let i = 0; i < mesaje.length; i += MAX_PE_LOT) {
    // Serial, nu în paralel: loturile sunt puține, iar Expo limitează debitul.
    rezultate.push(...(await trimiteUnLot(mesaje.slice(i, i + MAX_PE_LOT))));
  }
  return rezultate;
}
