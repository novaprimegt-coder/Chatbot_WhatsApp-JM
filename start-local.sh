#!/usr/bin/env sh
set -eu
cd "$(dirname "$0")"
if ! command -v node >/dev/null 2>&1; then
  echo "ERROR: Node.js no está instalado o no está disponible en PATH."
  exit 1
fi
echo "Iniciando JM Cruz L. Digital WhatsApp Bot V1.0.0..."
node server/server.js
