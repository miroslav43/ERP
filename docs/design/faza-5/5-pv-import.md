```tsx
// src/app/(app)/inventar/import/import-client.tsx
'use client'

import { useState, useTransition } from 'react'
import { pregatesteImportInventar, aplicaImportInventar, revocaImportInventar } from './actions'
import type { RandInventarValid, RandInventarRespins } from './rand-inventar'

type Etapa = 'incarcare' | 'previzualizare' | 'finalizat'

export function ImportInventarClient() {
  const [etapa, setEtapa] = useState<Etapa>('incarcare')
  const [batchId, setBatchId] = useState<string | null>(null)
  const [valide, setValide] = useState<RandInventarValid[]>([])
  const [respinse, setRespinse] = useState<RandInventarRespins[]>([])
  const [total, setTotal] = useState(0)
  const [eroare, setEroare] = useState<string | null>(null)
  const [rezultatAplicare, setRezultatAplicare] = useState<{ importate: number; esuate: number } | null>(null)
  const [sePrelucreaza, incepeTranzitie] = useTransition()

  function reseteaza() {
    setEtapa('incarcare')
    setBatchId(null)
    setValide([])
    setRespinse([])
    setTotal(0)
    setRezultatAplicare(null)
  }

  function incarca(fisier: File) {
    setEroare(null)
    incepeTranzitie(async () => {
      const rezultat = await pregatesteImportInventar({ fisier })
      if (!rezultat.ok) {
        setEroare(rezultat.error.message)
        return
      }
      setBatchId(rezultat.data.batchId)
      setValide(rezultat.data.valide)
      setRespinse(rezultat.data.respinse)
      setTotal(rezultat.data.total)
      setEtapa('previzualizare')
    })
  }

  function aplica() {
    if (!batchId) return
    setEroare(null)
    incepeTranzitie(async () => {
      const rezultat = await aplicaImportInventar({ batchId, randuri: valide })
      if (!rezultat.ok) {
        setEroare(rezultat.error.message)
        return
      }
      setRezultatAplicare({ importate: rezultat.data.importate, esuate: rezultat.data.esuate })
      setRespinse((anterior) => [...anterior, ...rezultat.data.respinse])
      setEtapa('finalizat')
    })
  }

  function revoca() {
    if (!batchId) return
    setEroare(null)
    incepeTranzitie(async () => {
      const rezultat = await revocaImportInventar({ batchId })
      if (!rezultat.ok) {
        setEroare(rezultat.error.message)
        return
      }
      reseteaza()
    })
  }

  function descarcaRaportRespinse() {
    const antet = 'rand,erori\n'
    const linii = respinse.map((r) => `${r.numarRand},"${r.erori.join(' | ').replace(/"/g, "''")}"`).join('\n')
    const blob = new Blob([antet + linii], { type: 'text/csv;charset=utf-8' })
    const url = URL.createObjectURL(blob)
    const link = document.createElement('a')
    link.href = url
    link.download = 'raport-import-inventar-respinse.csv'
    link.click()
    URL.revokeObjectURL(url)
  }

  if (etapa === 'incarcare') {
    return (
      <div className="rounded-lg border border-dashed border-gray-300 p-8 text-center">
        <input
          type="file"
          accept=".xlsx,.xls"
          disabled={sePrelucreaza}
          onChange={(e) => {
            const fisier = e.target.files?.[0]
            if (fisier) incarca(fisier)
          }}
          className="mx-auto"
        />
        {sePrelucreaza ? <p className="mt-3 text-sm text-gray-500">Se citește fișierul…</p> : null}
        {eroare ? (
          <p role="alert" className="mt-3 text-sm font-medium text-red-700">
            {eroare}
          </p>
        ) : null}
      </div>
    )
  }

  return (
    <div className="space-y-6">
      <div className="flex flex-wrap items-center gap-4 rounded-lg border border-gray-200 p-4">
        <p className="text-sm">
          <strong>{total}</strong> rânduri citite — <strong className="text-green-700">{valide.length}</strong>{' '}
          valide, <strong className="text-red-700">{respinse.length}</strong> respinse.
        </p>
        {respinse.length > 0 ? (
          <button type="button" onClick={descarcaRaportRespinse} className="text-sm underline">
            Descarcă raportul rândurilor respinse
          </button>
        ) : null}
      </div>

      {eroare ? (
        <p role="alert" className="text-sm font-medium text-red-700">
          {eroare}
        </p>
      ) : null}

      {etapa === 'previzualizare' ? (
        <div className="flex flex-wrap gap-3">
          <button
            type="button"
            onClick={aplica}
            disabled={sePrelucreaza || valide.length === 0}
            className="rounded-md bg-blue-600 px-4 py-2 text-sm font-medium text-white hover:bg-blue-700 disabled:opacity-60"
          >
            {sePrelucreaza ? 'Se aplică…' : `Aplică import (${valide.length} obiecte)`}
          </button>
          <button
            type="button"
            onClick={revoca}
            disabled={sePrelucreaza}
            className="rounded-md border border-red-300 px-4 py-2 text-sm font-medium text-red-700 hover:bg-red-50"
          >
            Revocă lotul
          </button>
        </div>
      ) : null}

      {etapa === 'finalizat' && rezultatAplicare ? (
        <div className="space-y-3">
          <p role="status" className="text-sm font-medium text-green-700">
            Import finalizat: {rezultatAplicare.importate} obiecte adăugate, {rezultatAplicare.esuate} respinse.
          </p>
          <button type="button" onClick={reseteaza} className="text-sm underline">
            Import nou
          </button>
        </div>
      ) : null}

      {respinse.length > 0 ? (
        <div className="overflow-x-auto rounded-lg border border-gray-200">
          <table className="w-full text-left text-sm">
            <thead className="bg-gray-50">
              <tr>
                <th className="px-3 py-2">Rând</th>
                <th className="px-3 py-2">Erori</th>
              </tr>
            </thead>
            <tbody>
              {respinse.map((r) => (
                <tr key={r.numarRand} className="border-t border-gray-100">
                  <td className="px-3 py-2">{r.numarRand}</td>
                  <td className="px-3 py-2 text-red-700">{r.erori.join('; ')}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      ) : null}
    </div>
  )
}
```

SEMNALĂRI (lucruri absente din inventar, pe care nu le-am inventat):

1. Coloanele reale ale tabelei `employees` nu au fost incluse în inventar (doar numele tabelei, Faza 2). `proces-verbal/page.tsx` presupune `nume` și `prenume`. De verificat/ajustat înainte de merge; dacă schema reală diferă (ex. `nume_complet`, `first_name`/`last_name`), doar acel select se schimbă.
2. `@/lib/import/excel.ts` nu apare în lista de module cu export cunoscut — e menționat doar ca nume de fișier în sarcină. `actions.ts` presupune `citesteExcel(fisier: File, opts?: { randuriMaxime?: number }) -> Promise<{ randuri: { numarRand: number; celule: Record<string, string|number|null> }[] }>`. De aliniat la semnătura reală (nume export, formă a rezultatului) — restul codului e izolat în `laRandBrut`/`extrageCelula`, deci ajustarea e locală.
3. Tiparul exact din `src/app/(app)/angajati/import/` (prepare→preview→apply) nu a putut fi citit (read-only, fără tool-uri). Am reprodus structura descrisă în sarcină (trei etape, erori pe rând, aplicare parțială) dar denumirile de fișiere/componente pot diferi de convenția reală folosită acolo — de aliniat manual dacă acolo există o componentă de preview partajată, ca să nu apară duplicare.
4. Numerotarea procesului-verbal: task-ul cere „numerotare prin document_sequences, per organizație și an”, dar singurul RPC expus pentru acel tabel este `app.aloca_numar_inventar`, cu `document_type` fix `'inventar'` (numărul obiectului, nu al documentului). Nu există un `document_type` de tip „proces verbal” înregistrat și nu am adăugat SQL nou (sarcina asta e doar TS). Am implementat în schimb un număr calculat (poziția alocării în anul predării, per organizație) — corect ca etichetă de tipărit, dar NEATOMIC și fără gestiunea găurilor pe care o are `document_sequences`. Dacă se dorește numerotare „reală”, e nevoie de o migrare separată care adaugă `document_type = 'proces_verbal_inventar'` și fie extinde `app.aloca_numar_inventar` cu un parametru de tip, fie adaugă un RPC generic.
5. `app.aloca_numar_inventar` și `app.revoca_import_inventar` trăiesc în schema `app`, nu `public`. Am apelat `ctx.supabase.schema('app').rpc(...)`, ceea ce presupune că schema `app` e expusă prin PostgREST (`db.schemas`) — plauzibil, dat fiind că migrarea le acordă explicit `grant execute ... to authenticated`, dar de verificat pe configurația reală a proiectului. Tipurile pentru `.schema('app').rpc(...)` depind de regenerarea `src/types/database.ts` (menționată deja ca pas necesar în inventarul primit).
6. `organizations` nu are câmpuri de CUI/adresă documentate. `DateFirmaProcesVerbal.cui`/`.adresa` rămân opționale și nepopulate în `proces-verbal/page.tsx` (doar `denumire` din `tenant.name`); de completat când/dacă asemenea coloane există.
7. Nu există infrastructură de storage/bucket documentată (`@/lib/storage/*` nu apare în inventar), la fel ca în migrare. Raportul cu rândurile respinse la import e generat 100% client-side (CSV via `Blob`+`URL.createObjectURL`), fără rută de download server-side.
8. Semnături presupuse fără detaliu explicit în inventar: `requireFeature(organizationId, featureKey): Promise<void>` (declanșează 404), `can(map, key, minScope): boolean`. Formele sunt consistente cu restul API-ului documentat, dar nu au fost date literal.
9. Fișiere create de această livrare (toate în afara migrării, care era deja sursa de adevăr):
   `src/lib/documents/proces-verbal.ts`,
   `src/app/(app)/inventar/alocari/[id]/proces-verbal/page.tsx`,
   `src/app/(app)/inventar/alocari/[id]/proces-verbal/butoane-client.tsx`,
   `src/app/(app)/inventar/alocari/[id]/proces-verbal/actions.ts`,
   `src/app/(app)/inventar/import/rand-inventar.ts`,
   `src/app/(app)/inventar/import/actions.ts`,
   `src/app/(app)/inventar/import/page.tsx`,
   `src/app/(app)/inventar/import/import-client.tsx`.