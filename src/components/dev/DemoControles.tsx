"use client";

import { useState } from "react";
import { Button } from "@/components/ui/button";
import {
  Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle, DialogTrigger, DialogClose,
} from "@/components/ui/dialog";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { cn } from "@/lib/utils";

const CATEGORIAS = { todas: "Todas las categorías", estructuras: "Estructuras", bim: "BIM" };
const ESTADOS = ["Todos", "En progreso", "Completados"];

export function DemoSelector() {
  const [estado, setEstado] = useState("Todos");
  return (
    <div className="flex max-w-3xl flex-col gap-6">
      <div className="flex flex-col items-start gap-1.5">
        <span id="sel-etiqueta" className="text-uva-detalle font-medium">Categoría</span>
        <Select items={CATEGORIAS} defaultValue="todas">
          <SelectTrigger aria-labelledby="sel-etiqueta" className="w-60">
            <SelectValue />
          </SelectTrigger>
          <SelectContent>
            {Object.entries(CATEGORIAS).map(([valor, etiqueta]) => (
              <SelectItem key={valor} value={valor}>{etiqueta}</SelectItem>
            ))}
          </SelectContent>
        </Select>
      </div>

      <ul aria-label="Filtrar por estado" className="flex flex-wrap gap-2">
        {ESTADOS.map((e) => {
          const presionado = e === estado;
          return (
            <li key={e}>
              <button
                type="button"
                aria-pressed={presionado}
                onClick={() => setEstado(e)}
                className={cn(
                  "inline-flex min-h-11 items-center rounded-full border-[1.5px] px-4 text-uva-detalle focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-uva-accent",
                  presionado
                    ? "border-uva-text bg-uva-text font-bold text-uva-bg"
                    : "border-uva-line-strong font-medium text-uva-text hover:border-uva-text",
                )}
              >
                {e}
              </button>
            </li>
          );
        })}
      </ul>

      <Tabs defaultValue="uno">
        <TabsList>
          <TabsTrigger value="uno">Contenido</TabsTrigger>
          <TabsTrigger value="dos">Estudiantes</TabsTrigger>
          <TabsTrigger value="tres">Examen</TabsTrigger>
        </TabsList>
        <TabsContent value="uno" className="pt-3 text-uva-detalle">Flechas izquierda y derecha cambian de pestaña.</TabsContent>
        <TabsContent value="dos" className="pt-3 text-uva-detalle">Panel de estudiantes.</TabsContent>
        <TabsContent value="tres" className="pt-3 text-uva-detalle">Panel de examen.</TabsContent>
      </Tabs>
    </div>
  );
}

export function DemoDialogo() {
  return (
    <Dialog>
      <DialogTrigger render={<Button variant="default" />}>Abrir diálogo</DialogTrigger>
      <DialogContent>
        <DialogHeader>
          <DialogTitle>¿Salir sin guardar?</DialogTitle>
          <DialogDescription>Perderás los cambios de esta clase. Esc, la X o Cancelar cierran el diálogo.</DialogDescription>
        </DialogHeader>
        <DialogFooter>
          <DialogClose render={<Button variant="default" />}>Cancelar</DialogClose>
          <DialogClose render={<Button variant="primary" />}>Salir</DialogClose>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
