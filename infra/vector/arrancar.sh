#!/bin/sh
# Arranque de Vector en Railway (fase 10.1).
#
# Copia las variables del servicio a archivos que solo ve este contenedor
# (permisos 600), para que vector.yaml los lea como SECRET[railway.<NOMBRE>].
# Si falta una, no arranca: un Vector a medias perdería registros en
# silencio, y un fallo de arranque se ve en Railway.
set -eu
umask 077
DIR=/run/vector-secretos
mkdir -p "$DIR"
for nombre in BETTERSTACK_HOST BETTERSTACK_TOKEN R2_ENDPOINT R2_BUCKET R2_LLAVE_ID R2_LLAVE_SECRETA; do
  eval "valor=\${$nombre:-}"
  if [ -z "$valor" ]; then
    echo "Falta la variable $nombre en el servicio de Vector." >&2
    exit 1
  fi
  printf '%s' "$valor" > "$DIR/$nombre"
done
exec vector --config /etc/vector/vector.yaml
