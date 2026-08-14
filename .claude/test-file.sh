#!/usr/bin/env bash
# Hook PostToolUse (Write|Edit) de Arcade Vault: pruebas del archivo tocado.
#
# Corre solo las pruebas que le incumben al archivo que Claude Code acaba de
# escribir, para que el fallo aparezca junto al cambio que lo causó y no diez
# ediciones después. La suite completa la corre el hook Stop (test-suite.sh).
#
# Además deja un testigo en node_modules/.cache: es lo que le dice al hook Stop
# que en este turno se tocó código y que merece la pena correr la suite entera.
# Sin él, la suite se ejecutaría también en los turnos de pura conversación.
#
# Como el de formateo, nunca bloquea la edición: los fallos vuelven al modelo
# como contexto.

set -uo pipefail

# La raíz se deriva de dónde vive el script (<proyecto>/.claude/), no se escribe
# a mano: con la ruta fija, copiar la carpeta a otro sitio deja el hook
# apuntando al proyecto viejo y fallando en silencio.
SCRIPT_DIR=$(cd "$(dirname "${BASH_SOURCE[0]}")" 2>/dev/null && (pwd -W 2>/dev/null || pwd)) || exit 0
PROJECT_DIR=$(cd "$SCRIPT_DIR/.." 2>/dev/null && (pwd -W 2>/dev/null || pwd)) || exit 0
cd "$PROJECT_DIR" 2>/dev/null || exit 0

VITEST="./node_modules/.bin/vitest"
TESTIGO="node_modules/.cache/arcade-vault-tests-pendientes"

# Sin Vitest instalado no hay nada que hacer (copia recién clonada del repo).
[ -x "$VITEST" ] || exit 0

file=$(jq -r '.tool_response.filePath // .tool_input.file_path // empty' 2>/dev/null)
[ -n "$file" ] || exit 0
[ -f "$file" ] || exit 0

# Solo archivos dentro del proyecto: Claude también escribe en el scratchpad.
norm_file=$(printf '%s' "$file" | tr '\\' '/' | tr '[:upper:]' '[:lower:]')
norm_root=$(printf '%s' "$PROJECT_DIR" | tr '[:upper:]' '[:lower:]')
case "$norm_file" in
  "$norm_root"/*) ;;
  *) exit 0 ;;
esac

# Solo código: un cambio en un .md o un .css no puede romper una prueba.
case "$norm_file" in
  *.ts|*.tsx|*.js|*.jsx|*.mjs|*.cjs) ;;
  *) exit 0 ;;
esac

# Ruta relativa a la raíz, que es como Vitest filtra.
rel="${norm_file#"$norm_root"/}"

# Se tocó código: que el hook Stop corra la suite al terminar el turno.
mkdir -p "$(dirname "$TESTIGO")" 2>/dev/null && : > "$TESTIGO" 2>/dev/null

# ¿Qué pruebas le tocan a este archivo?
objetivo=""
base=$(basename "$rel")
base="${base%.*}"

case "$rel" in
  tests/harness/*)
    # El arnés lo usan todas: se corre la suite entera.
    objetivo="tests/"
    ;;
  *.test.ts|*.test.tsx)
    objetivo="$rel"
    ;;
  *)
    # Un archivo de la app: se busca su prueba homónima en tests/.
    encontrado=$(find tests -type f -name "${base}.test.ts" 2>/dev/null | head -1)
    if [ -n "$encontrado" ]; then
      objetivo="$encontrado"
    fi
    ;;
esac

# Sin prueba propia no se corre nada aquí: el archivo puede seguir rompiendo
# otras pruebas, y de eso ya se encarga la suite completa del hook Stop.
[ -n "$objetivo" ] || exit 0

# `--silent=true` con el valor pegado, no `--silent` suelto: si no, el parser de
# Vitest se come el argumento siguiente y toma la ruta como valor de la opción.
salida=$("$VITEST" run --reporter=dot --silent=true "$objetivo" 2>&1)
codigo=$?

if [ "$codigo" -ne 0 ]; then
  # Solo la parte útil: el resumen de Vitest es largo y repetitivo.
  recorte=$(printf '%s' "$salida" | tail -80)
  jq -n --arg out "$recorte" --arg obj "$objetivo" '{
    hookSpecificOutput: {
      hookEventName: "PostToolUse",
      additionalContext: ("Fallan las pruebas de " + $obj + ":\n" + $out)
    }
  }'
fi

exit 0
