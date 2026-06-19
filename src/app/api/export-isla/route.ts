import { NextRequest } from "next/server";
import ExcelJS from "exceljs";
import path from "path";
import { calcularCuadre } from "@/lib/calc";
import { ISLAS } from "@/lib/config";
import type { Precios, ProductoId, Sesion } from "@/lib/types";

const PROD_LABEL: Record<ProductoId, string> = {
  bio: "BIO",
  regular: "REGULAR",
  premium: "PREMIUM",
  glp: "GLP",
};

const EPS = 0.01;
const r2 = (n: number) => Math.round(n * 100) / 100;

interface Posiciones {
  yapesInicio: number;
  descuentosInicio: number;
  creditosInicio: number;
  promocionesInicio: number;
  gastosInicio: number;
  filaTotales: number;
}

const DEFAULTS: Posiciones = {
  yapesInicio: 4,
  descuentosInicio: 4,
  creditosInicio: 4,
  promocionesInicio: 4,
  gastosInicio: 4,
  filaTotales: 46,
};

// Lee la hoja oculta CONFIG (si existe) para saber dónde empieza cada tabla.
// Así, si más adelante cambia el diseño del Excel, basta con actualizar esa
// hoja en vez de tocar el código.
function leerPosiciones(wb: ExcelJS.Workbook): Posiciones {
  const cfg = wb.getWorksheet("CONFIG");
  if (!cfg) return { ...DEFAULTS };
  const valores: Record<string, number> = {};
  cfg.eachRow((row) => {
    const clave = row.getCell(1).value;
    const valor = row.getCell(2).value;
    if (typeof clave === "string" && typeof valor === "number") {
      valores[clave] = valor;
    }
  });
  return {
    yapesInicio: valores.YAPES_INICIO ?? DEFAULTS.yapesInicio,
    descuentosInicio: valores.DESCUENTOS_INICIO ?? DEFAULTS.descuentosInicio,
    creditosInicio: valores.CREDITOS_INICIO ?? DEFAULTS.creditosInicio,
    promocionesInicio: valores.PROMOCIONES_INICIO ?? DEFAULTS.promocionesInicio,
    gastosInicio: valores.GASTOS_INICIO ?? DEFAULTS.gastosInicio,
    filaTotales: valores.FILA_TOTALES ?? DEFAULTS.filaTotales,
  };
}

