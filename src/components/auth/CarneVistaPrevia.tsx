import Link from "next/link";
import { LogoUva } from "@/components/home/LogoUva";
import { passwordRules } from "@/lib/password";
import { cn } from "@/lib/utils";

/** Lo que el formulario de registro le pasa al carné mientras se escribe. */
export interface DatosCarne {
  nombre: string;
  correo: string;
  password: string;
}

/**
 * Carné de estudiante del registro y de la confirmación de correo (Crear
 * cuenta lab 6, "Carné"). Dos dibujos del mismo dato: en celular, una ficha
 * compacta con el logo; desde 900 px, el carné grande colgado de su cinta.
 *
 * `nombre` y `password` en `null` = no se conocen (al abrir el enlace del
 * correo la app solo sabe el correo): esas filas no se dibujan, en vez de
 * mostrar un "Tu nombre aquí" que parecería roto. Los segmentos de seguridad
 * usan las mismas reglas que la lista del formulario (src/lib/password.ts).
 */
export function CarneVistaPrevia({
  nombre,
  correo,
  password,
  sello,
}: {
  nombre: string | null;
  correo: string;
  password: string | null;
  sello: "pendiente" | "confirmado" | null;
}) {
  const limpio = (nombre ?? "").replace(/\s+/g, " ").trim();
  const iniciales = limpio
    .split(" ")
    .slice(0, 2)
    .map((parte) => parte[0]?.toUpperCase() ?? "")
    .join("");
  const conNombre = nombre !== null;
  // Sin correo: el ejemplo solo mientras se llenan los datos; al abrir un
  // enlace que no lo traía, "Tu correo" (no un correo inventado como dato).
  const correoConocido = correo.trim();
  const correoVisible = correoConocido ? (
    <CorreoPartible correo={correoConocido} />
  ) : conNombre ? (
    "tu.correo@ejemplo.com"
  ) : (
    "Tu correo"
  );
  const reglas = password === null ? null : passwordRules.map((regla) => regla.test(password));

  return (
    <>
      {/* Celular */}
      <section
        aria-label="Vista previa de tu carné"
        className="relative mx-auto grid max-w-[410px] grid-cols-[auto_minmax(0,1fr)] items-center gap-x-3.5 gap-y-2 rounded-uva-lg border-[1.5px] border-uva-muted-2 bg-uva-surface px-3.5 py-2.5 min-[900px]:hidden"
      >
        <div className="col-span-2 flex items-center justify-between gap-3 text-uva-detalle font-semibold text-uva-text-muted">
          <Link
            href="/"
            aria-label="U.V.A., ir al inicio"
            className="inline-flex min-h-11 items-center text-uva-text hover:text-uva-text"
          >
            <LogoUva className="h-[31px] w-24" />
          </Link>
          <span>Carné de estudiante</span>
        </div>
        <div
          aria-hidden="true"
          className="grid size-[52px] place-items-center rounded-uva-md bg-uva-accent-2 font-heading text-uva-titulo-4 font-extrabold text-uva-on-bright"
        >
          {iniciales || <IconoPersona className="size-7" />}
        </div>
        <div className="grid min-w-0">
          {conNombre ? (
            <>
              <b
                className={cn(
                  "font-heading text-uva-titulo-4 font-extrabold [overflow-wrap:anywhere]",
                  limpio ? "text-uva-text" : "text-uva-text-muted",
                )}
              >
                {limpio || "Tu nombre"}
              </b>
              <span className="truncate text-uva-detalle text-uva-text-muted">{correoVisible}</span>
            </>
          ) : (
            <b
              className={cn(
                "font-heading text-uva-cuerpo font-extrabold [overflow-wrap:anywhere]",
                correoConocido ? "text-uva-text" : "text-uva-text-muted",
              )}
            >
              {correoVisible}
            </b>
          )}
        </div>
        {/* En la ficha compacta el sello va debajo de los datos, no encima:
            sobre el correo lo tapaba. */}
        {sello && (
          <Sello
            tipo={sello}
            className="static col-span-2 -mt-0.5 justify-self-end -rotate-[3deg] border-[2.5px] px-2 py-0.5 text-uva-detalle leading-tight"
          />
        )}
      </section>

      {/* Escritorio: la cinta y el carné se encogen con la altura de la
          pantalla (`zoom`, no `scale`, para que también ocupen menos alto)
          y crecen en monitores grandes y altos (2560×1440). Es un dibujo de
          tamaño fijo (360×560): sus letras van en px, no en la escala fluida,
          porque una letra que crece con el ancho lo descuadraría; lo que lo
          adapta a la pantalla es el `zoom`. */}
      <div className="hidden flex-col items-center min-[900px]:flex medio:[zoom:0.85] bajo:[zoom:0.78] muy-bajo:[zoom:0.66] [@media(min-width:1920px)_and_(min-height:1100px)]:[zoom:1.3]">
        <svg
          aria-hidden="true"
          viewBox="0 0 160 214"
          className="h-[214px] w-40"
          fill="none"
          strokeLinecap="round"
        >
          <path d="M20 0L76 168M140 0L84 168" strokeWidth="10" className="stroke-uva-accent" />
          <rect
            x="62"
            y="160"
            width="36"
            height="34"
            rx="5"
            strokeWidth="2.5"
            className="fill-uva-surface-2 stroke-uva-text"
          />
          <path d="M80 194V214" strokeWidth="3" className="stroke-uva-text" />
        </svg>

        <section
          aria-label="Vista previa de tu carné"
          className="-mt-0.5 flex h-[560px] w-[360px] origin-top -rotate-[2.5deg] flex-col overflow-hidden rounded-uva-lg border-2 border-uva-text bg-uva-surface"
        >
          <div
            aria-hidden="true"
            className="mt-4 h-3 w-16 self-center rounded-full border-2 border-uva-text bg-uva-bg"
          />
          <div className="flex items-center justify-between px-[26px] pt-5 text-[13px] font-semibold text-uva-text-muted">
            <LogoUva className="h-6 w-[74px] text-uva-text" />
            <span>Carné de estudiante</span>
          </div>

          <div className="flex items-center gap-[18px] px-[26px] pt-[26px]">
            <div
              aria-hidden="true"
              className="grid h-[116px] w-24 flex-none place-items-center rounded-uva-sm border-2 border-uva-text bg-uva-surface-2 font-heading text-[40px] font-extrabold text-uva-text"
            >
              {iniciales || <IconoPersona className="size-11 text-uva-text-muted" />}
            </div>
            <div className="grid min-w-0 gap-1.5">
              {conNombre ? (
                <>
                  <small className="text-xs font-semibold text-uva-text-muted">Nombre</small>
                  <b
                    className={cn(
                      "font-heading text-[26px] leading-7 font-extrabold tracking-[-0.02em] [overflow-wrap:anywhere]",
                      limpio ? "text-uva-text" : "text-uva-text-muted",
                    )}
                  >
                    {limpio || "Tu nombre aquí"}
                  </b>
                </>
              ) : (
                <>
                  <small className="text-xs font-semibold text-uva-text-muted">Correo</small>
                  <b
                    className={cn(
                      "font-heading text-lg leading-6 font-extrabold [overflow-wrap:anywhere]",
                      correoConocido ? "text-uva-text" : "text-uva-text-muted",
                    )}
                  >
                    {correoVisible}
                  </b>
                </>
              )}
            </div>
          </div>

          <dl className="mx-[26px] mt-[22px] grid gap-3">
            {conNombre && (
              <div>
                <dt className="text-xs font-semibold text-uva-text-muted">Correo</dt>
                <dd className="mt-[3px] text-[15px] font-semibold [overflow-wrap:anywhere] text-uva-text">
                  {correoVisible}
                </dd>
              </div>
            )}
            <div>
              <dt className="text-xs font-semibold text-uva-text-muted">Rol</dt>
              <dd className="mt-[3px] text-[15px] font-semibold text-uva-text">
                Estudiante U.V.A.
              </dd>
            </div>
            {reglas && (
              <div>
                <dt className="text-xs font-semibold text-uva-text-muted">
                  Seguridad de la contraseña
                </dt>
                <dd className="mt-1.5 flex gap-1.5">
                  <span className="sr-only">
                    {reglas.filter(Boolean).length} de {reglas.length} reglas cumplidas
                  </span>
                  {reglas.map((cumple, i) => (
                    <i
                      key={passwordRules[i].id}
                      aria-hidden="true"
                      className={cn(
                        "h-2.5 w-[34px] rounded-uva-xs border-[1.5px]",
                        cumple ? "border-uva-text bg-uva-accent-2" : "border-uva-muted-2",
                      )}
                    />
                  ))}
                </dd>
              </div>
            )}
          </dl>

          <div className="relative mt-auto">
            {sello && (
              <Sello
                tipo={sello}
                className="right-[22px] bottom-[54px] -rotate-[8deg] border-[3px] px-3 py-1.5 text-base leading-5"
              />
            )}
            <div className="flex h-10 items-center border-t-2 border-uva-text bg-uva-accent-2 px-[26px] text-sm font-bold text-uva-on-bright">
              Acceso por invitación
            </div>
          </div>
        </section>
      </div>
    </>
  );
}

