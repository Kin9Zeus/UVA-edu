import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  experimental: {
    serverActions: {
      // Server Action de subida de material adicional (subirRecursoLeccion,
      // src/actions/admin/cursos.ts) valida hasta 50 MB de archivo (el
      // máximo que acepta Supabase Storage); el límite por defecto de Next
      // es 1 MB. Se deja margen extra para el overhead de
      // multipart/form-data (boundaries, headers de cada parte).
      bodySizeLimit: "52mb",
    },
  },
};

export default nextConfig;
