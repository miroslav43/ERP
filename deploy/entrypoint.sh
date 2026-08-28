#!/bin/sh
# Punte între `docker secret` și `process.env`, înainte de a porni serverul.
#
# DE CE: injectarea prin `environment:` face secretele vizibile în
# `docker inspect <container>` → `.Config.Env`, deci oricine e în grupul
# `docker` pe VM poate citi cheia care criptează CNP-urile și IBAN-urile.
# `docker secret` le montează în `/run/secrets/<nume>`, unde `docker inspect`
# nu ajunge.
#
# DE CE AICI, ȘI NU ÎN `src/config/env.ts`: acolo ar fi însemnat un import de
# `node:fs` într-un fișier pe care îl importă și bundle-ul de client. Un import
# condiționat prin `require()` e interzis de ESLint
# (`@typescript-eslint/no-require-imports`), iar unul static ar rupe build-ul de
# client. Traducerea fișier → variabilă de mediu e oricum treaba mediului de
# execuție, nu a aplicației: `env.ts` rămâne cu o singură sursă, `process.env`.
#
# COMPATIBIL ÎNAPOI ȘI INERT: fără `<NUME>_FILE` setat, nu face nimic.
# Comportamentul de azi rămâne neschimbat până când cineva chiar creează
# secretele. Pașii de migrare sunt în `DEPLOY.md`.
set -eu

for nume in SUPABASE_SERVICE_ROLE_KEY HR_ENCRYPTION_KEYS HR_HASH_KEY \
            TENANT_COOKIE_SECRET RESEND_API_KEY RESEND_WEBHOOK_SECRET \
            REGES_CRON_SECRET; do
  eval "cale=\${${nume}_FILE:-}"
  [ -n "$cale" ] || continue
  if [ -r "$cale" ]; then
    # `$(cat)` taie singur newline-ul final, pe care `docker secret create` îl
    # adaugă aproape mereu când valoarea vine dintr-un `echo`. Netăiat, o cheie
    # AES devine invalidă și decriptarea eșuează cu un mesaj care nu spune de ce.
    eval "export ${nume}=\"\$(cat '$cale')\""
  else
    # Nu oprim pornirea aici: dacă valoarea există și în mediu, aplicația merge.
    # Dacă nu există nicăieri, validarea Zod din `src/config/env.ts` oprește
    # imediat, cu un mesaj care numește variabila lipsă — mai clar decât orice
    # eroare am produce noi.
    echo "entrypoint: ${nume}_FILE=$cale nu poate fi citit; folosesc mediul" >&2
  fi
done

exec "$@"