export async function POST(req: NextRequest) {
  try {
    const { dia, turno, sesiones, precios } = (await req.json()) as {
      dia: string;
      turno: "manana" | "tarde" | "noche";
      sesiones: Sesion[];
      precios: Precios;
    };

    // Sin duplicados (por si el cliente envía la misma sesión dos veces)
    const sesionesUnicas = Array.from(
      new Map(sesiones.map((s) => [s.id, s])).values()
    );

    // Orden fijo: Isla 1, luego Isla 2, luego Isla 3
    const islasOrdenadas = ISLAS.map((isla) => ({
      isla,
      sesion: sesionesUnicas.find((s) => s.islaId === isla.id),
    }));

    const templatePath = path.join(
      process.cwd(),
      "src/server/templates/plantilla-isla.xlsx"
    );
    const wb = new ExcelJS.Workbook();
    await wb.xlsx.readFile(templatePath);
    const ws = wb.getWorksheet("tablas");
    if (!ws) throw new Error("La plantilla no tiene la hoja 'tablas'");

    // La plantilla trae 5 "tablas de Excel" con autofiltro. ExcelJS no las
    // mantiene bien al reescribir (sobre todo tras duplicar filas): los rangos
    // del autofiltro quedan corruptos y Excel pide "reparar" el archivo al
    // abrirlo. Como solo necesitamos los datos (sin filtros ni tablas), las
    // eliminamos antes de escribir. Los colores/estilos de celda se conservan.
    const wsTabla = ws as unknown as {
      tables?: Record<string, unknown>;
      removeTable?: (name: string) => void;
      autoFilter?: unknown;
    };
    if (wsTabla.tables && wsTabla.removeTable) {
      for (const nombre of Object.keys(wsTabla.tables)) {
        try {
          wsTabla.removeTable(nombre);
        } catch {
          /* si no se puede quitar una, seguimos con las demás */
        }
      }
    }
    wsTabla.autoFilter = undefined;

    const pos = leerPosiciones(wb);
    const precio = (p: ProductoId) => precios[p] ?? 0;

    // Construye, para cada tabla, la lista combinada Isla1→Isla2→Isla3
    const filasYapes = islasOrdenadas.flatMap(({ isla, sesion }) =>
      (sesion?.pagos ?? []).map((p) => ({ isla, sesion: sesion!, dato: p }))
    );
    const filasDescuentos = islasOrdenadas.flatMap(({ isla, sesion }) =>
      (sesion?.descuentos ?? []).map((d) => ({ isla, sesion: sesion!, dato: d }))
    );
    const filasCreditos = islasOrdenadas.flatMap(({ isla, sesion }) =>
      (sesion?.creditos ?? []).map((c) => ({ isla, sesion: sesion!, dato: c }))
    );
    const filasPromociones = islasOrdenadas.flatMap(({ isla, sesion }) =>
      (sesion?.promociones ?? []).map((p) => ({ isla, sesion: sesion!, dato: p }))
    );
    const filasGastos = islasOrdenadas.flatMap(({ isla, sesion }) =>
      (sesion?.gastos ?? []).map((g) => ({ isla, sesion: sesion!, dato: g }))
    );

    // Las 5 tablas están una al lado de la otra compartiendo el mismo rango
    // de filas y una única fila de totales al final; si alguna necesita más
    // filas de las disponibles, hay que insertar filas para TODAS a la vez.
    const huecosDisponibles = pos.filaTotales - pos.yapesInicio; // ej. 46-4=42
    const maxRegistros = Math.max(
      filasYapes.length,
      filasDescuentos.length,
      filasCreditos.length,
      filasPromociones.length,
      filasGastos.length
    );
    const extra = Math.max(0, maxRegistros - huecosDisponibles);
    if (extra > 0) {
      // La fila justo antes de los totales ya está en blanco en la
      // plantilla limpia; se duplica para que las nuevas también lo estén.
      ws.duplicateRow(pos.filaTotales - 1, extra, true);
    }
    const filaTotalesFinal = pos.filaTotales + extra;

    function escribirTabla(
      filas: { isla: (typeof ISLAS)[number]; sesion: Sesion; dato: unknown }[],
      inicio: number,
      escribirFila: (r: number, f: (typeof filas)[number]) => void
    ) {
      filas.forEach((f, i) => escribirFila(inicio + i, f));
    }

    escribirTabla(filasYapes, pos.yapesInicio, (r, f) => {
      const p = f.dato as Sesion["pagos"][number];
      ws.getCell(`A${r}`).value = f.isla.nombre;
      ws.getCell(`B${r}`).value = f.sesion.trabajador;
      ws.getCell(`C${r}`).value = p.metodo.toUpperCase();
      ws.getCell(`D${r}`).value = p.referencia || "";
      ws.getCell(`E${r}`).value = p.monto;
      ws.getCell(`F${r}`).value = p.factura || "";
    });
    const totalYapes = r2(filasYapes.reduce((a, f) => a + (f.dato as Sesion["pagos"][number]).monto, 0));
    ws.getCell(`E${filaTotalesFinal}`).value = totalYapes;

    // "TOTAL SOLES" del descuento = el AHORRO dado (galones × diferencia de
    // precio), no el total de la venta — así está definido en todo el
    // sistema (calcularCuadre.totalDescuentos), y así debe cuadrar acá.
    escribirTabla(filasDescuentos, pos.descuentosInicio, (r, f) => {
      const d = f.dato as Sesion["descuentos"][number];
      const descuentoPorGalon = Math.max(0, precio(d.producto) - d.precioDescuento);
      ws.getCell(`G${r}`).value = f.isla.nombre;
      ws.getCell(`H${r}`).value = d.cliente || "";
      ws.getCell(`I${r}`).value = PROD_LABEL[d.producto];
      ws.getCell(`J${r}`).value = d.precioDescuento;
      ws.getCell(`K${r}`).value = d.galones;
      ws.getCell(`L${r}`).value = r2(d.galones * descuentoPorGalon);
    });
    const totalDescuentos = r2(
      filasDescuentos.reduce((a, f) => {
        const d = f.dato as Sesion["descuentos"][number];
        return a + d.galones * Math.max(0, precio(d.producto) - d.precioDescuento);
      }, 0)
    );
    ws.getCell(`J${filaTotalesFinal}`).value = totalDescuentos;

    escribirTabla(filasCreditos, pos.creditosInicio, (r, f) => {
      const c = f.dato as Sesion["creditos"][number];
      const total = r2(c.galones * precio(c.producto));
      ws.getCell(`M${r}`).value = total;
      ws.getCell(`N${r}`).value = f.isla.nombre;
      ws.getCell(`O${r}`).value = c.cliente;
      ws.getCell(`P${r}`).value = c.vale;
      ws.getCell(`Q${r}`).value = PROD_LABEL[c.producto];
      ws.getCell(`R${r}`).value = c.galones;
      ws.getCell(`S${r}`).value = c.factura || "";
    });
    const totalCreditos = r2(
      filasCreditos.reduce((a, f) => {
        const c = f.dato as Sesion["creditos"][number];
        return a + c.galones * precio(c.producto);
      }, 0)
    );
    ws.getCell(`R${filaTotalesFinal}`).value = totalCreditos;

    escribirTabla(filasPromociones, pos.promocionesInicio, (r, f) => {
      const p = f.dato as Sesion["promociones"][number];
      ws.getCell(`T${r}`).value = f.isla.nombre;
      ws.getCell(`U${r}`).value = p.dniPlaca || "";
      ws.getCell(`V${r}`).value = f.sesion.trabajador;
      ws.getCell(`W${r}`).value = PROD_LABEL[p.producto];
      ws.getCell(`X${r}`).value = p.galones;
      ws.getCell(`Y${r}`).value = r2(p.galones * precio(p.producto));
    });
    const totalPromociones = r2(
      filasPromociones.reduce((a, f) => {
        const p = f.dato as Sesion["promociones"][number];
        return a + p.galones * precio(p.producto);
      }, 0)
    );
    ws.getCell(`X${filaTotalesFinal}`).value = totalPromociones;

    escribirTabla(filasGastos, pos.gastosInicio, (r, f) => {
      const g = f.dato as Sesion["gastos"][number];
      ws.getCell(`Z${r}`).value = f.isla.nombre;
      ws.getCell(`AA${r}`).value = g.descripcion;
      ws.getCell(`AB${r}`).value = g.monto;
    });
    const totalGastos = r2(
      filasGastos.reduce((a, f) => a + (f.dato as Sesion["gastos"][number]).monto, 0)
    );
    ws.getCell(`AB${filaTotalesFinal}`).value = totalGastos;

    // ===== Validación final: cada total escrito en la hoja debe coincidir
    // con el cálculo independiente del sistema (calcularCuadre) para las 3
    // islas combinadas de este turno. Si hay diferencia, no se genera nada.
    const cuadresIsla = islasOrdenadas
      .filter((x) => x.sesion)
      .map((x) => calcularCuadre(x.sesion!, precios));
    const sumaSistema = (f: (c: ReturnType<typeof calcularCuadre>) => number) =>
      r2(cuadresIsla.reduce((a, c) => a + f(c), 0));

    const checks: [string, number, number][] = [
      ["Yapes/Transferencias/Visa", totalYapes, sumaSistema((c) => c.totalElectronico)],
      ["Descuentos", totalDescuentos, sumaSistema((c) => c.totalDescuentos)],
      ["Créditos", totalCreditos, sumaSistema((c) => c.totalCreditos)],
      ["Promociones", totalPromociones, sumaSistema((c) => c.totalPromociones)],
      ["Gastos", totalGastos, sumaSistema((c) => c.totalGastos)],
    ];
    const diferencias = checks.filter(([, a, b]) => Math.abs(a - b) > EPS);
    if (diferencias.length > 0) {
      return Response.json(
        {
          error:
            "Los totales no coinciden con los cálculos del sistema. No se generó el archivo.",
          detalle: diferencias.map(([nombre, archivo, sistema]) => ({
            nombre,
            archivo,
            sistema,
          })),
        },
        { status: 422 }
      );
    }

    // Normaliza la fuente de toda la zona de datos. La plantilla tenía celdas
    // de muestra con fuentes en rojo/negrita/grande (tamaño 14) que se quedaban
    // pegadas al escribir el valor encima. Solo tocamos la fuente: rellenos,
    // bordes y colores de fondo de los encabezados se conservan.
    const FUENTE_NORMAL = { name: "Calibri", size: 11 };
    for (let f = pos.yapesInicio; f <= filaTotalesFinal; f++) {
      for (let c = 1; c <= 28; c++) {
        ws.getCell(f, c).font = FUENTE_NORMAL;
      }
    }

    const buffer = await wb.xlsx.writeBuffer();
    return new Response(new Uint8Array(buffer), {
      headers: {
        "Content-Type":
          "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet",
        "Content-Disposition": `attachment; filename="reporte_${dia}_${turno}.xlsx"`,
      },
    });
  } catch (e) {
    return Response.json(
      { error: "No se pudo generar el reporte por isla.", detalle: String(e) },
      { status: 500 }
    );
  }
}
