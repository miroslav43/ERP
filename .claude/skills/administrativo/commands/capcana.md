---
description: Caută în cele 37 de capcane ale schemei Administrativo după cod de eroare, tabelă, modul sau rol. Include capcanele tăcute, fără cod de eroare.
argument-hint: <cod|tabelă|modul> sau --tabela X / --modul Y / --rol Z / --tacute / --nr N
allowed-tools: ["Bash"]
---

Rulează exact:

```bash
node "${CLAUDE_PLUGIN_ROOT}/scripts/capcana.mjs" $ARGUMENTS
```

Apoi rezumă în două-trei rânduri ce înseamnă rezultatul pentru ce lucrează
utilizatorul acum. Dacă nu vin rezultate, spune explicit că absența unei
capcane înregistrate NU înseamnă că zona e sigură — înseamnă doar că nimeni
n-a documentat una încă.

Fără argumente, întreabă ce caută: un cod de eroare primit, o tabelă pe care
urmează s-o atingă, sau rolul pentru care construiește ecranul.
