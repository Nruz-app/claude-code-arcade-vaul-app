#!/usr/bin/env bash
# Hook PostToolUse (Write|Edit) de Arcade Vault.
#
# Sobre el archivo que Claude Code acaba de escribir:
#   1. Prettier --write, que además de formatear ya deja como máximo una línea
#      en blanco seguida, quita los espacios y tabs al final de cada línea y
#      elimina las líneas vacías sobrantes al final del archivo.
#   2. Para lo que Prettier no sabe parsear (.sh, .ps1, .txt, .svg…), esa misma
#      limpieza de espacios se aplica a mano, para que la regla valga en todo
#      el proyecto y no solo en el código.
#   3. ESLint --fix si es JavaScript/TypeScript.
#
# Los problemas que ESLint no puede corregir solo se devuelven al modelo como
# contexto: el hook nunca bloquea la edición ni falla de forma ruidosa.

set -uo pipefail

# La raíz del proyecto se deriva de dónde vive este script (<proyecto>/.claude/),
# no se escribe a mano: con la ruta fija, copiar la carpeta a otro sitio dejaba el
# hook apuntando al proyecto viejo y fallando en silencio.
# `pwd -W` da la ruta en formato Windows (C:/…), que es como llegan las rutas en
# el JSON del hook; sin él, Git Bash devolvería /c/… y la comprobación de abajo
# descartaría todos los archivos.
SCRIPT_DIR=$(cd "$(dirname "${BASH_SOURCE[0]}")" 2>/dev/null && (pwd -W 2>/dev/null || pwd)) || exit 0
PROJECT_DIR=$(cd "$SCRIPT_DIR/.." 2>/dev/null && (pwd -W 2>/dev/null || pwd)) || exit 0
cd "$PROJECT_DIR" 2>/dev/null || exit 0

PRETTIER="./node_modules/.bin/prettier"
ESLINT="./node_modules/.bin/eslint"

# La ruta llega en el JSON de stdin; Write y Edit la exponen en campos distintos.
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

# --ignore-unknown hace que Prettier ignore en silencio lo que no sabe formatear
# y respeta .prettierignore.
"$PRETTIER" --write --ignore-unknown "$file" >/dev/null 2>&1

case "$norm_file" in
  # Extensiones que Prettier sí parsea: ya quedaron limpias en el paso anterior.
  *.js|*.jsx|*.mjs|*.cjs|*.ts|*.tsx|*.css|*.scss|*.less|*.json|*.jsonc|*.md|*.mdx|*.yml|*.yaml|*.html|*.vue|*.graphql)
    ;;
  # En parches y diffs los espacios finales son significativos: no se tocan.
  *.patch|*.diff)
    ;;
  *)
    # Prettier no sabe con este archivo. Se limpia a mano si es texto y si
    # .prettierignore no lo excluye (ahí la intención es dejarlo intacto).
    ignored=$("$PRETTIER" --file-info "$file" 2>/dev/null | jq -r '.ignored' 2>/dev/null)
    if [ "$ignored" != "true" ] && grep -qI . "$file" 2>/dev/null; then
      tmp="${file}.wsclean.$$"
      # 1) espacios/tabs al final de línea  2) máximo una línea en blanco
      # 3) exactamente un salto de línea final
      if perl -0pe 's/[ \t]+$//mg; s/\n{3,}/\n\n/g; s/\s*\z/\n/' "$file" > "$tmp" 2>/dev/null; then
        mv -f "$tmp" "$file" 2>/dev/null || rm -f "$tmp"
      else
        rm -f "$tmp"
      fi
    fi
    ;;
esac

# ESLint solo entiende JS/TS. Para .md, .css o .json termina aquí.
case "$norm_file" in
  *.js|*.jsx|*.mjs|*.cjs|*.ts|*.tsx) ;;
  *) exit 0 ;;
esac

# --no-warn-ignored evita que un archivo excluido en eslint.config.mjs cuente
# como error. Se captura la salida para reportar lo que --fix no pudo arreglar.
# ESLint sale con 0 cuando solo hay warnings, así que la señal es que haya
# salida, no el código de salida: sin problemas no imprime nada.
lint_output=$("$ESLINT" --fix --no-warn-ignored "$file" 2>&1)

if [ -n "$lint_output" ]; then
  jq -n --arg out "$lint_output" '{
    hookSpecificOutput: {
      hookEventName: "PostToolUse",
      additionalContext: ("ESLint reporta problemas que --fix no pudo corregir:\n" + $out)
    }
  }'
fi

exit 0
