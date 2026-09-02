import { expect, test } from "@playwright/test";
import {
  adminClient,
  borrarUsuarioPorEmail,
  crearUsuarioConfirmado,
  promoverAAdministrador,
  promoverAProfesor,
} from "./supabase-admin";

// P2-7 Fase B (AUDIT-2026-08-24.md), recorrido 2 de 3: admin crea y
// publica un curso. El admin, la categoría y el instructor son
// desechables — no depende de que exista seed data previa en la base.
// La portada se omite a propósito: crearCurso() usa un placeholder
// cuando no se sube archivo (src/actions/admin/cursos.ts), así que
// probar la subida a Storage es un caso aparte, no parte de este
// recorrido.

const admin = adminClient();
const sufijo = Date.now();
const emailAdmin = `e2e-admin-${sufijo}@uva.test`;
const passwordAdmin = "Abcdefg1!x";
const tituloCurso = `Curso E2E ${sufijo}`;
const nombreCategoria = `Categoría E2E ${sufijo}`;
// El instructor ya no es una ficha de catálogo: desde la migración
// `20260903000000_multi_instructores` es una cuenta real con rol PROFESOR, así
// que el spec crea un usuario desechable más en vez de una fila en
// `instructores` (tabla vestigial que ninguna capa de la app lee ya).
const emailProfesor = `e2e-profesor-${sufijo}@uva.test`;
const passwordProfesor = "Abcdefg1!x";
const nombreProfesor = `Instructor E2E ${sufijo}`;

let categoriaId: string;
let instructorId: string;
let cursoId: string | null = null;

test.beforeAll(async () => {
  const user = await crearUsuarioConfirmado(admin, { email: emailAdmin, password: passwordAdmin });
  await promoverAAdministrador(admin, user.id);

  const { data: categoria, error: errCategoria } = await admin
    .from("categorias")
    .insert({ nombre: nombreCategoria, activo: true })
    .select("id")
    .single();
  if (errCategoria || !categoria) throw new Error(`No pude crear la categoría de prueba: ${errCategoria?.message}`);
  categoriaId = categoria.id;

  const profesor = await crearUsuarioConfirmado(admin, {
    email: emailProfesor,
    password: passwordProfesor,
    nombre: nombreProfesor,
  });
  await promoverAProfesor(admin, profesor.id, "Especialidad E2E");
  instructorId = profesor.id;
});

test.afterAll(async () => {
  // Orden: hijo antes que padre, para no chocar con ninguna FK.
  // Borrar el curso se lleva sus filas de `curso_instructores`
  // (ON DELETE CASCADE), que es lo que deja borrar después al profesor: esa FK
  // es ON DELETE RESTRICT a propósito.
  if (cursoId) await admin.from("cursos").delete().eq("id", cursoId);
  await admin.from("categorias").delete().eq("id", categoriaId);
  await borrarUsuarioPorEmail(admin, emailProfesor);

  const { data } = await admin.auth.admin.listUsers({ perPage: 1000 });
  const user = data?.users.find((u) => u.email === emailAdmin);
  if (!user) return;

  // crearCurso() llama registrarBitacora(), que deja una fila en
  // bitacora_administrativa con id_admin = este usuario. Esa FK no tiene
  // ON DELETE CASCADE (bitacora_administrativa es append-only a
  // propósito, ver prisma/schema.prisma) — sin borrar esto primero,
  // deleteUser() falla en silencio porque el cascade de auth.users hacia
  // perfiles choca contra ella.
  await admin.from("bitacora_administrativa").delete().eq("id_admin", user.id);

  const { error: errDeleteUser } = await admin.auth.admin.deleteUser(user.id); // cascada a perfiles (010)
  if (errDeleteUser) {
    console.error(`No pude borrar el usuario de prueba ${emailAdmin}: ${errDeleteUser.message}`);
  }
});

test("admin crea y publica un curso", async ({ page }) => {
  await test.step("inicia sesión como el admin de prueba, directo al formulario de curso nuevo", async () => {
    await page.goto(`/login?redirect=${encodeURIComponent("/admin/cursos/nuevo")}`);
    await page.fill("#auth-email", emailAdmin);
    await page.getByRole("button", { name: "Continuar", exact: true }).click();
    await expect(page.locator("#login-pass")).toBeVisible();
    await page.fill("#login-pass", passwordAdmin);
    await page.getByRole("button", { name: "Entrar" }).click();
    await expect(page).toHaveURL(/\/admin\/cursos\/nuevo/, { timeout: 30_000 });
  });

  await test.step("llena el formulario y publica", async () => {
    await page.fill("#curso-titulo", tituloCurso);
    await page.fill("#curso-descripcion", "Curso creado por el spec E2E de P2-7.");

    await page.locator("#curso-categoria").click();
    await page.getByRole("option", { name: nombreCategoria }).click();

    // Checkbox, no Select: el selector de instructores es múltiple desde que
    // un curso puede tener más de uno.
    await page.locator(`#curso-instructores-${instructorId}`).click();

    await page.getByRole("button", { name: "Publicar curso" }).click();
    await expect(page).toHaveURL(/\/admin\/cursos\/[0-9a-f-]{36}/, { timeout: 30_000 });
    cursoId = page.url().split("/admin/cursos/")[1];
  });

  await test.step("el curso quedó publicado (mostrado = true) en la base real", async () => {
    const { data: curso, error } = await admin
      .from("cursos")
      .select("titulo, mostrado")
      .eq("id", cursoId)
      .single();
    expect(error).toBeNull();
    expect(curso?.titulo).toBe(tituloCurso);
    expect(curso?.mostrado).toBe(true);

    // El instructor vive en la puente, no en `cursos.id_instructor` (columna
    // vestigial que crearCurso() ya no escribe).
    const { data: puente, error: errorPuente } = await admin
      .from("curso_instructores")
      .select("id_instructor")
      .eq("id_curso", cursoId);
    expect(errorPuente).toBeNull();
    expect(puente?.map((fila) => fila.id_instructor)).toEqual([instructorId]);
  });
});
