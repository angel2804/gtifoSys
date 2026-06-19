import type { BalonTipo, Isla, Precios, ProductoId, TurnoId } from "./types";

// Trabajadores por defecto (editables por el admin; ver store.trabajadores)
export const TRABAJADORES_DEFAULT = ["Angel", "Lenin", "Miguel"];

// Contraseña admin (fase posterior: mover a Firebase Auth / Firestore)
export const ADMIN_PASSWORD =
  process.env.NEXT_PUBLIC_ADMIN_PASSWORD || "admin123";

// Segunda contraseña, exclusiva de la pestaña "Configuraciones" del panel
// admin (reset de base de datos para pruebas). Capa extra, no reemplaza
// ADMIN_PASSWORD.
export const CONFIG_PASSWORD =
  process.env.NEXT_PUBLIC_CONFIG_PASSWORD || "angelccasa284";

export const TURNOS: { id: TurnoId; label: string }[] = [
  { id: "manana", label: "Mañana" },
  { id: "tarde", label: "Tarde" },
  { id: "noche", label: "Noche" },
];

export const PRODUCTOS: Record<ProductoId, string> = {
  bio: "Bio",
  regular: "Regular",
  premium: "Premium",
  glp: "GLP",
};

export const BALONES: Record<BalonTipo, string> = {
  gasfull: "Gas Full",
  zetagas: "Zeta Gas",
};

// Clases de color por producto (tabla de odómetros estilo Excel)
export const PRODUCTO_COLOR: Record<ProductoId, string> = {
  bio: "bg-zinc-200 dark:bg-zinc-700",
  regular: "bg-green-300/70 dark:bg-green-800/50",
  premium: "bg-sky-200 dark:bg-sky-900/50",
  glp: "bg-amber-200 dark:bg-amber-900/50",
};

// Precios por defecto (el admin los edita; se guardan en Firestore config/precios)
export const PRECIOS_DEFAULT: Precios = {
  bio: 15.0,
  regular: 16.0,
  premium: 17.5,
  glp: 2.5,
  gasfull: 60.0,
  zetagas: 58.0,
};

export const ISLAS: Isla[] = [
  {
    id: "isla1",
    nombre: "Isla 1",
    tipo: "liquido",
    productos: ["bio", "regular", "premium"],
    mangueras: [
      { id: "i1_bio1a", label: "BIO1A", producto: "bio" },
      { id: "i1_bio1b", label: "BIO1B", producto: "bio" },
      { id: "i1_reg1", label: "REGULAR-1", producto: "regular" },
      { id: "i1_prem1", label: "PREMIUM-1", producto: "premium" },
      { id: "i1_bio2a", label: "BIO2A", producto: "bio" },
      { id: "i1_bio2b", label: "BIO2B", producto: "bio" },
      { id: "i1_reg2", label: "REGULAR-2", producto: "regular" },
      { id: "i1_prem2", label: "PREMIUM-2", producto: "premium" },
    ],
  },
  {
    id: "isla2",
    nombre: "Isla 2",
    tipo: "liquido",
    productos: ["bio", "regular", "premium"],
    mangueras: [
      { id: "i2_bio3a", label: "BIO3A", producto: "bio" },
      { id: "i2_bio3b", label: "BIO3B", producto: "bio" },
      { id: "i2_reg3", label: "REGULAR-3", producto: "regular" },
      { id: "i2_prem3", label: "PREMIUM-3", producto: "premium" },
      { id: "i2_bio4a", label: "BIO4A", producto: "bio" },
      { id: "i2_bio4b", label: "BIO4B", producto: "bio" },
      { id: "i2_reg4", label: "REGULAR-4", producto: "regular" },
      { id: "i2_prem4", label: "PREMIUM-4", producto: "premium" },
    ],
  },
  {
    id: "isla3",
    nombre: "Isla 3 - GLP",
    tipo: "glp",
    productos: ["glp"],
    mangueras: [
      { id: "i3_glp_a1", label: "GLP A1", producto: "glp" },
      { id: "i3_glp_a2", label: "GLP A2", producto: "glp" },
      { id: "i3_glp_b1", label: "GLP B1", producto: "glp" },
      { id: "i3_glp_b2", label: "GLP B2", producto: "glp" },
    ],
  },
];

export function getIsla(id: string): Isla | undefined {
  return ISLAS.find((i) => i.id === id);
}

export function turnoLabel(id: TurnoId): string {
  return TURNOS.find((t) => t.id === id)?.label ?? id;
}
