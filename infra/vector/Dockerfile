# Servicio de Vector en Railway (fase 10.1). En Railway: servicio nuevo desde
# este repo, "Root Directory" = /infra/vector. Ver docs/ops/registros-externos.md.
#
# Versión y digest fijos: una etiqueta puede apuntar mañana a otra cosa.
#
# Vector 0.45.0 A PROPÓSITO, no la última. Desde 0.46 el destino aws_s3 no
# funciona con Cloudflare R2: el SDK nuevo de AWS manda dos sumas de
# verificación y R2 responde "You can only specify one non-default checksum
# at a time" (https://github.com/vectordotdev/vector/issues/23029, abierto;
# probado en Railway con 0.61.0 el 2026-11-06, y las variables
# AWS_REQUEST_CHECKSUM_CALCULATION no lo arreglan). Subir de versión solo
# cuando ese issue se cierre, y probando que llegue un archivo a R2.
#
# Avisos de seguridad que afectan a 0.45.0 (revisados el 2026-11-06): solo
# la entrada `logstash` y el destino `file`, que esta configuración no usa.
# Además, Vector solo se alcanza desde la red privada de Railway.
FROM timberio/vector:0.45.0-alpine@sha256:936e7e05f54b817f5957acbc72ad32a9b7016f7071c03937ee5cbd199e204c02
COPY vector.yaml /etc/vector/vector.yaml
COPY arrancar.sh /usr/local/bin/arrancar.sh
RUN chmod 0755 /usr/local/bin/arrancar.sh
ENTRYPOINT ["/usr/local/bin/arrancar.sh"]
