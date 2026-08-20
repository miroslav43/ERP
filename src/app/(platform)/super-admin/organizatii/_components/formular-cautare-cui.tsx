"use client";

import { useId, useState } from "react";
import { useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";

import { cautaCuiAnafSchema, type CautaCuiAnafInput } from "@/schemas/organization";
import { cautaCuiAnaf, type RezultatCautareCui } from "./../actions";

interface Proprietati {
  readonly onGasit: (rezultat: RezultatCautareCui) => void;
}

export function FormularCautareCui({ onGasit }: Proprietati) {
  const idFormular = useId();
  const [eroareServer, setEroareServer] = useState<string | null>(null);

  const {
    register,
    handleSubmit,
    formState: { errors, isSubmitting },
  } = useForm<CautaCuiAnafInput>({ resolver: zodResolver(cautaCuiAnafSchema) });

  const trimite = handleSubmit(async (valori) => {
    setEroareServer(null);
    const rezultat = await cautaCuiAnaf(valori);
    if (!rezultat.ok) {
      setEroareServer(rezultat.error.message);
      return;
    }
    onGasit(rezultat.data);
  });

  return (
    <form onSubmit={trimite} noValidate className="max-w-md space-y-4">
      <div aria-live="assertive">
        {eroareServer && (
          <p role="alert" className="border-border bg-surface text-danger rounded-md border p-3 text-sm">
            {eroareServer}
          </p>
        )}
      </div>

      <div>
        <label htmlFor={`${idFormular}-cui`} className="text-foreground block text-sm font-medium">
          CUI-ul companiei *
        </label>
        <input
          id={`${idFormular}-cui`}
          {...register("cui")}
          inputMode="text"
          placeholder="RO 14399840"
          autoFocus
          aria-invalid={Boolean(errors.cui)}
          aria-describedby={`${idFormular}-cui-ajutor`}
          className="mt-1 w-full rounded-md border border-border bg-background px-3 py-2 text-sm text-foreground"
        />
        <p id={`${idFormular}-cui-ajutor`} className="text-muted-foreground mt-1 text-xs">
          Căutăm datele companiei la ANAF. Dacă nu sunt găsite, le completezi manual la pasul următor.
        </p>
        {errors.cui?.message && <p className="text-danger mt-1 text-sm">{errors.cui.message}</p>}
      </div>

      <button
        type="submit"
        disabled={isSubmitting}
        className="bg-primary text-primary-foreground hover:bg-primary-hover rounded-md px-4 py-2 text-sm font-medium disabled:cursor-not-allowed disabled:border-border disabled:bg-surface disabled:text-muted-foreground"
      >
        {isSubmitting ? "Se caută…" : "Continuă"}
      </button>
    </form>
  );
}
