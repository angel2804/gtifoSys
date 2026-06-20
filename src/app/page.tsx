"use client";

import { useEffect, useRef, useState } from "react";
import { useRouter } from "next/navigation";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { toast } from "sonner";
import { ADMIN_PASSWORD, getIsla, turnoLabel } from "@/lib/config";
import { hoy, useStore } from "@/lib/store";
import { ShieldCheck, User, Fuel, ArrowLeft, Lock } from "lucide-react";

type Modo = "inicio" | "admin" | "trabajador";

// Duración de la intro de carga (ms). Solo se muestra una vez por sesión del
// navegador; al volver al login dentro de la misma sesión, aparece directo.
const LOAD_MS = 3200;

// Efecto ripple luminoso al hacer click (se posiciona en el punto del cursor).
function ripple(e: React.PointerEvent<HTMLElement>) {
  const el = e.currentTarget;
  const rect = el.getBoundingClientRect();
  const size = Math.max(rect.width, rect.height);
  const span = document.createElement("span");
  span.className = "gs-ripple";
  span.style.width = span.style.height = `${size}px`;
  span.style.left = `${e.clientX - rect.left - size / 2}px`;
  span.style.top = `${e.clientY - rect.top - size / 2}px`;
  el.appendChild(span);
  span.addEventListener("animationend", () => span.remove());
}

