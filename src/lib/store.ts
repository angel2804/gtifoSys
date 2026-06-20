"use client";

import { create } from "zustand";
import { persist } from "zustand/middleware";
import type {
  Adelanto,
  Balon,
  Credito,
  Descuento,
  Entrega,
  Gasto,
  OdometroValor,
  PagoElectronico,
  PrecioKey,
  Precios,
  Promocion,
  Rol,
  Sesion,
  TurnoId,
} from "./types";
import { getIsla, PRECIOS_DEFAULT, TRABAJADORES_DEFAULT } from "./config";
import { aprenderClientes } from "./clientes";
import { diaActivoParaNuevosTurnos, diaOperativo, diaOperativoDe } from "./calc";

const TURNO_ORDEN: TurnoId[] = ["manana", "tarde", "noche"];
// Versión del esquema de cada documento de sesión en Firestore.
const SCHEMA_VERSION = 4;

export function uid(): string {
  return Math.random().toString(36).slice(2) + Date.now().toString(36);
}

export function hoy(): string {
  return new Date().toISOString().slice(0, 10);
}

interface AuthState {
  rol: Rol;
  trabajador: string; // nombre, vacío para admin
}

interface StoreState {
  auth: AuthState | null;
  sesiones: Sesion[];
  currentSesionId: string | null;
  precios: Precios; // precios globales (sincronizados con Firestore config/precios)
  trabajadores: string[]; // sincronizados con Firestore config/trabajadores
  clientes: string[]; // nombres de clientes (créditos/descuentos/adelantos), sincronizados con config/clientes

  setPrecios: (p: Precios) => void;
  setPrecio: (k: PrecioKey, v: number) => void;
  setTrabajadores: (t: string[]) => void;
  setClientes: (c: string[]) => void;
  // Aprende uno o más nombres de cliente: los agrega a la lista si no existen
  // (sin distinguir mayúsculas/acentos). Devuelve true si la lista cambió.
  aprenderClientes: (nombres: (string | undefined)[]) => boolean;

  loginAdmin: () => void;
  loginTrabajador: (nombre: string) => void;
  logout: () => void;

  iniciarSesion: (islaId: string, turno: TurnoId) => string;
  setCurrentSesion: (id: string | null) => void;
  getCurrentSesion: () => Sesion | undefined;

  setOdometro: (mangueraId: string, valor: Partial<OdometroValor>) => void;

  addPago: (p: Omit<PagoElectronico, "id">) => void;
  updatePago: (id: string, p: Partial<PagoElectronico>) => void;
  removePago: (id: string) => void;

  addCredito: (c: Omit<Credito, "id">) => void;
  updateCredito: (id: string, c: Partial<Credito>) => void;
  removeCredito: (id: string) => void;

  addPromocion: (p: Omit<Promocion, "id">) => void;
  updatePromocion: (id: string, p: Partial<Promocion>) => void;
  removePromocion: (id: string) => void;

  addDescuento: (d: Omit<Descuento, "id">) => void;
  updateDescuento: (id: string, d: Partial<Descuento>) => void;
  removeDescuento: (id: string) => void;

  addGasto: (g: Omit<Gasto, "id">) => void;
  updateGasto: (id: string, g: Partial<Gasto>) => void;
  removeGasto: (id: string) => void;

  addAdelanto: (a: Omit<Adelanto, "id">) => void;
  updateAdelanto: (id: string, a: Partial<Adelanto>) => void;
  removeAdelanto: (id: string) => void;

  addEntrega: (e: Omit<Entrega, "id">) => void;
  updateEntrega: (id: string, e: Partial<Entrega>) => void;
  removeEntrega: (id: string) => void;

  addBalon: (b: Omit<Balon, "id">) => void;
  updateBalon: (id: string, b: Partial<Balon>) => void;
  removeBalon: (id: string) => void;

  cerrarSesion: (id: string) => void;

  // Fusiona sesiones traídas de Firestore sin pisar ediciones locales más
  // nuevas. Si se pasa `cutoff` (día operativo desde el que se consultó
  // Firestore), también elimina del caché local cualquier sesión dentro de
  // esa ventana que ya no exista remotamente — así un reset de base de
  // datos hecho desde OTRO dispositivo se refleja aquí en vez de quedar
  // "zombie" en localStorage.
  mergeRemoteSesiones: (remotas: Sesion[], cutoff?: string) => void;

