## Arcade Vault

Es una plataforma para jugar online y competir por la mayor cantidad de puntos.

## Puesta en marcha

```bash
npm install
cp .env.example .env   # y rellena los valores
npm run dev            # http://localhost:3000
```

### Variables de entorno

`.env` no se versiona. Copia `.env.example` y rellena los dos valores desde el
dashboard de Supabase, en **Project Settings → API Keys**:

| Variable                               | De dónde sale                                            |
| -------------------------------------- | -------------------------------------------------------- |
| `NEXT_PUBLIC_SUPABASE_URL`             | Project URL                                              |
| `NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY` | Publishable key (`sb_publishable_…`)                     |
| `SUPABASE_DB_PASS`                     | Solo la usa el CLI de Supabase; la aplicación no la lee. |

Las dos primeras llevan el prefijo `NEXT_PUBLIC_` porque viajan al navegador.
La clave publicable es pública por diseño: lo que protege los datos son las
políticas RLS, no el secreto de la clave. La `service_role` no se usa en este
proyecto y no debe acabar en el repositorio.

### Base de datos

El esquema vive en `supabase/migrations/`. Para recrearlo en un proyecto nuevo,
aplica los archivos en orden de nombre. `20260809191140_profiles.sql` crea la
tabla `public.profiles`, sus políticas RLS y el trigger `on_auth_user_created`,
que es quien inserta el perfil al registrarse: la aplicación nunca hace `insert`
sobre esa tabla.

En **Authentication → Sign In / Providers → Email**, la opción **Confirm email**
debe estar **desactivada**. Con ella activada, `signUp` no devuelve sesión y el
registro muestra "REVISA TU CORREO PARA CONFIRMAR LA CUENTA" en lugar de entrar
directo a la biblioteca.

## Usa Spec Driven Design

Basado en /spec y /spec-impl

Siguiendo las buenas practicas recomendadas aquí:
https://github.com/Klerith/fernando-skills

## Skills usadas

```bash
npx skills@latest add Klerith/fernando-skills
```

```bash
npx skills add https://github.com/anthropics/skills --skill frontend-design
```
