// ===== app/auth/errores.ts — Mensajes de Supabase en español =====
// Supabase devuelve los errores en inglés y toda la UI del proyecto está en
// español. Las claves van en minúscula y sin punto final porque el mismo error
// llega con distinta capitalización según el endpoint ("email rate limit
// exceeded") y a veces con punto ("...at least 8 characters.").
//
// Vive fuera de las pantallas desde la SPEC 19: son cuatro, y cuatro copias del
// mismo mapa se desincronizan a la primera.

// Longitud mínima de contraseña (SPEC 22). Tiene que coincidir con
// _Minimum password length_ del dashboard de Supabase, que es quien manda de
// verdad; esto solo se adelanta al viaje a la red. El paso 3d de
// supabase/README.md lo dice al revés también: si alguien cambia el dashboard,
// este número va detrás.
export const MIN_PASSWORD = 8;

// El mismo texto para los dos caminos —la guardia del formulario y la respuesta
// de Supabase traducida—, para que el usuario lea lo mismo se entere por donde
// se entere.
export const PASSWORD_CORTA = `LA CONTRASEÑA NECESITA AL MENOS ${MIN_PASSWORD} CARACTERES`;

export const ERRORES: Record<string, string> = {
  "invalid login credentials": "CREDENCIALES INCORRECTAS",
  "user already registered": "ESE CORREO YA TIENE CUENTA",
  // Clave calculada a partir de MIN_PASSWORD a propósito: Supabase escribe el
  // número en el mensaje ("Password should be at least 8 characters."), así que
  // si el mínimo cambia y la clave se quedara escrita a mano, dejaría de casar
  // en silencio y el usuario vería el genérico.
  [`password should be at least ${MIN_PASSWORD} characters`]: PASSWORD_CORTA,
  "email rate limit exceeded": "DEMASIADOS INTENTOS, PRUEBA EN UN RATO",
  "anonymous sign-ins are disabled": "RELLENA CORREO Y CONTRASEÑA",
  // Del flujo de recuperación (SPEC 19).
  "new password should be different from the old password":
    "LA CONTRASEÑA NUEVA TIENE QUE SER DISTINTA DE LA ANTERIOR",
  "auth session missing": "EL ENLACE HA CADUCADO, PÍDELO OTRA VEZ",
  // Del acceso con proveedor (SPEC 20). Pasa cuando Google o GitHub no están
  // activados en el dashboard: sin esto, el botón parecería no hacer nada.
  "unsupported provider: provider is not enabled":
    "ESE ACCESO NO ESTÁ DISPONIBLE TODAVÍA",
  // De los ajustes de seguridad de la SPEC 22, los dos que sin traducir caerían
  // en el genérico:
  // - _Leaked password protection_, que compara contra HaveIBeenPwned. No es un
  //   fallo del usuario ni de la app: es una contraseña real que ya circula.
  "password is known to be weak and easy to guess, please choose a different one":
    "ESA CONTRASEÑA APARECE EN FILTRACIONES, ELIGE OTRA",
  // - El límite de registros e inicios de sesión por hora y por IP. Distinto del
  //   "email rate limit exceeded" de arriba, que es el de envío de correos.
  "request rate limit reached":
    "DEMASIADOS INTENTOS DESDE AQUÍ, PRUEBA MÁS TARDE",
};

export function traducir(mensaje: string): string {
  // Se recorta también la exclamación: supabase-js manda exactamente
  // "Auth session missing!", y sin esto la clave no casaría.
  const clave = mensaje
    .trim()
    .toLowerCase()
    .replace(/[.!]+$/, "");
  return ERRORES[clave] ?? "NO SE PUDO COMPLETAR LA OPERACIÓN";
}
