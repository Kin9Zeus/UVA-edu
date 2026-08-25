import Mux from "@mux/mux-node";

// jwtSigningKey/jwtPrivateKey son el fallback que usa mux.jwt.signPlaybackId()
// cuando la llamada no pasa keyId/keySecret explícitos (ver
// node_modules/@mux/mux-node/lib/jwt.js). Nombrados MUX_SIGNING_KEY_ID /
// MUX_SIGNING_KEY_PRIVATE (no los MUX_SIGNING_KEY / MUX_PRIVATE_KEY que
// asume el SDK por defecto) para que coincidan con README.md y con lo que
// ya pide el equipo al crear el signing key en el dashboard de Mux.
export const mux = new Mux({
  tokenId: process.env.MUX_TOKEN_ID!,
  tokenSecret: process.env.MUX_TOKEN_SECRET!,
  jwtSigningKey: process.env.MUX_SIGNING_KEY_ID,
  jwtPrivateKey: process.env.MUX_SIGNING_KEY_PRIVATE,
});
