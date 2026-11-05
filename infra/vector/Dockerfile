# Servicio de Vector en Railway (fase 10.1). En Railway: servicio nuevo desde
# este repo, "Root Directory" = /infra/vector. Ver docs/ops/registros-externos.md.
#
# Versión y digest fijos: una etiqueta como `latest` puede apuntar mañana a
# otra cosa. Dependabot (ecosistema docker, /infra/vector) propone las nuevas.
FROM timberio/vector:0.61.0-alpine@sha256:3bb7ed5152910ed51729e256937b1d8a4bf67ff624e9d565e8e5877bffd015c7
COPY vector.yaml /etc/vector/vector.yaml
COPY arrancar.sh /usr/local/bin/arrancar.sh
RUN chmod 0755 /usr/local/bin/arrancar.sh
ENTRYPOINT ["/usr/local/bin/arrancar.sh"]
