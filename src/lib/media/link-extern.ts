// src/lib/media/link-extern.ts
/**
 * Linkurile externe de curs: YouTube, Vimeo, Loom.
 *
 * ── NU STOCĂM URL-UL SCRIS DE OM ──────────────────────────────────────────
 * Stocăm furnizorul (enum), identificatorul și, unde există, codul privat al
 * filmului nelistat. URL-ul de vizionare se RECONSTRUIEȘTE din șablon, pe
 * server. Asta elimină prin construcție, nu prin filtrare, întreaga clasă:
 * open redirect, injecție de parametri (`?autoplay=1&enablejsapi=1`),
 * `javascript:`, `data:`, credențiale în URL, fragmente care schimbă
 * comportamentul playerului.
 *
 * ── DOMENIILE SE COMPARĂ PRIN EGALITATE, NICIODATĂ PRIN `endsWith` ────────
 * `hostname.endsWith("youtube.com")` acceptă `evilyoutube.com`. Greșeala e
 * clasică și tăcută: linkul pare valid, trece revizuirea, iar iframe-ul
 * încarcă orice.
 *
 * ── ZERO `fetch` CĂTRE URL-UL PRIMIT ⇒ ZERO SSRF ──────────────────────────
 * Nu cerem titlul, nu cerem durata, nu cerem miniatura de la furnizor.
 * Titlul îl scrie administratorul: cinci secunde de tastat, o suprafață de
 * atac întreagă în minus.
 */

export const FURNIZORI_LINK = ["youtube", "vimeo", "loom"] as const;
export type FurnizorLink = (typeof FURNIZORI_LINK)[number];

/** Mulțimi de EGALITĂȚI exacte. Orice gazdă din afara lor e respinsă. */
const GAZDE: Readonly<Record<FurnizorLink, readonly string[]>> = {
  youtube: ["youtube.com", "www.youtube.com", "m.youtube.com", "youtu.be", "www.youtu.be"],
  vimeo: ["vimeo.com", "www.vimeo.com", "player.vimeo.com"],
  loom: ["loom.com", "www.loom.com"],
};

/** Identificatorii, cu expresii ANCORATE la ambele capete. */
const TIPAR_ID: Readonly<Record<FurnizorLink, RegExp>> = {
  youtube: /^[A-Za-z0-9_-]{11}$/,
  vimeo: /^[0-9]{6,12}$/,
  loom: /^[a-f0-9]{32}$/,
};

const TIPAR_COD_PRIVAT = /^[a-zA-Z0-9_-]{4,32}$/;

export type LinkExtern = Readonly<{
  furnizor: FurnizorLink;
  id: string;
  /**
   * Codul care însoțește un film nelistat. Vimeo îl numește „unlisted hash" și
   * îl trimite ca `?h=…`. Dacă se pierde la normalizare, linkul merge la
   * administrator (care e autentificat) și NU merge la angajați — defectul cel
   * mai enervant cu putință, fiindcă cel care l-a adăugat nu-l poate reproduce.
   */
  codPrivat: string | null;
}>;

export type RezultatLink =
  | Readonly<{ ok: true; link: LinkExtern }>
  | Readonly<{ ok: false; motiv: string }>;

function gazdaFurnizor(hostname: string): FurnizorLink | null {
  const gazda = hostname.toLowerCase();
  for (const furnizor of FURNIZORI_LINK) {
    if (GAZDE[furnizor].includes(gazda)) return furnizor;
  }
  return null;
}

function idYoutube(u: URL): string | null {
  const gazda = u.hostname.toLowerCase();
  if (gazda === "youtu.be" || gazda === "www.youtu.be") {
    return u.pathname.slice(1).split("/")[0] ?? null;
  }
  const v = u.searchParams.get("v");
  if (v !== null) return v;
  // /embed/{id}, /shorts/{id}, /live/{id}
  const parti = u.pathname.split("/").filter(Boolean);
  if (parti.length >= 2 && ["embed", "shorts", "live", "v"].includes(parti[0] ?? "")) {
    return parti[1] ?? null;
  }
  return null;
}

