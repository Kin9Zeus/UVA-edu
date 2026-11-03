// En Vitest no hay componentes de cliente: `server-only` solo tiene sentido
// dentro del build de Next. Fuera de él lanza un error a propósito, así que
// las pruebas lo cambian por este módulo vacío (alias en vitest.config.ts).
export {};