  // Borra todas las sesiones (local + deja de referenciar la activa). Usado
  // por el botón "Resetear base de datos" de Configuraciones; el caller es
  // responsable de también borrar los documentos remotos en Firestore.
  resetSesiones: () => void;
}

// Busca la salida del turno anterior para la misma isla/manguera y la usa
// como entrada automática.
function entradaAutomatica(
  sesiones: Sesion[],
  islaId: string,
  turno: TurnoId,
  mangueraId: string,
  diaActivo: string
): number {
  const idxTurno = TURNO_ORDEN.indexOf(turno);
  // Candidatas: misma isla, distintas (orden por createdAt desc)
  const previas = sesiones
    .filter((s) => s.islaId === islaId && s.odometros[mangueraId])
    .sort((a, b) => b.createdAt - a.createdAt);

  // Preferir el turno inmediatamente anterior del mismo día operativo
  // (el día "activo" del sistema, no la fecha real del reloj).
  if (idxTurno > 0) {
    const turnoPrev = TURNO_ORDEN[idxTurno - 1];
    const mismoDia = previas.find(
      (s) => s.turno === turnoPrev && diaOperativo(s) === diaActivo
    );
    if (mismoDia) return mismoDia.odometros[mangueraId].salida;
  }
  // Si no, tomar la salida más reciente registrada
  return previas[0]?.odometros[mangueraId].salida ?? 0;
}

function mutateCurrent(
  set: (fn: (s: StoreState) => Partial<StoreState>) => void,
  get: () => StoreState,
  fn: (s: Sesion) => Sesion
) {
  const id = get().currentSesionId;
  if (!id) return;
  set((state) => ({
    // Toda mutación de la sesión actual actualiza updatedAt automáticamente.
    sesiones: state.sesiones.map((s) =>
      s.id === id ? { ...fn(s), updatedAt: Date.now() } : s
    ),
  }));
}