function idVimeo(u: URL): string | null {
  // vimeo.com/123456789, vimeo.com/123456789/abcdef, player.vimeo.com/video/123456789
  const parti = u.pathname.split("/").filter(Boolean);
  if (parti[0] === "video") return parti[1] ?? null;
  return parti[0] ?? null;
}

function idLoom(u: URL): string | null {
  const parti = u.pathname.split("/").filter(Boolean);
  const i = parti.indexOf("share");
  if (i >= 0) return parti[i + 1] ?? null;
  if (parti[0] === "embed") return parti[1] ?? null;
  return null;
}

/**
 * Descompune un URL lipit de administrator. Întoarce motivul refuzului ca text
 * de interfață gata de afișat — administratorul trebuie să înțeleagă CE e greșit
 * în linkul lui, nu doar că „nu e valid".
 */
export function analizeazaLink(intrare: string): RezultatLink {
  const text = intrare.trim();
  if (text.length === 0) return { ok: false, motiv: "Lipiți adresa filmului." };

  let u: URL;
  try {
    u = new URL(text);
  } catch {
    return { ok: false, motiv: "Adresa nu este un link valid. Copiați-o din bara browserului." };
  }

  if (u.protocol !== "https:") {
    return { ok: false, motiv: "Acceptăm doar adrese care încep cu „https://”." };
  }
  if (u.username !== "" || u.password !== "") {
    return { ok: false, motiv: "Adresa nu poate conține utilizator și parolă." };
  }

  const furnizor = gazdaFurnizor(u.hostname);
  if (furnizor === null) {
    return {
      ok: false,
      motiv: "Acceptăm doar linkuri YouTube, Vimeo sau Loom. Pentru alt film, încărcați fișierul.",
    };
  }

  const id = furnizor === "youtube" ? idYoutube(u) : furnizor === "vimeo" ? idVimeo(u) : idLoom(u);
  if (id === null || !TIPAR_ID[furnizor].test(id)) {
    return { ok: false, motiv: "Nu am recunoscut identificatorul filmului în această adresă." };
  }

  // Vimeo trimite codul filmului nelistat ca `?h=…`; Loom nu are echivalent.
  const codBrut = furnizor === "vimeo" ? u.searchParams.get("h") : null;
  const codPrivat = codBrut !== null && TIPAR_COD_PRIVAT.test(codBrut) ? codBrut : null;

  return { ok: true, link: { furnizor, id, codPrivat } };
}

/**
 * Adresa de încorporare, construită din şablon. `youtube-nocookie.com` NU
 * înseamnă „fără cookie-uri": transmite Google adresa IP, User-Agent și
 * originea la simpla încărcare a iframe-ului. De aceea încărcarea e la clic,
 * nu automată — vezi componenta de vizionare.
 */
export function adresaIncorporare(link: LinkExtern): string {
  switch (link.furnizor) {
    case "youtube":
      return `https://www.youtube-nocookie.com/embed/${link.id}?rel=0&modestbranding=1`;
    case "vimeo":
      return `https://player.vimeo.com/video/${link.id}${link.codPrivat === null ? "" : `?h=${link.codPrivat}`}`;
    case "loom":
      return `https://www.loom.com/embed/${link.id}`;
  }
}

/** Adresa pe care o deschide butonul „Deschideți la sursă”, pentru cine preferă. */
export function adresaPublica(link: LinkExtern): string {
  switch (link.furnizor) {
    case "youtube":
      return `https://www.youtube.com/watch?v=${link.id}`;
    case "vimeo":
      return `https://vimeo.com/${link.id}${link.codPrivat === null ? "" : `/${link.codPrivat}`}`;
    case "loom":
      return `https://www.loom.com/share/${link.id}`;
  }
}

export const ETICHETE_FURNIZOR: Readonly<Record<FurnizorLink, string>> = {
  youtube: "YouTube",
  vimeo: "Vimeo",
  loom: "Loom",
};
