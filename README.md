# Horasapp 🕒

App de seguimiento de turnos y nómina estimada para trabajadores por horas en Colombia
(Preact + Vite + Bootstrap 5 + Firebase).

## Flujo

1. **Dashboard** → registra turnos día a día (fecha, entrada, salida; cruce de medianoche
   soportado). Si dejas la salida vacía el turno queda **Pendiente** (`endTime: null`): no
   bloquea registros posteriores y se cierra luego desde Historial.
2. **Datos laborales** → **obligatorio antes de usar la app**: un usuario sin datos guardados
   queda en el onboarding (modal bloqueante) hasta completar y guardar su información. Define el
   **salario básico mensual** (la hora se deriva ÷ 210 h/mes) o el
   valor de la hora directo, % salud, % pensión, tipo de contrato, modo de auxilio de transporte y
   descanso por jornada (Firestore `users/{uid}` con `monthlySalary`). No hay valores por defecto:
   mientras Firestore resuelve se muestra un estado de carga.
3. **Historial** → lista los turnos con filtro por mes y acciones de editar/eliminar.
4. **Nómina** → selecciona el corte (desde/hasta), revisa la lista de turnos del periodo y pulsa
   **Calcular Nómina**: la lista se colapsa y se aplica la legislación colombiana con tu
   configuración (cambiar fechas o "Ver turnos" regresa a la lista). Si el corte contiene turnos
   **Pendientes** aparece un aviso con **Completar con jornada diaria (X h)**: cierre explícito y
   a un clic, validado contra turnos vecinos (si hay solape no guarda y pide corrección manual).
   El botón
   **¿Cómo se calcula mi nómina?** (navbar y vista de nómina) abre la guía de reglas, porcentajes
   y respaldo legal.

## Estructura

```
src/
├── main.jsx                      # Bootstrap + AuthProvider + SettingsProvider + App
├── app.jsx                       # Shell, router por hash (/#/ , /#/historial , /#/nomina), modal de ajustes
├── config/firebaseConfig.js      # Skeleton de credenciales (tuyas)
├── hooks/useHashRoute.js         # Router mínimo sin dependencias
├── services/                     # Única capa que toca Firestore/Auth
│   ├── firebase.js               #   inicialización perezosa
│   ├── auth.js                   #   loginWithGoogle(), loginWithEmail()…
│   ├── userSettings.js           #   loadUserSettings(), saveUserSettings()
│   └── shifts.js                 #   saveShift(), updateShift(), deleteShift(), listShifts()…
├── context/
│   ├── AuthContext.jsx           # Sesión global
│   └── SettingsContext.jsx       # Configuración base del usuario (carga/guarda)
├── utils/                        # Lógica de dominio pura
│   ├── constants.js              #   SMLMV, recargos, tipos de contrato
│   ├── dates.js                  #   fechas ISO, fin de semana
│   ├── holidays.js               #   festivos colombianos (Semana Santa + traslado a lunes)
│   ├── payrollCalculator.js      #   turnos → horas → calculateRangePayroll() + pendientes
│   ├── shiftConflicts.js         #   solapes reutilizables (cruce de medianoche) + un turno/día
│   └── format.js                 #   Intl.NumberFormat('es-CO', COP)
└── components/
    ├── Login.jsx                 # Email/contraseña + Google
    ├── Navbar.jsx                # Responsiva, colapsable, links + sesión
    ├── Modal.jsx                 # Modal controlado (sin JS de Bootstrap)
    ├── SettingsModal.jsx         # Configuración base → users/{uid}
    ├── Dashboard.jsx             # Daily Shift Logger + stats del mes
    ├── ShiftHistory.jsx          # Solo lista de turnos: filtro por mes + editar/eliminar
    ├── ShiftEditModal.jsx
    ├── PayrollCalc.jsx           # Corte desde/hasta + Calcular Nómina (ruta /#/nomina)
    ├── PayrollSummary.jsx        # Desglose devengos/deducciones/prestaciones
    └── PayrollGuide.jsx          # Modal "Cómo se calcula tu nómina" (reglas + respaldo legal)
```

## Modelo de datos (Firestore)

```js
users/{uid} = { hourlyRate, monthlySalary, healthRate, pensionRate, contractType,
                breakMinutes, transportMode, updatedAt }   // sin defaults: null = onboarding

shifts/{id} = { uid, date: 'YYYY-MM-DD', startTime: 'HH:MM', endTime: 'HH:MM' | null,
                createdAt, updatedAt }   // null = "Pendiente"; salida < entrada = cruce de medianoche
```

