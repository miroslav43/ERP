# Index — documentația proiectului

Punct de intrare. Citește în această ordine dacă preiei proiectul pentru
prima dată (om sau un cont nou de Claude):

1. **[`claude-setup.md`](claude-setup.md)** — cum e configurat Claude Code
   pentru acest proiect: setări de cont, reguli globale, memorie
   auto-construită, convenții de lucru stabilite, rețetă de pornire a unei
   sesiuni identice pe un cont nou.
2. **[`project-overview.md`](project-overview.md)** — ce conține proiectul:
   stack tehnic, structura de foldere, module de business, pattern-uri
   arhitecturale cheie, convenții de migrare, rețetă de adăugare a unui
   modul nou.
3. **[`../NOTES.md`](../NOTES.md)** — decizii de arhitectură + valori legale
   ⚠️ de confirmat de contabil/jurist înainte de calcul real.
4. **[`../PROGRESS.md`](../PROGRESS.md)** — istoric de livrare pe fază.
   **Parțial învechit** — vezi avertismentul din `project-overview.md` §9.
5. **[`design/ecrane/capcane.md`](design/ecrane/capcane.md)** — capcane
   concrete din schemă, verificate empiric. Citește-l înainte de a scrie
   cod nou pe orice modul cu pontaj/concedii/checklist-uri.

## Restul folderului `docs/`

- `design/` — planuri de fază scrise ÎNAINTE de implementare (istoric de
  intenție, nu neapărat stare finală — vezi `design/resolutions.md` și
  `design/critique.md` pentru ce s-a respins/schimbat față de plan).
- `superpowers/` — planuri/specificații scrise prin skill-ul `superpowers`
  (feature-uri individuale, ex. coduri CAEN).

## Când adaugi documentație nouă

- Un plan de fază nouă → `design/faza-NN/` (mirosește structura existentă).
- O decizie de arhitectură sau o valoare legală de confirmat →
  `../NOTES.md`, nu un fișier nou.
- O capcană nouă descoperită în schemă → adaugă un rând numerotat în
  `design/ecrane/capcane.md`, nu un fișier separat.
- Ceva despre configurarea Claude însuși (reguli, memorie, convenții de
  lucru) → `claude-setup.md`.
- Ceva despre arhitectura/conținutul curent al aplicației →
  `project-overview.md`. Dacă documentul devine învechit, actualizează-l
  direct în loc să scrii un al treilea document paralel.
