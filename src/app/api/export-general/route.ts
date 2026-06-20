import { NextRequest } from "next/server";
import ExcelJS from "exceljs";
import path from "path";
import { calcularReporteDia } from "@/lib/calc";
import type { Precios, ProductoId, Sesion } from "@/lib/types";

// Orden de las 4 columnas de producto en la plantilla: BIO-DIESEL, G-R, G-P, GLP
const PRODUCTO_COLS: { producto: ProductoId; col: string; puCol: string }[] = [
  { producto: "bio", col: "D", puCol: "E" },
  { producto: "regular", col: "F", puCol: "G" },
  { producto: "premium", col: "H", puCol: "I" },
  { producto: "glp", col: "J", puCol: "K" },
];

const MESES = [
  "ENERO", "FEBRERO", "MARZO", "ABRIL", "MAYO", "JUNIO",
  "JULIO", "AGOSTO", "SEPTIEMBRE", "OCTUBRE", "NOVIEMBRE", "DICIEMBRE",
];

function fechaTitulo(dia: string): string {
  const [y, m, d] = dia.split("-").map(Number);
  return `VENTA. DEL DIA ${d} ${MESES[m - 1]} ${y}`;
}

// Formato de moneda nativo de Excel: muestra "S/ 1,234.56", "-S/ 1,234.56"
// para negativos y "S/ -" para el cero. Al guardar el valor como NÚMERO con
// este numFmt (en lugar de un string "S/ ..."), Excel ya no marca el aviso de
// "número almacenado como texto".
const SOLES_FMT = '"S/ "#,##0.00;-"S/ "#,##0.00;"S/ -"';

const EPS = 0.01;
const r2 = (n: number) => Math.round(n * 100) / 100;