function Sello({ tipo, className }: { tipo: "pendiente" | "confirmado"; className: string }) {
  return (
    <p
      className={cn(
        "absolute m-0 rounded-uva-sm text-center font-extrabold",
        tipo === "pendiente"
          ? "border-uva-accent bg-uva-surface text-uva-accent-ink"
          : "border-uva-text bg-uva-accent-2 text-uva-on-bright",
        className,
      )}
    >
      {tipo === "pendiente" ? (
        <>
          Pendiente de
          <br />
          confirmar correo
        </>
      ) : (
        <>
          Correo
          <br />
          confirmado
        </>
      )}
    </p>
  );
}

/**
 * Correo con cortes de línea preferidos después de cada punto y antes de la
 * @, para que uno largo no se parta a mitad de palabra
 * ("laura.gomez." / "arquitecta" / "@ejemplo.com").
 */
function CorreoPartible({ correo }: { correo: string }) {
  const arroba = correo.indexOf("@");
  if (arroba <= 0) return <>{correo}</>;
  const partes = correo.slice(0, arroba).split(".");
  return (
    <>
      {partes.map((parte, i) => (
        <span key={i}>
          {parte}
          {i < partes.length - 1 && (
            <>
              .<wbr />
            </>
          )}
        </span>
      ))}
      <wbr />
      {correo.slice(arroba)}
    </>
  );
}

function IconoPersona({ className }: { className: string }) {
  return (
    <svg
      viewBox="0 0 24 24"
      className={className}
      fill="none"
      stroke="currentColor"
      strokeWidth="1.6"
      strokeLinecap="round"
      aria-hidden="true"
    >
      <circle cx="12" cy="8.5" r="4" />
      <path d="M4.5 20.5c1.2-4 4.2-6 7.5-6s6.3 2 7.5 6" />
    </svg>
  );
}
