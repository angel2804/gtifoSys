"use client";

import { useEffect } from "react";
import { toast } from "sonner";
import { useStore } from "@/lib/store";
import { diaMenos, diaOperativoActual } from "@/lib/calc";
import {
  fetchSesionesDesde,
  subscribeConfig,
  subscribeSesiones,
  upsertSesion,
} from "@/lib/db";
import { supabaseHabilitado } from "@/lib/supabase";
import type { Precios, Sesion } from "@/lib/types";

// Sincroniza el store (localStorage) con Supabase:
//  - al iniciar y en vivo: trae una VENTANA RECIENTE de sesiones (hoy y ayer)
//    vía Supabase Realtime, suficiente para autocompletar odómetros del turno
//    anterior y conocer los turnos ocupados del día.
//  - en cada cambio local: guarda (debounced) SOLO la sesión activa de este
//    dispositivo, nunca todas — así un navegador viejo no "resucita" datos
//    borrados ni reescribe sesiones de otros.
//  - escucha precios y trabajadores globales en vivo.
export function SupabaseSync() {
  const mergeRemoteSesiones = useStore((s) => s.mergeRemoteSesiones);
  const setPrecios = useStore((s) => s.setPrecios);
  const setTrabajadores = useStore((s) => s.setTrabajadores);

  // Precios globales en vivo (config/precios)
  useEffect(() => {
    if (!supabaseHabilitado) return;
    return subscribeConfig<Precios>("precios", setPrecios);
  }, [setPrecios]);

  // Lista de trabajadores en vivo (config/trabajadores)
  useEffect(() => {
    if (!supabaseHabilitado) return;
    return subscribeConfig<{ nombres: string[] }>("trabajadores", (v) => {
      if (Array.isArray(v.nombres) && v.nombres.length) setTrabajadores(v.nombres);
    });
  }, [setTrabajadores]);

  // Ventana reciente de sesiones en vivo (hoy y ayer) + guardado de la activa
  useEffect(() => {
    if (!supabaseHabilitado) return;
    const cutoff = diaMenos(diaOperativoActual(), 1);

    let primera = true;
    const unsub = subscribeSesiones(cutoff, (remotas: Sesion[]) => {
      // Siempre se llama con el `cutoff`: así un reset de base de datos hecho
      // desde otro dispositivo también borra el caché local "zombie" de este
      // dispositivo en vez de quedar desactualizado.
      mergeRemoteSesiones(remotas, cutoff);
      if (primera) {
        primera = false;
        toast.success("Conectado a Supabase", { duration: 2000 });
      }
    });

    return unsub;
  }, [mergeRemoteSesiones]);

  // Guardado automático: SOLO la sesión activa (currentSesionId), debounced.
  useEffect(() => {
    if (!supabaseHabilitado) return;
    let ultimoJson = "";
    let timer: ReturnType<typeof setTimeout> | null = null;

    const flush = async () => {
      const { sesiones, currentSesionId } = useStore.getState();
      if (!currentSesionId) return;
      const s = sesiones.find((x) => x.id === currentSesionId);
      if (!s) return;
      const json = JSON.stringify(s);
      if (json === ultimoJson) return;
      try {
        await upsertSesion(s);
        ultimoJson = json;
      } catch (e) {
        console.error("Supabase guardar:", e);
      }
    };

    const unsub = useStore.subscribe(() => {
      if (timer) clearTimeout(timer);
      timer = setTimeout(flush, 1000);
    });
    return () => {
      if (timer) clearTimeout(timer);
      unsub();
    };
  }, []);

  return null;
}

// Carga puntual usada por el setup antes de crear una sesión (chequeo de
// condición de carrera entre dispositivos). Re-exporta para conveniencia.
export { fetchSesionesDesde };
