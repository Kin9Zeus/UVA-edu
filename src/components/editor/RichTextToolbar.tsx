"use client";

import { useState, type ComponentType } from "react";
import type { Editor } from "@tiptap/react";
import { useEditorState } from "@tiptap/react";
import {
  Undo2,
  Redo2,
  Bold,
  Italic,
  Underline,
  Strikethrough,
  Code,
  Heading1,
  Heading2,
  Heading3,
  Pilcrow,
  List,
  ListOrdered,
  ListChecks,
  Quote,
  SquareCode,
  Minus,
  Link2,
  Link2Off,
  ChevronDown,
} from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import {
  Dialog,
  DialogContent,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import { esUrlSegura } from "@/lib/editor/seguridad";

function BotonToolbar({
  icono: Icono,
  etiqueta,
  activo,
  disabled,
  onClick,
}: {
  icono: ComponentType<{ className?: string; strokeWidth?: number }>;
  etiqueta: string;
  activo?: boolean;
  disabled?: boolean;
  onClick: () => void;
}) {
  return (
    <button
      type="button"
      title={etiqueta}
      aria-label={etiqueta}
      aria-pressed={activo}
      disabled={disabled}
      onMouseDown={(event) => event.preventDefault()}
      onClick={onClick}
      className={`grid size-7 shrink-0 cursor-pointer place-items-center rounded-uva-xs border-0 disabled:cursor-not-allowed disabled:opacity-40 ${
        activo
          ? "bg-uva-accent text-white"
          : "bg-transparent text-uva-muted hover:bg-[#27272A] hover:text-uva-text"
      }`}
    >
      <Icono className="size-[15px]" strokeWidth={2.2} />
    </button>
  );
}

/**
 * Toolbar del editor de contenido enriquecido. Solo expone lo que
 * RichTextEditor/RichTextRenderer efectivamente soportan (ver
 * `src/lib/editor/tipos.ts`) — nada de botones "para más adelante" que no
 * hacen nada todavía (tablas, imágenes, callouts y fórmulas quedan para una
 * siguiente iteración, ver la conversación de planeación).
 */
export function RichTextToolbar({ editor }: { editor: Editor }) {
  const [linkAbierto, setLinkAbierto] = useState(false);
  const [linkUrl, setLinkUrl] = useState("");
  const [linkError, setLinkError] = useState<string | null>(null);

  const estado = useEditorState({
    editor,
    selector: ({ editor }) => ({
      bold: editor.isActive("bold"),
      italic: editor.isActive("italic"),
      underline: editor.isActive("underline"),
      strike: editor.isActive("strike"),
      code: editor.isActive("code"),
      parrafo: editor.isActive("paragraph"),
      h1: editor.isActive("heading", { level: 1 }),
      h2: editor.isActive("heading", { level: 2 }),
      h3: editor.isActive("heading", { level: 3 }),
      bulletList: editor.isActive("bulletList"),
      orderedList: editor.isActive("orderedList"),
      taskList: editor.isActive("taskList"),
      blockquote: editor.isActive("blockquote"),
      codeBlock: editor.isActive("codeBlock"),
      link: editor.isActive("link"),
      canUndo: editor.can().undo(),
      canRedo: editor.can().redo(),
    }),
  });

  const tituloBloque = estado.h1
    ? "Título 1"
    : estado.h2
      ? "Título 2"
      : estado.h3
        ? "Título 3"
        : "Párrafo";

  function abrirDialogoLink() {
    const href = (editor.getAttributes("link").href as string | undefined) ?? "";
    setLinkUrl(href);
    setLinkError(null);
    setLinkAbierto(true);
  }

  function confirmarLink() {
    const href = linkUrl.trim();
    if (!href) {
      editor.chain().focus().extendMarkRange("link").unsetLink().run();
      setLinkAbierto(false);
      return;
    }
    if (!esUrlSegura(href)) {
      setLinkError("Ese enlace no es válido. Usa http(s):// o mailto:.");
      return;
    }
    editor.chain().focus().extendMarkRange("link").setLink({ href }).run();
    setLinkAbierto(false);
  }

  return (
    <>
      <div className="flex flex-wrap items-center gap-0.5 border-b border-uva-divider bg-uva-surface px-2 py-1.5">
        <BotonToolbar
          icono={Undo2}
          etiqueta="Deshacer"
          disabled={!estado.canUndo}
          onClick={() => editor.chain().focus().undo().run()}
        />
        <BotonToolbar
          icono={Redo2}
          etiqueta="Rehacer"
          disabled={!estado.canRedo}
          onClick={() => editor.chain().focus().redo().run()}
        />

        <span className="mx-1 h-5 w-px shrink-0 bg-uva-divider" aria-hidden="true" />

        <DropdownMenu>
          <DropdownMenuTrigger className="mr-0.5 inline-flex h-7 shrink-0 items-center gap-1 rounded-uva-xs px-2 text-xs font-medium text-uva-muted hover:bg-[#27272A] hover:text-uva-text aria-expanded:bg-[#27272A] aria-expanded:text-uva-text">
            {tituloBloque}
            <ChevronDown className="size-3.5" strokeWidth={2.2} />
          </DropdownMenuTrigger>
          <DropdownMenuContent align="start" className="min-w-36">
            <DropdownMenuItem onClick={() => editor.chain().focus().setParagraph().run()}>
              <Pilcrow className="size-4" /> Párrafo
            </DropdownMenuItem>
            <DropdownMenuItem
              onClick={() => editor.chain().focus().toggleHeading({ level: 1 }).run()}
            >
              <Heading1 className="size-4" /> Título 1
            </DropdownMenuItem>
            <DropdownMenuItem
              onClick={() => editor.chain().focus().toggleHeading({ level: 2 }).run()}
            >
              <Heading2 className="size-4" /> Título 2
            </DropdownMenuItem>
            <DropdownMenuItem
              onClick={() => editor.chain().focus().toggleHeading({ level: 3 }).run()}
            >
              <Heading3 className="size-4" /> Título 3
            </DropdownMenuItem>
          </DropdownMenuContent>
        </DropdownMenu>

        <span className="mx-1 h-5 w-px shrink-0 bg-uva-divider" aria-hidden="true" />

        <BotonToolbar
          icono={Bold}
          etiqueta="Negrita"
          activo={estado.bold}
          onClick={() => editor.chain().focus().toggleBold().run()}
        />
        <BotonToolbar
          icono={Italic}
          etiqueta="Cursiva"
          activo={estado.italic}
          onClick={() => editor.chain().focus().toggleItalic().run()}
        />
        <BotonToolbar
          icono={Underline}
          etiqueta="Subrayado"
          activo={estado.underline}
          onClick={() => editor.chain().focus().toggleUnderline().run()}
        />
        <BotonToolbar
          icono={Strikethrough}
          etiqueta="Tachado"
          activo={estado.strike}
          onClick={() => editor.chain().focus().toggleStrike().run()}
        />
        <BotonToolbar
          icono={Code}
          etiqueta="Código en línea"
          activo={estado.code}
          onClick={() => editor.chain().focus().toggleCode().run()}
        />

        <span className="mx-1 h-5 w-px shrink-0 bg-uva-divider" aria-hidden="true" />

        <BotonToolbar
          icono={List}
          etiqueta="Lista con viñetas"
          activo={estado.bulletList}
          onClick={() => editor.chain().focus().toggleBulletList().run()}
        />
        <BotonToolbar
          icono={ListOrdered}
          etiqueta="Lista numerada"
          activo={estado.orderedList}
          onClick={() => editor.chain().focus().toggleOrderedList().run()}
        />
        <BotonToolbar
          icono={ListChecks}
          etiqueta="Lista de tareas"
          activo={estado.taskList}
          onClick={() => editor.chain().focus().toggleTaskList().run()}
        />

        <span className="mx-1 h-5 w-px shrink-0 bg-uva-divider" aria-hidden="true" />

        <BotonToolbar
          icono={Quote}
          etiqueta="Cita"
          activo={estado.blockquote}
          onClick={() => editor.chain().focus().toggleBlockquote().run()}
        />
        <BotonToolbar
          icono={SquareCode}
          etiqueta="Bloque de código"
          activo={estado.codeBlock}
          onClick={() => editor.chain().focus().toggleCodeBlock().run()}
        />
        <BotonToolbar
          icono={Minus}
          etiqueta="Separador"
          onClick={() => editor.chain().focus().setHorizontalRule().run()}
        />
        <BotonToolbar
          icono={estado.link ? Link2Off : Link2}
          etiqueta={estado.link ? "Quitar enlace" : "Insertar enlace"}
          activo={estado.link}
          onClick={() => (estado.link ? editor.chain().focus().unsetLink().run() : abrirDialogoLink())}
        />
      </div>

      <Dialog open={linkAbierto} onOpenChange={setLinkAbierto}>
        <DialogContent className="w-[380px]">
          <DialogHeader>
            <DialogTitle>Insertar enlace</DialogTitle>
          </DialogHeader>
          <div>
            <Label htmlFor="editor-link-url">URL</Label>
            <Input
              id="editor-link-url"
              autoFocus
              placeholder="https://…"
              value={linkUrl}
              onChange={(event) => {
                setLinkUrl(event.target.value);
                setLinkError(null);
              }}
              onKeyDown={(event) => {
                if (event.key === "Enter") {
                  event.preventDefault();
                  confirmarLink();
                }
              }}
            />
            {linkError && <p className="mt-1.5 text-xs text-uva-error-text">{linkError}</p>}
          </div>
          <DialogFooter>
            <Button type="button" variant="outline" onClick={() => setLinkAbierto(false)}>
              Cancelar
            </Button>
            <Button type="button" variant="primary" onClick={confirmarLink}>
              Guardar enlace
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </>
  );
}
