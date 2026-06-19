// Definiciones de columnas (RegistroAddForm / tablas) compartidas entre
// dashboard/page.tsx (turno activo) y reporte-dia-vista.tsx (reporte del
// día). Antes estaban duplicadas casi línea por línea en ambos archivos.
import type { Col } from "@/components/grifo/registro-fields";
import { soles } from "./calc";
import type {
  Adelanto,
  Balon,
  Credito,
  Descuento,
  Entrega,
  Gasto,
  PagoElectronico,
  Precios,
  Promocion,
  ProductoId,
} from "./types";

export type ProductoOption = { value: ProductoId; label: string };
type PrecioFn = (p: ProductoId) => number;

export const METODO_PAGO_OPTIONS = [
  { value: "yape", label: "Yape" },
  { value: "transferencia", label: "Transferencia" },
  { value: "visa", label: "Visa" },
] as const;

export const BALON_TIPO_OPTIONS = [
  { value: "gasfull", label: "Gas Full" },
  { value: "zetagas", label: "Zeta Gas" },
] as const;

export function colsPago(): Col<PagoElectronico>[] {
  return [
    { key: "metodo", label: "Tipo", tipo: "select", options: [...METODO_PAGO_OPTIONS] },
    { key: "referencia", label: "Referencia", tipo: "text", opcional: true },
    { key: "factura", label: "Factura", tipo: "text", opcional: true },
    { key: "monto", label: "Monto", tipo: "number" },
  ];
}
export const nuevoPago = (): Omit<PagoElectronico, "id"> => ({
  metodo: "yape",
  referencia: "",
  factura: "",
  monto: 0,
});
export function validarPago(r: Omit<PagoElectronico, "id">): string | null {
  if (!r.metodo) return "Elige un tipo";
  if (!r.monto || r.monto <= 0) return "El monto es obligatorio";
  if ((r.metodo === "visa" || r.metodo === "transferencia") && !r.referencia)
    return "La referencia es obligatoria para Visa/Transferencia";
  return null;
}

export function colsCredito(
  productoOptions: ProductoOption[],
  precio: PrecioFn
): Col<Credito>[] {
  return [
    { key: "producto", label: "Producto", tipo: "select", options: productoOptions },
    { key: "cliente", label: "Cliente", tipo: "text" },
    { key: "vale", label: "Vale N°", tipo: "text" },
    { key: "factura", label: "Factura", tipo: "text", opcional: true },
    { key: "galones", label: "Galones", tipo: "number" },
    {
      key: "id",
      label: "Total",
      tipo: "text",
      computar: (r) => soles(r.galones * precio(r.producto)),
    },
  ];
}
export const nuevoCredito = (producto: ProductoId): Omit<Credito, "id"> => ({
  producto,
  cliente: "",
  vale: "",
  factura: "",
  galones: 0,
});
export function validarCredito(r: Omit<Credito, "id">): string | null {
  if (!r.cliente) return "El cliente es obligatorio";
  if (!r.vale) return "El vale es obligatorio";
  if (!r.galones || r.galones <= 0) return "Los galones son obligatorios";
  return null;
}

export function colsPromo(
  productoOptions: ProductoOption[],
  precio: PrecioFn
): Col<Promocion>[] {
  return [
    { key: "producto", label: "Producto", tipo: "select", options: productoOptions },
    { key: "dniPlaca", label: "DNI / Placa", tipo: "text", opcional: true },
    { key: "galones", label: "Galones", tipo: "number" },
    {
      key: "id",
      label: "Total",
      tipo: "text",
      computar: (r) => soles(r.galones * precio(r.producto)),
    },
  ];
}
export const nuevoPromo = (producto: ProductoId): Omit<Promocion, "id"> => ({
  producto,
  dniPlaca: "",
  galones: 0,
});
export const validarPromo = (r: Omit<Promocion, "id">): string | null =>
  !r.galones || r.galones <= 0 ? "Los galones son obligatorios" : null;

export function colsDescuento(
  productoOptions: ProductoOption[],
  precio: PrecioFn
): Col<Descuento>[] {
  return [
    { key: "producto", label: "Producto", tipo: "select", options: productoOptions },
    { key: "cliente", label: "Cliente", tipo: "text", opcional: true },
    { key: "galones", label: "Galones", tipo: "number" },
    { key: "precioDescuento", label: "Precio dado", tipo: "number" },
    {
      key: "id",
      label: "Descuento",
      tipo: "text",
      computar: (r) =>
        soles(r.galones * Math.max(0, precio(r.producto) - r.precioDescuento)),
    },
  ];
}
export const nuevoDescuento = (producto: ProductoId): Omit<Descuento, "id"> => ({
  producto,
  cliente: "",
  galones: 0,
  precioDescuento: 0,
});
export function validarDescuento(r: Omit<Descuento, "id">): string | null {
  if (!r.galones || r.galones <= 0) return "Los galones son obligatorios";
  if (!r.precioDescuento || r.precioDescuento <= 0)
    return "El precio dado es obligatorio";
  return null;
}

export function colsGasto(): Col<Gasto>[] {
  return [
    { key: "descripcion", label: "Detalle", tipo: "text" },
    { key: "monto", label: "Monto", tipo: "number" },
  ];
}
export const nuevoGasto = (): Omit<Gasto, "id"> => ({ descripcion: "", monto: 0 });
export function validarGasto(r: Omit<Gasto, "id">): string | null {
  if (!r.descripcion) return "El detalle es obligatorio";
  if (!r.monto || r.monto <= 0) return "El monto es obligatorio";
  return null;
}

export function colsAdelanto(): Col<Adelanto>[] {
  return [
    { key: "cliente", label: "Cliente", tipo: "text", opcional: true },
    { key: "monto", label: "Monto", tipo: "number" },
  ];
}
export const nuevoAdelanto = (): Omit<Adelanto, "id"> => ({ cliente: "", monto: 0 });
export const validarAdelanto = (r: Omit<Adelanto, "id">): string | null =>
  !r.monto || r.monto <= 0 ? "El monto es obligatorio" : null;

export function colsEntrega(): Col<Entrega>[] {
  return [
    { key: "hora", label: "Hora", tipo: "text", opcional: true },
    { key: "monto", label: "Monto entregado", tipo: "number" },
  ];
}
export const nuevoEntrega = (): Omit<Entrega, "id"> => ({ hora: "", monto: 0 });
export const validarEntrega = (r: Omit<Entrega, "id">): string | null =>
  !r.monto || r.monto <= 0 ? "El monto es obligatorio" : null;

export function colsBalon(precios: Precios): Col<Balon>[] {
  return [
    { key: "tipo", label: "Balón", tipo: "select", options: [...BALON_TIPO_OPTIONS] },
    { key: "cantidad", label: "Cantidad", tipo: "number" },
    {
      key: "id",
      label: "Total",
      tipo: "text",
      computar: (r) => soles(r.cantidad * (precios[r.tipo] ?? 0)),
    },
  ];
}
export const nuevoBalon = (): Omit<Balon, "id"> => ({ tipo: "gasfull", cantidad: 0 });
export const validarBalon = (r: Omit<Balon, "id">): string | null =>
  !r.cantidad || r.cantidad <= 0 ? "La cantidad es obligatoria" : null;
export const totalBalonesSoles = (rows: Balon[], precios: Precios): number =>
  rows.reduce((a, r) => a + r.cantidad * (precios[r.tipo] ?? 0), 0);

export const totalMonto = <T extends { monto: number }>(rows: T[]): number =>
  rows.reduce((a, r) => a + r.monto, 0);