## Reglas aplicadas en `calculateRangePayroll()`

| Concepto | Regla |
| --- | --- |
| Jornada ordinaria | Límite configurable por día (por defecto 8 h/día, Ley 2101 de 2021); excedente = horas extras, en orden cronológico |
| Hora ordinaria nocturna (7 p.m.–6 a.m.) | +35% (CST art. 56 · franja nocturna Ley 1846 de 2017) |
| Horas extras diurnas | +25% todas, sin escalonado (CST art. 168) |
| Horas extras nocturnas | +75% todas, sin escalonado (CST art. 168) |
| Domingo o festivo | +90% diurno y +125% nocturno (90% + 35% noche · Ley 2466, 90% desde jul-2026); sus extras acumulan base dominical 90% + extra (×2,15 diurna / ×2,65 nocturna) |
| Salud / pensión | % configurados por el usuario sobre IBC (tope 25 SMLMV) |
| Cesantías / prima / vacaciones / intereses | 8.33% / 8.33% / 4.17% / 12% anual prorrateado; cesantías y prima incluyen el auxilio, vacaciones solo la base ordinaria (solo contratos laborales) |
| Auxilio de transporte | 10% SMLMV si el **salario base** ≤ 2 SMLMV (solo contratos laborales; las extras no lo quitan) |
| Turnos pendientes (`endTime` null) | 0 h pagaderas (sin `NaN`), reportados en `meta.pendingShifts`; nunca se cierran solos — solo manualmente o con **Completar con jornada diaria** (jornada + descanso, validada contra solapes) |
| Festivos | Fijos + Semana Santa (Pascua) + traslado al lunes (Ley 51 de 1983, 7 móviles) |

> Actualiza `SMLMV` en `src/utils/constants.js` cada año.

## Puesta en marcha

```bash
pnpm install
pnpm dev
```

1. Copia `.env.example` a `.env.local` con tus credenciales de Firebase **o** inyecta
   directamente en `src/config/firebaseConfig.js`.
2. Mientras no esté configurado, la app corre en **modo demo** (sin login ni persistencia).
3. Habilita **Email/Password** y **Google** en Firebase y publica estas reglas:

```
rules_version = '2';
service cloud.firestore {
  match /databases/{db}/documents {
    match /users/{uid} {
      allow read, write: if request.auth != null && request.auth.uid == uid;
    }
    match /shifts/{id} {
      allow read, update, delete: if request.auth != null && resource.data.uid == request.auth.uid;
      allow create: if request.auth != null && request.resource.data.uid == request.auth.uid;
    }
  }
}
```

## Scripts

| Comando | Descripción |
| --- | --- |
| `pnpm dev` | Servidor de desarrollo |
| `pnpm build` | Build de producción |
| `pnpm preview` | Vista previa del build |
| `pnpm test` | Suite de unit tests (Vitest) |
| `pnpm run deploy` | Build + despliegue a Firebase Hosting (`horasapp-e3710`) |
| `pnpm run deploy:preview` | Build + despliegue a un canal de preview temporal |

> ⚠️ **Nota:** el comando literal `pnpm deploy` está reservado por pnpm (su CLI
> propio para desplegar paquetes de workspaces) y **no** ejecuta scripts de
> `package.json`. Por eso el despliegue se lanza con `pnpm run deploy`.

## Despliegue (Firebase Hosting)

```bash
pnpm install
npx firebase login        # solo la primera vez (autenticación interactiva)
pnpm run deploy           # vite build + firebase deploy --only hosting
```

1. `firebase.json` publica `dist/` con rewrite SPA (`**` → `/index.html`) y
   caché inmutable para `/assets/**` (archivos hasheados por Vite).
2. `.firebaserc` apunta al proyecto **`horasapp-e3710`** (mismo proyecto que
   `src/config/firebaseConfig.js`).
3. Requisitos en consola de Firebase: habilita **Authentication** (Email/Password
   y Google), publica las reglas de Firestore de arriba y agrega el dominio del
   Hosting (y `localhost` para desarrollo) en
   *Authentication → Settings → Authorized domains*.
4. Despliegue en CI: usa `FIREBASE_TOKEN` (generado con
   `npx firebase login:ci`) como secreto y ejecuta `pnpm run deploy`.
