# ============================================================================
# Administrativo — imagine de producție (Next.js 16, standalone)
#
# Patru stage-uri: base → deps → builder → runner. Doar `runner` ajunge în
# imaginea finală; `deps` și `builder` sunt aruncate, deci tot ce se instalează
# sau se citește acolo nu apare în artefactul livrat.
#
# Build:  ./administrativo.sh docker:build
# ============================================================================

# ---------------------------------------------------------------------------
# base — toolchain-ul comun
# ---------------------------------------------------------------------------
FROM node:22-alpine AS base

# pnpm 10 e OBLIGATORIU, nu o preferință: `pnpm-workspace.yaml` din acest repo
# conține doar setări (`ignoredBuiltDependencies`), fără cheia `packages:`.
# pnpm 9 refuză formatul cu „ERROR packages field missing or empty" și build-ul
# moare înainte de instalare. Versiunea e fixată și în `packageManager`.
RUN corepack enable && corepack prepare pnpm@10.33.0 --activate
WORKDIR /app

# ---------------------------------------------------------------------------
# deps — doar dependențele, ca layer cacheabil separat de sursă
# ---------------------------------------------------------------------------
FROM base AS deps

# Se copiază DOAR manifestele: layer-ul de instalare se invalidează atunci când
# se schimbă dependențele, nu la fiecare editare dintr-un fișier .tsx.
COPY package.json pnpm-lock.yaml pnpm-workspace.yaml ./

# Fără `--prod`: `reactCompiler: true` din next.config.ts are nevoie de
# `babel-plugin-react-compiler`, care e devDependency. Un install de producție
# ar trece, iar `next build` ar pica după câteva minute cu „Cannot find module".
RUN --mount=type=cache,id=pnpm-administrativo,target=/root/.local/share/pnpm/store \
    pnpm install --frozen-lockfile

# ---------------------------------------------------------------------------
# builder — compilarea Next.js
# ---------------------------------------------------------------------------
FROM base AS builder

COPY --from=deps /app/node_modules ./node_modules
COPY . .

# --- Variabile publice: valori REALE, inlinuite în bundle-ul de client -------
# `next build` le înlocuiește textual în JS-ul trimis browserului, deci sunt
# fixate la BUILD și nu pot fi schimbate la runtime. În particular
# NEXT_PUBLIC_APP_URL este baza tuturor redirecturilor de autentificare
# (src/app/auth/callback/route.ts îl folosește intenționat în locul lui
# `request.url`, fiindcă antetul Host e controlat de client). O valoare greșită
# aici = login rupt, iar singura reparație e un rebuild.
ARG NEXT_PUBLIC_SUPABASE_URL
ARG NEXT_PUBLIC_SUPABASE_ANON_KEY
ARG NEXT_PUBLIC_APP_URL
ENV NEXT_PUBLIC_SUPABASE_URL=$NEXT_PUBLIC_SUPABASE_URL \
    NEXT_PUBLIC_SUPABASE_ANON_KEY=$NEXT_PUBLIC_SUPABASE_ANON_KEY \
    NEXT_PUBLIC_APP_URL=$NEXT_PUBLIC_APP_URL

# --- Variabile de server: PLACEHOLDERE, deliberat ---------------------------
# `src/config/env.ts` validează cu Zod la IMPORT de modul, iar `next build`
# importă fiecare rută ca să colecteze datele paginilor. Fără aceste variabile
# build-ul se oprește — dar nu are nevoie de valorile adevărate: în timpul
# build-ului nu se execută nicio interogare, nicio decriptare, nicio semnătură
# de cookie. Sunt exact placeholderele din .github/workflows/ci.yml.
#
# Consecința care contează: NICIUN secret real nu intră în vreun layer, nici
# măcar în cel aruncat. Valorile adevărate vin la runtime, din docker-stack.yml.
ENV SUPABASE_SERVICE_ROLE_KEY="build-placeholder" \
    HR_ENCRYPTION_KEYS='{"1":"AAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAA="}' \
    HR_ENCRYPTION_ACTIVE_KEY="1" \
    HR_HASH_KEY="BBBBBBBBBBBBBBBBBBBBBBBBBBBBBBBBBBBBBBBBBBB=" \
    TENANT_COOKIE_SECRET="AAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAA=" \
    EMAIL_MODE="test" \
    NEXT_TELEMETRY_DISABLED=1 \
    NODE_ENV=production

# Semnalizează next.config.ts că suntem într-un build de imagine: acolo
# verificarea de tipuri nu blochează livrarea (vezi comentariul de acolo).
# `pnpm build` local și CI rămân stricte.
ENV DOCKER_BUILD=1

RUN pnpm build

# ---------------------------------------------------------------------------
# runner — imaginea finală
# ---------------------------------------------------------------------------
FROM node:22-alpine AS runner
WORKDIR /app

ENV NODE_ENV=production \
    NEXT_TELEMETRY_DISABLED=1 \
    PORT=3000
# Serverul standalone ascultă pe `process.env.HOSTNAME`, iar Docker îl setează
# implicit la id-ul containerului → Next s-ar lega DOAR pe IP-ul containerului.
# Atunci healthcheck-ul de mai jos (care lovește 127.0.0.1) ar da mereu
# „connection refused" și Swarm ar reporni la nesfârșit o replică sănătoasă.
ENV HOSTNAME=0.0.0.0

# Utilizatorul se creează ÎNAINTE de copiere, ca `--chown` să aibă ce ținti.
RUN addgroup -S appgroup && adduser -S appuser -G appgroup

# `standalone` conține deja serverul + strictul necesar din node_modules;
# `static` și `public` se copiază separat, fiindcă trasarea nu le include.
#
# `--chown` nu e cosmetic: Next scrie cache-ul de prerender ÎN `.next/server/app/`
# la runtime. Copiate ca root, fișierele rămân neatinse de `appuser`, iar fiecare
# cerere lasă în log „EACCES: permission denied, open '.../healthz.body'".
# Pagina se randează oricum, dar de fiecare dată de la zero, iar jurnalul se
# umple de erori care ascund problemele reale.
COPY --from=builder --chown=appuser:appgroup /app/.next/standalone ./
COPY --from=builder --chown=appuser:appgroup /app/.next/static ./.next/static
COPY --from=builder --chown=appuser:appgroup /app/public ./public

USER appuser

EXPOSE 3000

# 127.0.0.1 explicit, nu `localhost`: wget-ul din busybox rezolvă întâi ::1
# (IPv6), iar Next ascultă doar pe IPv4 0.0.0.0 → verificarea ar eșua fals.
HEALTHCHECK --interval=10s --timeout=5s --start-period=40s --retries=6 \
  CMD wget -q -O /dev/null http://127.0.0.1:3000/healthz || exit 1

CMD ["node", "server.js"]
