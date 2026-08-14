#!/usr/bin/env bash
# Hook Stop de Arcade Vault: la suite completa antes de devolver el turno.
#
# El hook PostToolUse (test-file.sh) solo corre las pruebas del archivo tocado,
# que es lo rápido pero no lo completo: cambiar `types.ts`, `registry.ts` o un
# motor puede romper la prueba de otro. Esta es la red que lo pilla.
#
# Solo corre si en el turno se tocó código JS/TS, cosa que sabe por el testigo
# que deja test-file.sh. Sin esa condición, la suite se ejecutaría también al
# final de un turno de pura conversación.
#
# Si algo falla, devuelve decision:block con el detalle: Claude Code no cierra
# el turno y el modelo recibe el error para arreglarlo.

set -uo pipefail

SCRIPT_DIR=$(cd "$(dirname "${BASH_SOURCE[0]}")" 2>/dev/null && (pwd -W 2>/dev/null || pwd)) || exit 0
PROJECT_DIR=$(cd "$SCRIPT_DIR/.." 2>/dev/null && (pwd -W 2>/dev/null || pwd)) || exit 0
cd "$PROJECT_DIR" 2>/dev/null || exit 0

VITEST="./node_modules/.bin/vitest"
TESTIGO="node_modules/.cache/arcade-vault-tests-pendientes"

entrada=$(cat)

# Segunda barrera contra el bucle infinito: si este hook ya bloqueó una vez,
# `stop_hook_active` viene en true y aquí se para. Sin esto, unas pruebas que el
# modelo no consiga arreglar bloquearían el turno una y otra vez.
if [ "$(printf '%s' "$entrada" | jq -r '.stop_hook_active // false' 2>/dev/null)" = "true" ]; then
  exit 0
fi

# Sin testigo, en este turno no se tocó código: no hay nada que verificar.
[ -f "$TESTIGO" ] || exit 0
rm -f "$TESTIGO" 2>/dev/null

[ -x "$VITEST" ] || exit 0

salida=$("$VITEST" run --reporter=dot --silent=true 2>&1)
codigo=$?

[ "$codigo" -eq 0 ] && exit 0

recorte=$(printf '%s' "$salida" | tail -100)
jq -n --arg out "$recorte" '{
  decision: "block",
  reason: ("La suite de pruebas falla tras los cambios de este turno. Arregla lo que corresponda —el código o la prueba, según cuál esté equivocada— y vuelve a ejecutar `npm run test:run`.\n\n" + $out)
}'

exit 0