export const useStore = create<StoreState>()(
  persist(
    (set, get) => ({
      auth: null,
      sesiones: [],
      currentSesionId: null,
      precios: { ...PRECIOS_DEFAULT },
      trabajadores: [...TRABAJADORES_DEFAULT],
      clientes: [],

      setPrecios: (p) => set({ precios: p }),
      setPrecio: (k, v) => set((s) => ({ precios: { ...s.precios, [k]: v } })),
      setTrabajadores: (t) => set({ trabajadores: t }),
      setClientes: (c) => set({ clientes: c }),
      aprenderClientes: (nombres) => {
        const actuales = get().clientes;
        const siguientes = aprenderClientes(actuales, nombres);
        if (siguientes === actuales) return false; // sin cambios
        set({ clientes: siguientes });
        return true;
      },

      loginAdmin: () => set({ auth: { rol: "admin", trabajador: "" } }),
      loginTrabajador: (nombre) =>
        set({ auth: { rol: "trabajador", trabajador: nombre } }),
      logout: () => set({ auth: null, currentSesionId: null }),

      iniciarSesion: (islaId, turno) => {
        const { sesiones } = get();
        // Día operativo "activo": no depende del reloj, depende de qué día
        // ya completó sus 9 turnos en los reportes (ver diaActivoParaNuevosTurnos).
        const diaActivo = diaActivoParaNuevosTurnos(sesiones);
        // ID determinístico (día+isla+turno): así es físicamente imposible
        // crear dos sesiones para el mismo turno, incluso si esta acción se
        // dispara dos veces (doble clic, dos pestañas, recarga a destiempo).
        const id = `${diaActivo}_${islaId}_${turno}`;

        const existente = sesiones.find((s) => s.id === id);
        if (existente) {
          // Ya existe (activa o cerrada): se reutiliza tal cual, nunca se
          // pisa con datos nuevos en blanco.
          set({ currentSesionId: id });
          return id;
        }

        const isla = getIsla(islaId);
        const { auth, precios } = get();
        const odometros: Record<string, OdometroValor> = {};
        isla?.mangueras.forEach((m) => {
          const entrada = entradaAutomatica(sesiones, islaId, turno, m.id, diaActivo);
          odometros[m.id] = { entrada, salida: entrada };
        });
        const ahora = Date.now();
        const nueva: Sesion = {
          id,
          fecha: diaActivo,
          trabajador: auth?.trabajador || "Admin",
          islaId,
          turno,
          precios: { ...precios },
          odometros,
          pagos: [],
          creditos: [],
          promociones: [],
          descuentos: [],
          gastos: [],
          adelantos: [],
          entregas: [],
          balones: [],
          cerrada: false,
          createdAt: ahora,
          diaOperativo: diaActivo,
          updatedAt: ahora,
          schemaVersion: SCHEMA_VERSION,
        };
        set((s) => ({
          sesiones: [...s.sesiones, nueva],
          currentSesionId: nueva.id,
        }));
        return nueva.id;
      },

      setCurrentSesion: (id) => set({ currentSesionId: id }),
      getCurrentSesion: () =>
        get().sesiones.find((s) => s.id === get().currentSesionId),

      setOdometro: (mangueraId, valor) =>
        mutateCurrent(set, get, (s) => ({
          ...s,
          odometros: {
            ...s.odometros,
            [mangueraId]: { ...s.odometros[mangueraId], ...valor },
          },
        })),

      addPago: (p) =>
        mutateCurrent(set, get, (s) => ({
          ...s,
          pagos: [...s.pagos, { ...p, id: uid() }],
        })),
      updatePago: (id, p) =>
        mutateCurrent(set, get, (s) => ({
          ...s,
          pagos: s.pagos.map((x) => (x.id === id ? { ...x, ...p } : x)),
        })),
      removePago: (id) =>
        mutateCurrent(set, get, (s) => ({
          ...s,
          pagos: s.pagos.filter((x) => x.id !== id),
        })),

      addCredito: (c) => {
        get().aprenderClientes([c.cliente]);
        mutateCurrent(set, get, (s) => ({
          ...s,
          creditos: [...s.creditos, { ...c, id: uid() }],
        }));
      },
      updateCredito: (id, c) =>
        mutateCurrent(set, get, (s) => ({
          ...s,
          creditos: s.creditos.map((x) => (x.id === id ? { ...x, ...c } : x)),
        })),
      removeCredito: (id) =>
        mutateCurrent(set, get, (s) => ({
          ...s,
          creditos: s.creditos.filter((x) => x.id !== id),
        })),

      addPromocion: (p) =>
        mutateCurrent(set, get, (s) => ({
          ...s,
          promociones: [...s.promociones, { ...p, id: uid() }],
        })),
      updatePromocion: (id, p) =>
        mutateCurrent(set, get, (s) => ({
          ...s,
          promociones: s.promociones.map((x) =>
            x.id === id ? { ...x, ...p } : x
          ),
        })),
      removePromocion: (id) =>
        mutateCurrent(set, get, (s) => ({
          ...s,
          promociones: s.promociones.filter((x) => x.id !== id),
        })),

      addDescuento: (d) => {
        get().aprenderClientes([d.cliente]);
        mutateCurrent(set, get, (s) => ({
          ...s,
          descuentos: [...s.descuentos, { ...d, id: uid() }],
        }));
      },
      updateDescuento: (id, d) =>
        mutateCurrent(set, get, (s) => ({
          ...s,
          descuentos: s.descuentos.map((x) =>
            x.id === id ? { ...x, ...d } : x
          ),
        })),
      removeDescuento: (id) =>
        mutateCurrent(set, get, (s) => ({
          ...s,
          descuentos: s.descuentos.filter((x) => x.id !== id),
        })),

      addGasto: (g) =>
        mutateCurrent(set, get, (s) => ({
          ...s,
          gastos: [...s.gastos, { ...g, id: uid() }],
        })),
      updateGasto: (id, g) =>
        mutateCurrent(set, get, (s) => ({
          ...s,
          gastos: s.gastos.map((x) => (x.id === id ? { ...x, ...g } : x)),
        })),
      removeGasto: (id) =>
        mutateCurrent(set, get, (s) => ({
          ...s,
          gastos: s.gastos.filter((x) => x.id !== id),
        })),

      addAdelanto: (a) => {
        get().aprenderClientes([a.cliente]);
        mutateCurrent(set, get, (s) => ({
          ...s,
          adelantos: [...s.adelantos, { ...a, id: uid() }],
        }));
      },
      updateAdelanto: (id, a) =>
        mutateCurrent(set, get, (s) => ({
          ...s,
          adelantos: s.adelantos.map((x) => (x.id === id ? { ...x, ...a } : x)),
        })),
      removeAdelanto: (id) =>
        mutateCurrent(set, get, (s) => ({
          ...s,
          adelantos: s.adelantos.filter((x) => x.id !== id),
        })),

      addEntrega: (e) =>
        mutateCurrent(set, get, (s) => ({
          ...s,
          entregas: [...s.entregas, { ...e, id: uid() }],
        })),
      updateEntrega: (id, e) =>
        mutateCurrent(set, get, (s) => ({
          ...s,
          entregas: s.entregas.map((x) => (x.id === id ? { ...x, ...e } : x)),
        })),
      removeEntrega: (id) =>
        mutateCurrent(set, get, (s) => ({
          ...s,
          entregas: s.entregas.filter((x) => x.id !== id),
        })),

      addBalon: (b) =>
        mutateCurrent(set, get, (s) => ({
          ...s,
          balones: [...(s.balones ?? []), { ...b, id: uid() }],
        })),
      updateBalon: (id, b) =>
        mutateCurrent(set, get, (s) => ({
          ...s,
          balones: (s.balones ?? []).map((x) => (x.id === id ? { ...x, ...b } : x)),
        })),
      removeBalon: (id) =>
        mutateCurrent(set, get, (s) => ({
          ...s,
          balones: (s.balones ?? []).filter((x) => x.id !== id),
        })),

      cerrarSesion: (id) =>
        set((state) => {
          const ahora = Date.now();
          return {
            sesiones: state.sesiones.map((s) =>
              s.id === id
                ? { ...s, cerrada: true, closedAt: ahora, updatedAt: ahora }
                : s
            ),
          };
        }),

      mergeRemoteSesiones: (remotas, cutoff) =>
        set((state) => {
          const activa = state.currentSesionId;
          const remotasIds = new Set(remotas.map((r) => r.id));
          // Si se conoce la ventana consultada (cutoff), las sesiones locales
          // DENTRO de esa ventana que ya no aparecen en la respuesta remota
          // se consideran borradas en Firestore (p. ej. un reset de base de
          // datos hecho desde otro dispositivo) y se eliminan del caché local.
          // La sesión activa de este dispositivo se respeta para no perder
          // una edición que aún no llegó a sincronizarse.
          const base =
            cutoff == null
              ? state.sesiones
              : state.sesiones.filter(
                  (s) =>
                    diaOperativo(s) < cutoff ||
                    remotasIds.has(s.id) ||
                    s.id === activa
                );
          const locales = new Map(base.map((s) => [s.id, s]));
          remotas.forEach((r) => {
            // El remoto gana (refleja correcciones del admin y mantiene la
            // verdad de la nube), EXCEPTO la sesión que este dispositivo está
            // editando ahora mismo: esa se conserva local para no pisar lo
            // que el trabajador está tecleando.
            if (r.id === activa && locales.has(r.id)) return;
            locales.set(r.id, r);
          });
          return { sesiones: Array.from(locales.values()) };
        }),

      resetSesiones: () => set({ sesiones: [], currentSesionId: null }),
    }),
    {
      name: "grifo-sys",
      version: 4,
      migrate: (persisted) => {
        const state = persisted as StoreState;
        if (state?.sesiones) {
          state.sesiones = state.sesiones.map((s) => ({
            ...s,
            entregas: s.entregas ?? [],
            balones: s.balones ?? [],
            // Campos nuevos (v4): rellenar para docs locales antiguos.
            diaOperativo: s.diaOperativo ?? diaOperativoDe(s.createdAt, s.turno),
            updatedAt: s.updatedAt ?? s.createdAt,
            schemaVersion: s.schemaVersion ?? SCHEMA_VERSION,
          }));
        }
        if (!state.precios) state.precios = { ...PRECIOS_DEFAULT };
        if (!state.trabajadores) state.trabajadores = [...TRABAJADORES_DEFAULT];
        if (!state.clientes) state.clientes = [];
        return state;
      },
    }
  )
);
