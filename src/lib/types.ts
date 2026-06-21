// Tipos de dominio del sistema de grifo

export type ProductoId = "bio" | "regular" | "premium" | "glp";
export type IslaTipo = "liquido" | "glp";
export type TurnoId = "manana" | "tarde" | "noche";
export type MetodoPago = "yape" | "transferencia" | "visa" | "culqui";
export type Rol = "admin" | "trabajador";

// Balones de gas envasado (solo isla GLP)
export type BalonTipo = "gasfull" | "zetagas";

// Claves de precio gestionadas por el admin (combustibles + balones)
export type PrecioKey = ProductoId | BalonTipo;
export type Precios = Record<PrecioKey, number>;

// Administrador con nombre y contraseña, gestionado por el desarrollador en
// Configuraciones. Aparece en la lista de login de admin.
export interface Admin {
  id: string;
  nombre: string;
  password: string;
}

export interface Manguera {
  id: string;
  label: string;
  producto: ProductoId;
}

export interface Isla {
  id: string;
  nombre: string;
  tipo: IslaTipo;
  mangueras: Manguera[];
  productos: ProductoId[];
}

export interface OdometroValor {
  entrada: number;
  salida: number;
}

export interface PagoElectronico {
  id: string;
  metodo: MetodoPago;
  referencia?: string; // obligatorio si visa o transferencia
  factura?: string; // opcional
  monto: number; // obligatorio
}

export interface Credito {
  id: string;
  producto: ProductoId;
  cliente: string; // obligatorio
  vale: string; // obligatorio
  factura?: string; // opcional
  galones: number; // obligatorio
}

export interface Promocion {
  id: string;
  producto: ProductoId;
  dniPlaca?: string; // opcional
  galones: number; // obligatorio
}

export interface Descuento {
  id: string;
  producto: ProductoId;
  cliente?: string;
  galones: number; // obligatorio
  precioDescuento: number; // precio al que se dio (obligatorio)
}

export interface Gasto {
  id: string;
  descripcion: string;
  monto: number;
}

export interface Adelanto {
  id: string;
  cliente?: string;
  monto: number;
}

export interface Entrega {
  id: string;
  hora?: string; // ej. "16:00" — opcional
  monto: number;
}

export interface Balon {
  id: string;
  tipo: BalonTipo; // gasfull | zetagas
  cantidad: number; // unidades vendidas
}

export interface Sesion {
  id: string;
  fecha: string; // YYYY-MM-DD
  trabajador: string;
  islaId: string;
  turno: TurnoId;
  precios: Precios; // snapshot al iniciar (informativo); el cálculo usa precios globales
  odometros: Record<string, OdometroValor>; // por manguera.id
  pagos: PagoElectronico[];
  creditos: Credito[];
  promociones: Promocion[];
  descuentos: Descuento[];
  gastos: Gasto[];
  adelantos: Adelanto[];
  entregas: Entrega[];
  balones: Balon[];
  cerrada: boolean;
  createdAt: number;
  // Día operativo (6am–6am) guardado como campo para consultas eficientes.
  diaOperativo: string; // YYYY-MM-DD
  updatedAt: number; // última edición (ms epoch)
  closedAt?: number; // momento de cierre del turno
  schemaVersion: number; // versión del esquema del documento
}
