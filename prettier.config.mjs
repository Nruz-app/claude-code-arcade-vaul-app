// Configuración de Prettier. Se mantienen los valores por defecto de Prettier 3
// porque el código ya estaba escrito en ese estilo (comillas dobles, punto y
// coma, indentación de 2 espacios); dejarlos explícitos evita sorpresas si
// cambian los defaults en una versión futura.

/** @type {import("prettier").Config} */
const config = {
  semi: true,
  singleQuote: false,
  tabWidth: 2,
  trailingComma: "all",
  printWidth: 80,
  endOfLine: "lf",
};

export default config;