export default function LoginPage() {
  const router = useRouter();
  const loginAdmin = useStore((s) => s.loginAdmin);
  const loginTrabajador = useStore((s) => s.loginTrabajador);
  const setCurrentSesion = useStore((s) => s.setCurrentSesion);
  const sesiones = useStore((s) => s.sesiones);
  const trabajadores = useStore((s) => s.trabajadores);
  const admins = useStore((s) => s.admins);
  const logo = useStore((s) => s.logo);

  const [modo, setModo] = useState<Modo>("inicio");
  const [pass, setPass] = useState("");
  // Admin seleccionado de la lista; "__master__" = entrar con contraseña maestra.
  const [adminSel, setAdminSel] = useState<string | null>(null);
  const [hydrated, setHydrated] = useState(false);

  // Fases de la pantalla: carga inicial → destello → login listo.
  const [fase, setFase] = useState<"loading" | "ready">("loading");
  const [flash, setFlash] = useState(false);
  const timers = useRef<ReturnType<typeof setTimeout>[]>([]);

  useEffect(() => {
    setHydrated(true);
    // La intro completa se ve una sola vez por sesión del navegador.
    const yaVista =
      typeof window !== "undefined" &&
      sessionStorage.getItem("gs-intro-seen") === "1";
    if (yaVista) {
      setFase("ready");
      return;
    }
    const t = timers.current;
    t.push(setTimeout(() => terminarCarga(), LOAD_MS));
    return () => t.forEach(clearTimeout);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  // Pasa de la pantalla de carga al login con un destello + zoom.
  function terminarCarga() {
    timers.current.forEach(clearTimeout);
    timers.current = [];
    if (typeof window !== "undefined")
      sessionStorage.setItem("gs-intro-seen", "1");
    setFlash(true);
    timers.current.push(setTimeout(() => setFase("ready"), 160));
    timers.current.push(setTimeout(() => setFlash(false), 700));
  }

  function entrarAdmin() {
    // La contraseña maestra siempre funciona (respaldo). Si se eligió un admin
    // de la lista, también vale su contraseña propia.
    let ok = pass === ADMIN_PASSWORD;
    if (!ok && adminSel && adminSel !== "__master__") {
      const a = admins.find((x) => x.nombre === adminSel);
      ok = !!a && pass === a.password;
    }
    if (!ok) {
      toast.error("Contraseña incorrecta");
      return;
    }
    loginAdmin();
    router.push("/admin");
  }

  function entrarTrabajador(nombre: string) {
    loginTrabajador(nombre);
    // Si ya tiene un turno activo (no finalizado) entra directo al panel
    const activa = sesiones.find((s) => s.trabajador === nombre && !s.cerrada);
    if (activa) {
      setCurrentSesion(activa.id);
      const isla = getIsla(activa.islaId);
      toast.info(
        `Continuando turno: ${isla?.nombre} · ${turnoLabel(activa.turno)}`
      );
      router.push("/dashboard");
    } else {
      router.push("/setup");
    }
  }

  const logoNode = (
    <div className="flex h-full w-full items-center justify-center overflow-hidden rounded-[inherit] bg-gradient-to-br from-amber-400 to-orange-600">
      {logo ? (
        // eslint-disable-next-line @next/next/no-img-element
        <img src={logo} alt="Logo" className="h-full w-full object-contain" />
      ) : (
        <Fuel className="h-1/2 w-1/2 text-white" strokeWidth={2.2} />
      )}
    </div>
  );

  return (
    <div className="relative min-h-screen overflow-hidden bg-gradient-to-br from-slate-950 via-slate-900 to-slate-800 text-white">
      {/* Efectos de fondo continuos: blobs en deriva + partículas + esquinas */}
      <Fondo />

      {/* Pantalla de carga */}
      {fase === "loading" && (
        <PantallaCarga logoNode={logoNode} onSkip={terminarCarga} />
      )}

      {/* Destello de transición */}
      {flash && (
        <div className="gs-flash pointer-events-none fixed inset-0 z-50" />
      )}

      {/* Login */}
      {fase === "ready" && (
        <div className="animate-zoom-in relative z-10 grid min-h-screen lg:grid-cols-2">
          {/* Panel izquierdo: branding / imagen (oculto en móvil) */}
          <aside className="relative hidden flex-col justify-between overflow-hidden border-r border-white/10 p-10 lg:flex">
            <div className="flex flex-1 flex-col items-center justify-center text-center">
              <div className="relative">
                <span className="absolute inset-0 -z-10 animate-float rounded-[2rem] bg-amber-500/20 blur-2xl" />
                <div className="animate-logo-pop animate-logo-glow animate-float h-32 w-32 rounded-[2rem] ring-1 ring-white/20">
                  {logoNode}
                </div>
              </div>
              <h2 className="mt-8 text-4xl font-bold tracking-tight">
                <LetrasReveladas texto="GrifoSys" delayBase={250} />
              </h2>
              <p
                className="mt-2 max-w-xs text-sm text-slate-400 opacity-0 [animation:gs-fade-up_0.6s_ease-out_1.1s_forwards]"
              >
                Control de estación de servicios en tiempo real. Rápido,
                confiable y profesional.
              </p>
            </div>

            {/* Logo abajo a la izquierda (según el boceto) */}
            <div className="flex items-center gap-3 opacity-0 [animation:gs-fade-up_0.6s_ease-out_1.3s_forwards]">
              <div className="h-9 w-9 overflow-hidden rounded-lg ring-1 ring-white/15">
                {logoNode}
              </div>
              <span className="text-sm font-semibold text-slate-300">
                GrifoSys
              </span>
            </div>
          </aside>

          {/* Panel derecho: login */}
          <main className="relative flex items-center justify-center p-4 sm:p-8">
            <div className="w-full max-w-md">
              {/* Logo compacto solo en móvil */}
              <div className="mb-6 flex flex-col items-center gap-3 text-center lg:hidden">
                <div className="animate-logo-glow animate-float h-16 w-16 overflow-hidden rounded-2xl ring-1 ring-white/20">
                  {logoNode}
                </div>
                <h1 className="text-gradient text-2xl font-extrabold tracking-tight">
                  GrifoSys
                </h1>
              </div>

              <div className="mb-6 opacity-0 [animation:gs-fade-up_0.5s_ease-out_0.2s_forwards]">
                <h2 className="text-3xl font-semibold tracking-tight">Login</h2>
                <p className="mt-1 text-sm text-slate-400">
                  Sistema de estación de servicios
                </p>
              </div>

              {/* Tarjeta con borde iluminado */}
              <div className="gs-glow-border rounded-2xl border border-white/10 bg-white/5 p-6 opacity-0 shadow-2xl backdrop-blur-xl [animation:gs-fade-up_0.6s_ease-out_0.35s_forwards]">
                {modo === "inicio" && (
                  <div className="grid gap-3">
                    <p className="mb-1 text-center text-sm text-slate-300">
                      ¿Cómo deseas ingresar?
                    </p>
                    <button
                      onPointerDown={ripple}
                      onClick={() => setModo("admin")}
                      className="gs-ripple-host animate-slide-in-left group flex items-center gap-4 rounded-xl border border-white/10 bg-white/5 p-4 text-left transition-all duration-200 hover:scale-[1.03] hover:border-amber-400/50 hover:bg-white/10 hover:shadow-[0_8px_30px_-12px_rgba(245,158,11,0.5)] active:scale-[0.97]"
                    >
                      <span className="flex h-12 w-12 items-center justify-center rounded-lg bg-amber-500/20 text-amber-400 transition-colors group-hover:bg-amber-500/30">
                        <ShieldCheck className="h-6 w-6" />
                      </span>
                      <span>
                        <span className="block font-semibold text-white">
                          Administrador
                        </span>
                        <span className="block text-xs text-slate-400">
                          Acceso con contraseña
                        </span>
                      </span>
                    </button>

                    <button
                      onPointerDown={ripple}
                      onClick={() => setModo("trabajador")}
                      className="gs-ripple-host animate-slide-in-right group flex items-center gap-4 rounded-xl border border-white/10 bg-white/5 p-4 text-left transition-all duration-200 hover:scale-[1.03] hover:border-sky-400/50 hover:bg-white/10 hover:shadow-[0_8px_30px_-12px_rgba(56,189,248,0.5)] active:scale-[0.97]"
                    >
                      <span className="flex h-12 w-12 items-center justify-center rounded-lg bg-sky-500/20 text-sky-400 transition-colors group-hover:bg-sky-500/30">
                        <User className="h-6 w-6" />
                      </span>
                      <span>
                        <span className="block font-semibold text-white">
                          Trabajador
                        </span>
                        <span className="block text-xs text-slate-400">
                          Selecciona tu nombre
                        </span>
                      </span>
                    </button>
                  </div>
                )}

                {modo === "admin" && (
                  <div className="space-y-4 animate-in fade-in slide-in-from-right-4 duration-300">
                    <BackBtn
                      onClick={() => {
                        if (adminSel) {
                          setAdminSel(null);
                          setPass("");
                        } else {
                          setModo("inicio");
                        }
                      }}
                    />

                    {admins.length > 0 && !adminSel ? (
                      // Paso 1: elegir administrador de la lista
                      <div className="space-y-3">
                        <label className="text-sm font-medium text-slate-200">
                          Selecciona tu usuario
                        </label>
                        <div className="grid gap-2">
                          {admins.map((a) => (
                            <button
                              key={a.id}
                              onPointerDown={ripple}
                              onClick={() => {
                                setAdminSel(a.nombre);
                                setPass("");
                              }}
                              className="gs-ripple-host group flex items-center gap-3 rounded-xl border border-white/10 bg-white/5 p-3 text-left transition-all duration-200 hover:scale-[1.03] hover:border-amber-400/50 hover:bg-white/10 active:scale-[0.97]"
                            >
                              <span className="flex h-10 w-10 items-center justify-center rounded-full bg-gradient-to-br from-amber-500 to-orange-600 font-bold text-white">
                                {a.nombre[0]?.toUpperCase()}
                              </span>
                              <span className="font-medium text-white">
                                {a.nombre}
                              </span>
                            </button>
                          ))}
                        </div>
                        <button
                          onClick={() => {
                            setAdminSel("__master__");
                            setPass("");
                          }}
                          className="text-xs text-slate-400 underline-offset-2 transition-colors hover:text-white hover:underline"
                        >
                          Usar contraseña maestra
                        </button>
                      </div>
                    ) : (
                      // Paso 2: contraseña (de un admin o la maestra)
                      <>
                        <div className="space-y-2">
                          <label className="text-sm font-medium text-slate-200">
                            {adminSel && adminSel !== "__master__"
                              ? `Contraseña de ${adminSel}`
                              : "Contraseña de administrador"}
                          </label>
                          <div className="relative">
                            <Lock className="absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-slate-500" />
                            <Input
                              type="password"
                              value={pass}
                              autoFocus
                              onChange={(e) => setPass(e.target.value)}
                              onKeyDown={(e) =>
                                e.key === "Enter" && entrarAdmin()
                              }
                              placeholder="••••••••"
                              className="border-white/10 bg-white/5 pl-9 text-white placeholder:text-slate-500"
                            />
                          </div>
                        </div>
                        <Button
                          onPointerDown={ripple}
                          className="gs-ripple-host h-11 w-full bg-gradient-to-r from-amber-500 to-orange-600 font-semibold text-white transition-all duration-200 hover:from-amber-400 hover:to-orange-500 hover:shadow-[0_8px_30px_-10px_rgba(245,158,11,0.6)] active:scale-[0.97]"
                          onClick={entrarAdmin}
                        >
                          Entrar
                        </Button>
                      </>
                    )}
                  </div>
                )}

                {modo === "trabajador" && (
                  <div className="space-y-4 animate-in fade-in slide-in-from-right-4 duration-300">
                    <BackBtn onClick={() => setModo("inicio")} />
                    <label className="text-sm font-medium text-slate-200">
                      Selecciona tu nombre
                    </label>
                    <div className="grid gap-2">
                      {trabajadores.map((nombre, i) => {
                        const activa =
                          hydrated &&
                          sesiones.find(
                            (s) => s.trabajador === nombre && !s.cerrada
                          );
                        return (
                          <button
                            key={nombre}
                            onPointerDown={ripple}
                            onClick={() => entrarTrabajador(nombre)}
                            style={{ animationDelay: `${i * 60}ms` }}
                            className="gs-ripple-host group flex animate-in fade-in items-center justify-between gap-3 rounded-xl border border-white/10 bg-white/5 p-3 text-left transition-all duration-200 hover:scale-[1.03] hover:border-sky-400/50 hover:bg-white/10 active:scale-[0.97]"
                          >
                            <span className="flex items-center gap-3">
                              <span className="flex h-10 w-10 items-center justify-center rounded-full bg-gradient-to-br from-sky-500 to-indigo-600 font-bold text-white">
                                {nombre[0]}
                              </span>
                              <span className="font-medium text-white">
                                {nombre}
                              </span>
                            </span>
                            {activa && (
                              <span className="rounded-full bg-emerald-500/20 px-2 py-0.5 text-[11px] font-semibold text-emerald-300">
                                Turno activo
                              </span>
                            )}
                          </button>
                        );
                      })}
                    </div>
                  </div>
                )}
              </div>

              <p className="mt-6 text-center text-xs text-slate-500">
                {hoy()} · GrifoSys
              </p>
            </div>
          </main>
        </div>
      )}
    </div>
  );
}

// --- Pantalla de carga inicial ---------------------------------------------
function PantallaCarga({
  logoNode,
  onSkip,
}: {
  logoNode: React.ReactNode;
  onSkip: () => void;
}) {
  return (
    <div
      onClick={onSkip}
      className="fixed inset-0 z-40 flex cursor-pointer flex-col items-center justify-center backdrop-blur-xl"
    >
      <div className="relative">
        <span className="absolute inset-0 -z-10 animate-float rounded-[2rem] bg-amber-500/20 blur-2xl" />
        <div className="animate-logo-pop animate-logo-glow h-28 w-28 rounded-[2rem] ring-1 ring-white/20">
          {logoNode}
        </div>
      </div>

      <h1 className="text-gradient mt-7 text-3xl font-bold tracking-tight">
        GrifoSys
      </h1>

      {/* Barra de carga elegante */}
      <div className="relative mt-6 h-1.5 w-56 overflow-hidden rounded-full bg-white/10">
        <div className="gs-progress-fill h-full rounded-full bg-gradient-to-r from-amber-400 to-orange-500" />
        <div className="gs-progress-shine absolute inset-y-0 w-1/3" />
      </div>

      <p className="mt-4 text-sm text-slate-400">
        Iniciando sistema
        <span className="gs-dot ml-0.5">.</span>
        <span className="gs-dot" style={{ animationDelay: "0.2s" }}>
          .
        </span>
        <span className="gs-dot" style={{ animationDelay: "0.4s" }}>
          .
        </span>
      </p>
    </div>
  );
}

// --- Fondo decorativo continuo ---------------------------------------------
function Fondo() {
  // Las partículas usan Math.random(), que daría valores distintos en el
  // servidor (SSR) y en el cliente y rompería la hidratación. Por eso se
  // generan SOLO en el cliente, después del montaje.
  const [particulas, setParticulas] = useState<
    { left: number; bottom: number; size: number; dur: number; delay: number; op: number }[]
  >([]);
  useEffect(() => {
    setParticulas(
      Array.from({ length: 18 }, () => ({
        left: Math.random() * 100,
        bottom: -10 - Math.random() * 10,
        size: 3 + Math.random() * 7,
        dur: 9 + Math.random() * 10,
        delay: Math.random() * 8,
        op: 0.25 + Math.random() * 0.4,
      }))
    );
  }, []);
  return (
    <div className="pointer-events-none absolute inset-0 overflow-hidden">
      <div className="animate-drift absolute -left-32 -top-32 h-96 w-96 rounded-full bg-amber-500/20 blur-3xl" />
      <div
        className="animate-drift absolute -bottom-40 -right-32 h-96 w-96 rounded-full bg-orange-600/20 blur-3xl"
        style={{ animationDelay: "4s" }}
      />
      <div
        className="animate-drift absolute -bottom-32 left-1/3 h-72 w-72 rounded-full bg-emerald-500/10 blur-3xl"
        style={{ animationDelay: "8s" }}
      />
      {particulas.map((p, i) => (
        <span
          key={i}
          className="gs-particle"
          style={
            {
              left: `${p.left}%`,
              bottom: `${p.bottom}%`,
              width: `${p.size}px`,
              height: `${p.size}px`,
              animationDuration: `${p.dur}s`,
              animationDelay: `${p.delay}s`,
              "--p-op": p.op,
            } as React.CSSProperties
          }
        />
      ))}
    </div>
  );
}

// --- Título que aparece letra por letra ------------------------------------
function LetrasReveladas({
  texto,
  delayBase = 0,
}: {
  texto: string;
  delayBase?: number;
}) {
  return (
    <span className="text-gradient">
      {texto.split("").map((c, i) => (
        <span
          key={i}
          className="gs-letter"
          style={{ animationDelay: `${delayBase + i * 70}ms` }}
        >
          {c}
        </span>
      ))}
    </span>
  );
}

function BackBtn({ onClick }: { onClick: () => void }) {
  return (
    <button
      onClick={onClick}
      className="flex items-center gap-1 text-sm text-slate-400 transition-colors hover:text-white"
    >
      <ArrowLeft className="h-4 w-4" /> Volver
    </button>
  );
}
