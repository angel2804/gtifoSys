"use client";

import { useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { toast } from "sonner";
import { ADMIN_PASSWORD, getIsla, turnoLabel } from "@/lib/config";
import { hoy, useStore } from "@/lib/store";
import { ShieldCheck, User, Fuel, ArrowLeft, Lock } from "lucide-react";

type Modo = "inicio" | "admin" | "trabajador";

export default function LoginPage() {
  const router = useRouter();
  const loginAdmin = useStore((s) => s.loginAdmin);
  const loginTrabajador = useStore((s) => s.loginTrabajador);
  const setCurrentSesion = useStore((s) => s.setCurrentSesion);
  const sesiones = useStore((s) => s.sesiones);
  const trabajadores = useStore((s) => s.trabajadores);

  const [modo, setModo] = useState<Modo>("inicio");
  const [pass, setPass] = useState("");
  const [hydrated, setHydrated] = useState(false);
  useEffect(() => setHydrated(true), []);

  function entrarAdmin() {
    if (pass !== ADMIN_PASSWORD) {
      toast.error("Contraseña incorrecta");
      return;
    }
    loginAdmin();
    router.push("/admin");
  }

  function entrarTrabajador(nombre: string) {
    loginTrabajador(nombre);
    // Si ya tiene un turno activo (no finalizado) entra directo al panel
    const activa = sesiones.find(
      (s) => s.trabajador === nombre && !s.cerrada
    );
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

  return (
    <div className="relative flex min-h-screen flex-1 items-center justify-center overflow-hidden bg-gradient-to-br from-slate-950 via-slate-900 to-slate-800 p-4">
      {/* Decoración de fondo */}
      <div className="pointer-events-none absolute -left-32 -top-32 h-96 w-96 rounded-full bg-amber-500/20 blur-3xl" />
      <div className="pointer-events-none absolute -bottom-40 -right-32 h-96 w-96 rounded-full bg-orange-600/20 blur-3xl" />

      <div className="w-full max-w-md animate-in fade-in slide-in-from-bottom-6 duration-500">
        {/* Logo */}
        <div className="mb-6 flex flex-col items-center gap-3 text-center">
          <div className="flex h-20 w-20 animate-float items-center justify-center rounded-2xl bg-gradient-to-br from-amber-400 to-orange-600 shadow-lg shadow-orange-900/40 ring-1 ring-white/20">
            <Fuel className="h-10 w-10 text-white" strokeWidth={2.2} />
          </div>
          <div>
            <h1 className="text-gradient text-3xl font-extrabold tracking-tight">
              GrifoSys
            </h1>
            <p className="text-sm text-slate-400">
              Sistema de estación de servicios
            </p>
          </div>
        </div>

        {/* Tarjeta */}
        <div className="rounded-2xl border border-white/10 bg-white/5 p-6 shadow-2xl backdrop-blur-xl">
          {modo === "inicio" && (
            <div className="grid gap-3 animate-in fade-in duration-300">
              <p className="mb-1 text-center text-sm text-slate-300">
                ¿Cómo deseas ingresar?
              </p>
              <button
                onClick={() => setModo("admin")}
                className="group flex items-center gap-4 rounded-xl border border-white/10 bg-white/5 p-4 text-left transition-all hover:scale-[1.02] hover:border-amber-400/50 hover:bg-white/10 active:scale-100"
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
                onClick={() => setModo("trabajador")}
                className="group flex items-center gap-4 rounded-xl border border-white/10 bg-white/5 p-4 text-left transition-all hover:scale-[1.02] hover:border-sky-400/50 hover:bg-white/10 active:scale-100"
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
              <BackBtn onClick={() => setModo("inicio")} />
              <div className="space-y-2">
                <label className="text-sm font-medium text-slate-200">
                  Contraseña de administrador
                </label>
                <div className="relative">
                  <Lock className="absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-slate-500" />
                  <Input
                    type="password"
                    value={pass}
                    autoFocus
                    onChange={(e) => setPass(e.target.value)}
                    onKeyDown={(e) => e.key === "Enter" && entrarAdmin()}
                    placeholder="••••••••"
                    className="border-white/10 bg-white/5 pl-9 text-white placeholder:text-slate-500"
                  />
                </div>
              </div>
              <Button
                className="h-11 w-full bg-gradient-to-r from-amber-500 to-orange-600 font-semibold text-white hover:from-amber-400 hover:to-orange-500"
                onClick={entrarAdmin}
              >
                Entrar
              </Button>
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
                    sesiones.find((s) => s.trabajador === nombre && !s.cerrada);
                  return (
                    <button
                      key={nombre}
                      onClick={() => entrarTrabajador(nombre)}
                      style={{ animationDelay: `${i * 60}ms` }}
                      className="group flex animate-in fade-in items-center justify-between gap-3 rounded-xl border border-white/10 bg-white/5 p-3 text-left transition-all hover:scale-[1.02] hover:border-sky-400/50 hover:bg-white/10"
                    >
                      <span className="flex items-center gap-3">
                        <span className="flex h-10 w-10 items-center justify-center rounded-full bg-gradient-to-br from-sky-500 to-indigo-600 font-bold text-white">
                          {nombre[0]}
                        </span>
                        <span className="font-medium text-white">{nombre}</span>
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
    </div>
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
