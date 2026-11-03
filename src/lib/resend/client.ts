// Lee RESEND_API_KEY: importarlo desde un componente de cliente hace fallar el build (fase 7).
import "server-only";
import { Resend } from "resend";

export const resend = new Resend(process.env.RESEND_API_KEY!);
