"use client";

import { useEffect, useMemo, useState, type ComponentProps, type ReactNode } from "react";
import { useRouter } from "next/navigation";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import { Badge } from "@/components/ui/badge";
import {
  Dialog,
  DialogContent,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import {
  BALONES,
  getIsla,
  PRODUCTOS,
  PRODUCTO_COLOR,
  turnoLabel,
} from "@/lib/config";
import { backupSiTurnoCompleto, upsertSesion } from "@/lib/db";
import { useStore } from "@/lib/store";
import { calcularCuadre, soles } from "@/lib/calc";
import type {
  Adelanto,
  Balon,
  Credito,
  Descuento,
  Entrega,
  Gasto,
  PagoElectronico,
  Promocion,
  ProductoId,
} from "@/lib/types";
import { RegistroModal } from "@/components/grifo/registro-modal";
import { RegistroAddForm } from "@/components/grifo/registro-fields";
import { cn } from "@/lib/utils";
import {
  colsAdelanto,
  colsBalon,
  colsCredito,
  colsDescuento,
  colsEntrega,
  colsGasto,
  colsPago,
  colsPromo,
  nuevoAdelanto,
  nuevoBalon,
  nuevoCredito,
  nuevoDescuento,
  nuevoEntrega,
  nuevoGasto,
  nuevoPago,
  nuevoPromo,
  totalBalonesSoles,
  totalMonto,
  validarAdelanto,
  validarBalon,
  validarCredito,
  validarDescuento,
  validarEntrega,
  validarGasto,
  validarPago,
  validarPromo,
} from "@/lib/registro-columns";

export default function DashboardPage() {
  const router = useRouter();
  const auth = useStore((s) => s.auth);
  const sesion = useStore((s) =>
    s.sesiones.find((x) => x.id === s.currentSesionId)
  );
  const setOdometro = useStore((s) => s.setOdometro);
  const cerrarSesion = useStore((s) => s.cerrarSesion);
  const setCurrentSesion = useStore((s) => s.setCurrentSesion);
  const logout = useStore((s) => s.logout);
  const precios = useStore((s) => s.precios);
  const store = useStore();

  const [hydrated, setHydrated] = useState(false);
  const [confirmandoCierre, setConfirmandoCierre] = useState(false);
  useEffect(() => setHydrated(true), []);
  useEffect(() => {
    if (hydrated && !auth) router.replace("/");
    else if (hydrated && auth && !sesion) router.replace("/setup");
  }, [hydrated, auth, sesion, router]);

  const isla = sesion ? getIsla(sesion.islaId) : undefined;

  const productoOptions = useMemo(
    () => (isla?.productos ?? []).map((p) => ({ value: p, label: PRODUCTOS[p] })),
    [isla]
  );

  if (!hydrated || !auth || !sesion || !isla) return null;

  const precio = (p: ProductoId) => precios[p] ?? 0;
  const cuadre = calcularCuadre(sesion, precios);
  const esGlp = isla.tipo === "glp";

  async function finalizarTurno() {
    setConfirmandoCierre(false);
    cerrarSesion(sesion!.id);
    // Escribir el cierre a Firestore EXPLÍCITAMENTE aquí: el guardado
    // automático solo escribe el turno activo, y al limpiar currentSesionId
    // ese guardado ya no dispararía — así que el cerrada:true se perdería.
    const cerrada = useStore
      .getState()
      .sesiones.find((s) => s.id === sesion!.id);
    if (cerrada) {
      try {
        await upsertSesion(cerrada);
        // Si con este cierre el turno quedó completo (las 3 islas cerradas),
        // se crea una copia de seguridad automática de ese turno.
        await backupSiTurnoCompleto(cerrada.diaOperativo, cerrada.turno);
      } catch (e) {
        console.error("No se pudo guardar el cierre del turno:", e);
      }
    }
    setCurrentSesion(null);
    router.push("/setup");
  }

  // ---- Columnas compartidas (formulario inline + modal tabla) ----
  const cCredito = colsCredito(productoOptions, precio);
  const cPromo = colsPromo(productoOptions, precio);
  const cDescuento = colsDescuento(productoOptions, precio);
  const cBalon = colsBalon(precios);

  return (
    <div className="min-h-screen bg-gradient-to-b from-slate-100 to-slate-200 dark:from-slate-950 dark:to-slate-900">
      {/* Encabezado */}
      <header className="sticky top-0 z-20 border-b bg-slate-900 text-white shadow-md">
        <div className="mx-auto flex max-w-7xl flex-wrap items-center justify-between gap-2 px-4 py-2">
          <div className="flex items-center gap-2">
            <span className="text-lg font-bold">⛽ {isla.nombre}</span>
            <Badge className="bg-amber-500 text-black hover:bg-amber-500">
              {turnoLabel(sesion.turno)}
            </Badge>
            <Badge variant="secondary">
              {auth.rol === "admin" ? "Admin" : auth.trabajador}
            </Badge>
          </div>
          {/* Precios */}
          <div className="flex flex-wrap items-center gap-2">
            {isla.productos.map((p) => (
              <div
                key={p}
                className="flex items-center gap-1 rounded-md bg-white/10 px-2 py-1 text-sm"
              >
                <span className="font-medium">{PRODUCTOS[p]}</span>
                <span className="font-bold text-amber-300">{soles(precio(p))}</span>
              </div>
            ))}
            {esGlp &&
              (["gasfull", "zetagas"] as const).map((b) => (
                <div
                  key={b}
                  className="flex items-center gap-1 rounded-md bg-white/10 px-2 py-1 text-sm"
                >
                  <span className="font-medium">{BALONES[b]}</span>
                  <span className="font-bold text-amber-300">
                    {soles(precios[b] ?? 0)}
                  </span>
                </div>
              ))}
          </div>
          <div className="flex gap-2">
            <Button
              size="sm"
              variant="ghost"
              className="text-white hover:bg-white/10 hover:text-white"
              onClick={() => {
                logout();
                router.replace("/");
              }}
            >
              Salir
            </Button>
          </div>
        </div>
      </header>

      <main className="mx-auto grid max-w-7xl gap-3 p-3 lg:grid-cols-3">
        {/* ----- Columna izquierda ----- */}
        <div className="space-y-3 lg:col-span-2">
          {/* Odómetros estilo Excel */}
          <section className="animate-fade-up overflow-hidden rounded-xl border bg-card shadow-sm">
            <div className="bg-slate-800 px-4 py-1 text-center text-xs font-bold tracking-wide text-white">
              ODÓMETROS
            </div>
            <div className="overflow-x-auto text-xs [&_td]:px-2 [&_td]:py-0.5 [&_th]:h-7 [&_th]:px-2">
              <Table>
                <TableHeader>
                  <TableRow className="bg-muted/50">
                    <TableHead className="font-bold">N-D-ISLA</TableHead>
                    <TableHead className="font-bold text-red-500">INICIO</TableHead>
                    <TableHead className="font-bold text-red-500">FINAL</TableHead>
                    <TableHead className="text-right font-bold">GALONES</TableHead>
                    <TableHead className="text-right font-bold">PRECIO</TableHead>
                    <TableHead className="text-right font-bold">EN SOLES</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {isla.mangueras.map((m) => {
                    const o = sesion.odometros[m.id];
                    const gl = Math.max(0, (o?.salida ?? 0) - (o?.entrada ?? 0));
                    const pr = precio(m.producto);
                    return (
                      <TableRow key={m.id}>
                        <TableCell
                          className={cn("font-semibold", PRODUCTO_COLOR[m.producto])}
                        >
                          {m.label}
                        </TableCell>
                        <TableCell>
                          <Input
                            className="h-7 w-20 text-xs font-medium"
                            type="number"
                            value={o?.entrada || ""}
                            onWheel={(e) => e.currentTarget.blur()}
                            onChange={(e) =>
                              setOdometro(m.id, { entrada: Number(e.target.value) })
                            }
                          />
                        </TableCell>
                        <TableCell>
                          <Input
                            className="h-7 w-20 text-xs font-medium"
                            type="number"
                            value={o?.salida || ""}
                            onWheel={(e) => e.currentTarget.blur()}
                            onChange={(e) =>
                              setOdometro(m.id, { salida: Number(e.target.value) })
                            }
                          />
                        </TableCell>
                        <TableCell className="text-right font-medium">
                          {gl.toFixed(0)}
                        </TableCell>
                        <TableCell className="text-right">{soles(pr)}</TableCell>
                        <TableCell className="text-right font-semibold">
                          {soles(gl * pr)}
                        </TableCell>
                      </TableRow>
                    );
                  })}
                  <TableRow className="bg-slate-100 font-bold dark:bg-slate-800">
                    <TableCell colSpan={5} className="text-right">
                      SUMA EN SOLES
                    </TableCell>
                    <TableCell className="text-right text-base">
                      {soles(cuadre.ventaTotal)}
                    </TableCell>
                  </TableRow>
                </TableBody>
              </Table>
            </div>
          </section>

          {/* Ingresos / registros inline */}
          <section className="animate-fade-up overflow-hidden rounded-xl border bg-card shadow-sm" style={{ animationDelay: "80ms" }}>
            <div className="bg-slate-800 px-4 py-1 text-center text-xs font-bold tracking-wide text-white">
              INGRESOS Y REGISTROS
            </div>
            <div className="divide-y">
              <Seccion titulo="💳 Yapes / Transferencias / Visas">
                <RegistroAddForm
                  columns={colsPago()}
                  nuevo={nuevoPago}
                  validar={validarPago}
                  dense
                  onAdd={store.addPago}
                />
              </Seccion>
              <Seccion titulo="📒 Créditos">
                <RegistroAddForm
                  columns={cCredito}
                  nuevo={() => nuevoCredito(isla.productos[0])}
                  validar={validarCredito}
                  dense
                  onAdd={store.addCredito}
                />
              </Seccion>
              <Seccion titulo="🎁 Promociones">
                <RegistroAddForm
                  columns={cPromo}
                  nuevo={() => nuevoPromo(isla.productos[0])}
                  validar={validarPromo}
                  dense
                  onAdd={store.addPromocion}
                />
              </Seccion>
              <Seccion titulo="🏷️ Descuentos">
                <RegistroAddForm
                  columns={cDescuento}
                  nuevo={() => nuevoDescuento(isla.productos[0])}
                  validar={validarDescuento}
                  dense
                  onAdd={store.addDescuento}
                />
              </Seccion>
              <Seccion titulo="💸 Gastos">
                <RegistroAddForm
                  columns={colsGasto()}
                  nuevo={nuevoGasto}
                  validar={validarGasto}
                  dense
                  onAdd={store.addGasto}
                />
              </Seccion>
              <Seccion titulo="💰 Pago adelantado">
                <RegistroAddForm
                  columns={colsAdelanto()}
                  nuevo={nuevoAdelanto}
                  validar={validarAdelanto}
                  dense
                  onAdd={store.addAdelanto}
                />
              </Seccion>
              <Seccion titulo="📤 Entregas al encargado">
                <RegistroAddForm
                  columns={colsEntrega()}
                  nuevo={nuevoEntrega}
                  validar={validarEntrega}
                  dense
                  onAdd={store.addEntrega}
                />
              </Seccion>
              {esGlp && (
                <Seccion titulo="🛢️ Balones de gas">
                  <RegistroAddForm
                    columns={cBalon}
                    nuevo={nuevoBalon}
                    validar={validarBalon}
                    dense
                    onAdd={store.addBalon}
                  />
                </Seccion>
              )}
            </div>
          </section>
        </div>

        {/* ----- Columna derecha ----- */}
        <div className="space-y-3">
          {/* Botones de tablas */}
          <section className="animate-fade-up rounded-xl border bg-card p-2 shadow-sm" style={{ animationDelay: "120ms" }}>
            <h3 className="mb-1.5 text-[11px] font-bold text-muted-foreground">
              TABLAS
            </h3>
            <div className="grid grid-cols-2 gap-1.5">
              <RegistroModal<PagoElectronico>
                titulo="Pagos electrónicos"
                islaNombre={isla.nombre}
                rows={sesion.pagos}
                columns={colsPago()}
                onUpdate={store.updatePago}
                onRemove={store.removePago}
                resumen={(r) => `Total: ${soles(totalMonto(r))}`}
                trigger={<TablaBtn icon="💳" label="Pagos" n={sesion.pagos.length} />}
              />
              <RegistroModal<Credito>
                titulo="Créditos"
                islaNombre={isla.nombre}
                rows={sesion.creditos}
                columns={cCredito}
                onUpdate={store.updateCredito}
                onRemove={store.removeCredito}
                resumen={(r) =>
                  `Total: ${soles(
                    r.reduce((a, x) => a + x.galones * precio(x.producto), 0)
                  )}`
                }
                trigger={
                  <TablaBtn icon="📒" label="Créditos" n={sesion.creditos.length} />
                }
              />
              <RegistroModal<Promocion>
                titulo="Promociones"
                islaNombre={isla.nombre}
                rows={sesion.promociones}
                columns={cPromo}
                onUpdate={store.updatePromocion}
                onRemove={store.removePromocion}
                resumen={(r) =>
                  `Total: ${soles(
                    r.reduce((a, x) => a + x.galones * precio(x.producto), 0)
                  )}`
                }
                trigger={
                  <TablaBtn icon="🎁" label="Promos" n={sesion.promociones.length} />
                }
              />
              <RegistroModal<Descuento>
                titulo="Descuentos"
                islaNombre={isla.nombre}
                rows={sesion.descuentos}
                columns={cDescuento}
                onUpdate={store.updateDescuento}
                onRemove={store.removeDescuento}
                resumen={(r) =>
                  `Descuento total: ${soles(
                    r.reduce(
                      (a, x) =>
                        a +
                        x.galones * Math.max(0, precio(x.producto) - x.precioDescuento),
                      0
                    )
                  )}`
                }
                trigger={
                  <TablaBtn
                    icon="🏷️"
                    label="Descuentos"
                    n={sesion.descuentos.length}
                  />
                }
              />
              <RegistroModal<Gasto>
                titulo="Gastos"
                islaNombre={isla.nombre}
                rows={sesion.gastos}
                columns={colsGasto()}
                onUpdate={store.updateGasto}
                onRemove={store.removeGasto}
                resumen={(r) => `Total: ${soles(totalMonto(r))}`}
                trigger={<TablaBtn icon="💸" label="Gastos" n={sesion.gastos.length} />}
              />
              <RegistroModal<Adelanto>
                titulo="Pago adelantado"
                islaNombre={isla.nombre}
                rows={sesion.adelantos}
                columns={colsAdelanto()}
                onUpdate={store.updateAdelanto}
                onRemove={store.removeAdelanto}
                resumen={(r) => `Total: ${soles(totalMonto(r))}`}
                trigger={
                  <TablaBtn icon="💰" label="Adelantos" n={sesion.adelantos.length} />
                }
              />
              <RegistroModal<Entrega>
                titulo="Entregas al encargado"
                islaNombre={isla.nombre}
                rows={sesion.entregas}
                columns={colsEntrega()}
                onUpdate={store.updateEntrega}
                onRemove={store.removeEntrega}
                resumen={(r) => `Total: ${soles(totalMonto(r))}`}
                trigger={
                  <TablaBtn icon="📤" label="Entregas" n={sesion.entregas.length} />
                }
              />
              {esGlp && (
                <RegistroModal<Balon>
                  titulo="Balones de gas"
                  islaNombre={isla.nombre}
                  rows={sesion.balones ?? []}
                  columns={cBalon}
                  onUpdate={store.updateBalon}
                  onRemove={store.removeBalon}
                  resumen={(r) => `Total: ${soles(totalBalonesSoles(r, precios))}`}
                  trigger={
                    <TablaBtn
                      icon="🛢️"
                      label="Balones"
                      n={(sesion.balones ?? []).length}
                    />
                  }
                />
              )}
            </div>
          </section>

          {/* Cuadre */}
          <section className="animate-fade-up rounded-xl border bg-card p-3 shadow-sm" style={{ animationDelay: "160ms" }}>
            <h3 className="mb-2 text-sm font-bold">🧮 Cuadre de caja</h3>
            <div className="space-y-0.5 text-xs">
              <Linea label="Venta total" valor={soles(cuadre.ventaTotal)} bold />
              <Linea label="− Créditos" valor={soles(cuadre.totalCreditos)} neg />
              <Linea label="− Promociones" valor={soles(cuadre.totalPromociones)} neg />
              <Linea label="− Descuentos" valor={soles(cuadre.totalDescuentos)} neg />
              <Linea
                label="− Pagos electrónicos"
                valor={soles(cuadre.totalElectronico)}
                neg
              />
              <Linea label="− Gastos" valor={soles(cuadre.totalGastos)} neg />
              <Linea
                label="+ Pago adelantado"
                valor={soles(cuadre.totalAdelantos)}
                pos
              />
              {esGlp && (
                <Linea
                  label="+ Balones de gas"
                  valor={soles(cuadre.totalBalones)}
                  pos
                />
              )}
            </div>
            <div className="my-2 flex items-center justify-between rounded-lg bg-primary/10 px-3 py-1.5">
              <span className="text-sm font-semibold">Efectivo a entregar</span>
              <span className="text-base font-bold text-primary">
                {soles(cuadre.efectivoAEntregar)}
              </span>
            </div>
            <div className="space-y-0.5 text-xs">
              <Linea label="Entregado al encargado" valor={soles(cuadre.totalEntregado)} />
              <div className="flex items-center justify-between rounded-lg bg-amber-500/15 px-3 py-1.5">
                <span className="font-semibold">Saldo pendiente</span>
                <span
                  className={cn(
                    "text-base font-bold",
                    cuadre.saldoPendiente > 0.001
                      ? "text-amber-600"
                      : "text-green-600"
                  )}
                >
                  {soles(cuadre.saldoPendiente)}
                </span>
              </div>
            </div>
          </section>

          {/* Recordatorio antes de cerrar el turno */}
          <div className="flex items-start gap-2 rounded-lg border border-amber-300/60 bg-amber-50 p-2.5 text-[11px] text-amber-800 dark:border-amber-500/30 dark:bg-amber-950/30 dark:text-amber-200">
            <span className="text-sm">📝</span>
            <span>
              Antes de finalizar, revisa que todo esté registrado: pagos,
              créditos, gastos y entregas. Una vez cerrado no podrás editar el
              turno.
            </span>
          </div>

          <Button
            className="h-10 w-full bg-orange-500 text-sm font-bold transition-all hover:bg-orange-600 hover:shadow-lg hover:shadow-orange-500/30 active:scale-[0.98]"
            onClick={() => setConfirmandoCierre(true)}
          >
            FINALIZAR TURNO
          </Button>
        </div>
      </main>

      <Dialog open={confirmandoCierre} onOpenChange={setConfirmandoCierre}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>¿Finalizar y cerrar este turno?</DialogTitle>
          </DialogHeader>
          <p className="text-sm text-muted-foreground">
            No podrás seguir editando este turno desde este dispositivo después
            de cerrarlo.
          </p>
          <DialogFooter>
            <Button variant="outline" onClick={() => setConfirmandoCierre(false)}>
              Cancelar
            </Button>
            <Button onClick={finalizarTurno}>Finalizar turno</Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}

function Seccion({
  titulo,
  children,
}: {
  titulo: string;
  children: ReactNode;
}) {
  return (
    <div className="flex items-center gap-2 px-2 py-1.5">
      <h4 className="w-24 shrink-0 text-[11px] font-bold leading-tight">
        {titulo}
      </h4>
      <div className="flex-1">{children}</div>
    </div>
  );
}

function TablaBtn({
  icon,
  label,
  n,
  className,
  ...props
}: {
  icon: string;
  label: string;
  n: number;
} & ComponentProps<typeof Button>) {
  return (
    <Button
      variant="outline"
      className={cn("relative h-12 flex-col gap-0 text-[11px] card-lift", className)}
      {...props}
    >
      <span className="text-base">{icon}</span>
      {label}
      {n > 0 && (
        <span className="absolute right-1 top-1 flex h-5 min-w-5 items-center justify-center rounded-full bg-primary px-1 text-[10px] font-bold text-primary-foreground">
          {n}
        </span>
      )}
    </Button>
  );
}

function Linea({
  label,
  valor,
  neg,
  pos,
  bold,
}: {
  label: string;
  valor: string;
  neg?: boolean;
  pos?: boolean;
  bold?: boolean;
}) {
  return (
    <div className="flex items-center justify-between">
      <span className={cn("text-muted-foreground", bold && "font-semibold text-foreground")}>
        {label}
      </span>
      <span
        className={cn(
          bold && "font-semibold",
          neg && "text-red-500",
          pos && "text-green-600"
        )}
      >
        {valor}
      </span>
    </div>
  );
}