export async function POST(req: NextRequest) {
  try {
    const { dia, sesiones, precios } = (await req.json()) as {
      dia: string;
      sesiones: Sesion[];
      precios: Precios;
    };

    const rep = calcularReporteDia(sesiones, dia, precios);

    const descuentos = sesiones.flatMap((s) => s.descuentos);
    const creditos = sesiones.flatMap((s) => s.creditos);
    const promociones = sesiones.flatMap((s) => s.promociones);
    const todosPagos = sesiones.flatMap((s) => s.pagos);

    const galonesPorProducto = (p: ProductoId) =>
      rep.porProducto.find((f) => f.producto === p)?.galones ?? 0;
    const galonesCreditoPorProducto = (p: ProductoId) =>
      creditos.filter((c) => c.producto === p).reduce((a, c) => a + c.galones, 0);
    const galonesPromoPorProducto = (p: ProductoId) =>
      promociones.filter((x) => x.producto === p).reduce((a, x) => a + x.galones, 0);
    const sumaPagos = (metodo: string) =>
      todosPagos.filter((p) => p.metodo === metodo).reduce((a, p) => a + p.monto, 0);

    const templatePath = path.join(process.cwd(), "src/server/templates/madre.xlsx");
    const wb = new ExcelJS.Workbook();
    await wb.xlsx.readFile(templatePath);
    const ws = wb.worksheets[0];

    // Escribe un monto como número con formato de moneda (ver SOLES_FMT).
    const setSoles = (addr: string, n: number) => {
      const c = ws.getCell(addr);
      c.value = n;
      c.numFmt = SOLES_FMT;
    };

    // La plantilla original trae datos de muestra (clientes, vales, montos
    // reales de un día anterior) en TODAS las filas de Descuentos (7-18) y
    // Créditos (20-36), no solo en las que tengan datos nuevos. Hay que
    // limpiarlas todas antes de escribir, o se filtran al reporte final.
    const COLS_RANGO = ["A", "B", "C", "D", "E", "F", "G", "H", "I", "J", "K", "L"];
    function limpiarRango(filaIni: number, filaFin: number) {
      for (let f = filaIni; f <= filaFin; f++) {
        for (const col of COLS_RANGO) ws.getCell(`${col}${f}`).value = null;
      }
    }
    limpiarRango(7, 18);
    limpiarRango(20, 36);

    // --- Filas extra necesarias (huecos fijos: descuentos 12, créditos 17, promos 0) ---
    const extraDescuentos = Math.max(0, descuentos.length - 12);
    const extraCreditos = Math.max(0, creditos.length - 17);
    const extraPromos = promociones.length; // sin huecos reservados

    // Las filas 18 y 36 ya están en blanco (recién limpiadas), así que al
    // duplicarlas para el overflow, las copias también nacen en blanco.
    if (extraDescuentos > 0) ws.duplicateRow(18, extraDescuentos, true);
    if (extraCreditos > 0) ws.duplicateRow(36 + extraDescuentos, extraCreditos, true);

    // Promociones no tiene fila de datos propia para duplicar (el título
    // está justo encima del total). Se duplica el título solo para fijar la
    // posición de inserción, y luego se limpia el contenido y se le copia
    // el estilo de una fila de datos en blanco (créditos) para que no se
    // vea como un título repetido.
    if (extraPromos > 0) {
      const filaTitulo = 37 + extraDescuentos + extraCreditos;
      const filaEstilo = 20 + extraDescuentos; // primera fila de créditos, ya en blanco
      ws.duplicateRow(filaTitulo, extraPromos, true);
      for (let i = 0; i < extraPromos; i++) {
        const f = filaTitulo + 1 + i;
        for (const col of COLS_RANGO) {
          const destino = ws.getCell(`${col}${f}`);
          destino.value = null;
          destino.style = ws.getCell(`${col}${filaEstilo}`).style;
        }
      }
    }

    // Mapea un número de fila ORIGINAL (de la plantilla) a su posición final
    // tras las inserciones anteriores.
    function mapRow(original: number): number {
      let r = original;
      if (original >= 19) r += extraDescuentos;
      if (original >= 37) r += extraCreditos;
      if (original >= 38) r += extraPromos;
      return r;
    }

    // --- Encabezado ---
    ws.getCell("B3").value = fechaTitulo(dia);
    for (const { producto, col } of PRODUCTO_COLS) {
      setSoles(`${col}1`, precios[producto] ?? 0);
      ws.getCell(`${col}2`).value = galonesPorProducto(producto);
    }
    ws.getCell("M2").value = rep.totalAdelantos || null;

    // --- DESCUENTOS (filas 7..18, o más si hubo overflow) ---
    let r = 7;
    for (const d of descuentos) {
      const grupo = PRODUCTO_COLS.find((g) => g.producto === d.producto);
      if (!grupo) continue;
      const descuentoPorGalon = Math.max(0, (precios[d.producto] ?? 0) - d.precioDescuento);
      ws.getCell(`B${r}`).value = d.cliente || "";
      ws.getCell(`${grupo.col}${r}`).value = d.galones;
      ws.getCell(`${grupo.puCol}${r}`).value = descuentoPorGalon;
      r++;
    }

    // --- CREDITOS (filas 20..36, o más) ---
    r = mapRow(20);
    for (const c of creditos) {
      const grupo = PRODUCTO_COLS.find((g) => g.producto === c.producto);
      if (!grupo) continue;
      ws.getCell(`B${r}`).value = c.cliente;
      ws.getCell(`C${r}`).value = c.vale;
      ws.getCell(`${grupo.col}${r}`).value = c.galones;
      r++;
    }

    // --- PROMOCIONES (insertadas tras el título, fila mapRow(37)+1..) ---
    r = mapRow(37) + 1;
    for (const p of promociones) {
      const grupo = PRODUCTO_COLS.find((g) => g.producto === p.producto);
      if (!grupo) continue;
      ws.getCell(`A${r}`).value = p.dniPlaca || "";
      ws.getCell(`${grupo.col}${r}`).value = p.galones;
      r++;
    }

    // --- Totales de créditos por producto (filas 38 y 40 originales) ---
    // El total de galones en crédito incluye además los de promociones.
    for (const { producto, col } of PRODUCTO_COLS) {
      const gl = galonesCreditoPorProducto(producto) + galonesPromoPorProducto(producto);
      ws.getCell(`${col}${mapRow(38)}`).value = gl;
      ws.getCell(`${col}${mapRow(40)}`).value = gl === 0 ? "-" : gl;
    }

    // --- VENTA TOTEN (filas 43-46): galones = total - créditos - promociones ---
    const ventaTotenRows = [43, 44, 45, 46];
    let totalVentaToten = 0;
    PRODUCTO_COLS.forEach(({ producto, col, puCol }, i) => {
      const fila = mapRow(ventaTotenRows[i]);
      const glToten = Math.max(
        0,
        galonesPorProducto(producto) -
          galonesCreditoPorProducto(producto) -
          galonesPromoPorProducto(producto)
      );
      const precioNormal = precios[producto] ?? 0;
      const solesToten = glToten * precioNormal;
      ws.getCell(`${col}${fila}`).value = glToten;
      setSoles(`${puCol}${fila}`, precioNormal);
      setSoles(`L${fila}`, r2(solesToten));
      totalVentaToten += solesToten;
    });
    totalVentaToten = r2(totalVentaToten);
    setSoles(`L${mapRow(47)}`, totalVentaToten);

    // --- Balones de gas (Full Gas | Zeta Gas) ---
    setSoles(`L${mapRow(49)}`, r2(rep.totalBalones));

    // Sin datos en el sistema: se deja vacío (no se inventan valores)
    ws.getCell(`L${mapRow(50)}`).value = null;
    ws.getCell(`B${mapRow(51)}`).value = null;
    ws.getCell(`B${mapRow(52)}`).value = null;
    ws.getCell(`B${mapRow(53)}`).value = null;
    ws.getCell(`L${mapRow(51)}`).value = null;
    ws.getCell(`L${mapRow(52)}`).value = null;
    ws.getCell(`L${mapRow(53)}`).value = null;

    // --- TOTAL = venta toten + balones ---
    const totalGeneral = r2(totalVentaToten + rep.totalBalones);
    setSoles(`L${mapRow(54)}`, totalGeneral);

    // --- Deducciones ---
    setSoles(`L${mapRow(56)}`, r2(rep.totalDescuentos));
    setSoles(`L${mapRow(57)}`, r2(rep.totalGastos));
    const visas = r2(sumaPagos("visa"));
    const yapes = r2(sumaPagos("yape"));
    const transferencias = r2(sumaPagos("transferencia"));
    setSoles(`L${mapRow(58)}`, visas);
    setSoles(`L${mapRow(59)}`, yapes);
    setSoles(`L${mapRow(60)}`, transferencias);
    const totalDeducciones = r2(
      rep.totalDescuentos + rep.totalGastos + visas + yapes + transferencias
    );
    setSoles(`L${mapRow(61)}`, totalDeducciones);

    // --- ENTREGAR: se usa el cálculo ya validado del sistema ---
    const entregar = r2(rep.efectivoAEntregar);
    setSoles(`L${mapRow(62)}`, entregar);
    setSoles(`L${mapRow(63)}`, r2(rep.totalEntregado));
    const diferencia = r2(rep.totalEntregado - entregar);
    setSoles(`L${mapRow(64)}`, diferencia);
    ws.getCell(`M${mapRow(64)}`).value =
      diferencia < -EPS ? "FALTA" : diferencia > EPS ? "SOBRA" : null;

    // --- Calibración: solo se reflejan los precios (lo único que existe en el sistema) ---
    for (const { producto, puCol } of PRODUCTO_COLS) {
      setSoles(`${puCol}${mapRow(66)}`, precios[producto] ?? 0);
    }
    ws.getCell(`L${mapRow(66)}`).value = null;

    // --- Telemedición: no existe en el sistema, se deja vacío ---
    for (let row = 69; row <= 74; row++) {
      ws.getCell(`C${mapRow(row)}`).value = null;
    }

    // exceljs.duplicateRow descarta los rangos combinados (mergeCells) que
    // quedan por debajo del punto de inserción. Al haber overflow, el "TOTAL"
    // combinado A:C se rompía y se veía repetido 3 veces. Se vuelven a aplicar
    // en su posición final.
    if (extraDescuentos + extraCreditos + extraPromos > 0) {
      const remerge = (desde: string, hasta: string) => {
        try {
          ws.unMergeCells(`${desde}:${hasta}`);
        } catch {
          /* no estaba combinado */
        }
        ws.mergeCells(`${desde}:${hasta}`);
      };
      remerge(`A${mapRow(61)}`, `C${mapRow(61)}`); // TOTAL deducciones
      remerge(`B${mapRow(68)}`, `C${mapRow(68)}`); // TELEMEDICION
      remerge(`E${mapRow(68)}`, `F${mapRow(68)}`);
    }

    // Altura uniforme de 14.5 para todas las filas con contenido.
    for (let i = 1; i <= ws.rowCount; i++) {
      ws.getRow(i).height = 14.5;
    }

    // ===== Validación final: el ENTREGAR del archivo debe coincidir con el
    // cálculo independiente (TOTAL - deducciones + a cuenta) hecho con las
    // celdas que se acaban de escribir. Si no coincide, se aborta sin
    // generar el archivo.
    const entregarRecomputado = totalGeneral - totalDeducciones + rep.totalAdelantos;
    if (Math.abs(entregarRecomputado - entregar) > EPS) {
      return Response.json(
        {
          error:
            "Los totales no coinciden: el cálculo del reporte no concuerda con el del sistema. No se generó el archivo.",
          detalle: { entregarSistema: entregar, entregarRecomputado },
        },
        { status: 422 }
      );
    }

    const buffer = await wb.xlsx.writeBuffer();
    return new Response(new Uint8Array(buffer), {
      headers: {
        "Content-Type":
          "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet",
        "Content-Disposition": `attachment; filename="reporte_general_${dia}.xlsx"`,
      },
    });
  } catch (e) {
    return Response.json(
      { error: "No se pudo generar el reporte general.", detalle: String(e) },
      { status: 500 }
    );
  }
}
