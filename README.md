# Horasapp 🕒

App de seguimiento de turnos y nómina estimada para trabajadores por horas en Colombia
(Preact + Vite + Bootstrap 5 + Firebase).

## Flujo

1. **Dashboard** → registra turnos día a día (fecha, entrada, salida; cruce de medianoche soportado).
2. **Ajustes** → configura una vez valor de la hora, % salud, % pensión y tipo de contrato (Firestore `users/{uid}`).
3. **Historial** → selecciona el corte (desde/hasta) y pulsa **Calcular Nómina**: se traen los turnos
   del rango y se aplica la legislación colombiana con tu configuración.

## Estructura

```
src/
├── main.jsx                      # Bootstrap + AuthProvider + SettingsProvider + App
├── app.jsx                       # Shell, router por hash (/#/ , /#/historial), modal de ajustes
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
│   ├── payrollCalculator.js      #   turnos → horas → calculateRangePayroll()
│   └── format.js                 #   Intl.NumberFormat('es-CO', COP)
└── components/
    ├── Login.jsx                 # Email/contraseña + Google
    ├── Navbar.jsx                # Responsiva, colapsable, links + sesión
    ├── Modal.jsx                 # Modal controlado (sin JS de Bootstrap)
    ├── SettingsModal.jsx         # Configuración base → users/{uid}
    ├── Dashboard.jsx             # Daily Shift Logger + stats del mes
    ├── ShiftHistory.jsx          # Lista, editar/eliminar, corte + Calcular Nómina
    ├── ShiftEditModal.jsx
    └── PayrollSummary.jsx        # Desglose devengos/deducciones/prestaciones
```

## Modelo de datos (Firestore)

```js
users/{uid} = { hourlyRate, healthRate, pensionRate, contractType, updatedAt }

shifts/{id} = { uid, date: 'YYYY-MM-DD', startTime: 'HH:MM', endTime: 'HH:MM',
                createdAt, updatedAt }   // salida < entrada = cruce de medianoche
```

## Reglas aplicadas en `calculateRangePayroll()`

| Concepto | Regla |
| --- | --- |
| Jornada ordinaria | 8 h/día (48 h/semana, Ley 2101/2016); excedente = horas extras |
| Hora ordinaria nocturna (7 p.m.–6 a.m.) | +35% (Ley 2101/2016) |
| Horas extras diurnas | +25% primeras 2 h/día, +50% excedente |
| Horas extras nocturnas | +75% primeras 2 h/día, +100% excedente |
| Domingo o festivo | +25% diurno, +75% nocturno |
| Salud / pensión | % configurados por el usuario sobre IBC (tope 25 SMLMV) |
| Cesantías / prima / vacaciones / intereses | 8.33% / 8.33% / 4.17% / 1% (solo contratos laborales) |
| Auxilio de transporte | 10% SMLMV si ingreso ≤ 2 SMLMV (solo contratos laborales) |
| Festivos | Fijos + Semana Santa (Pascua) + traslado al lunes (Ley 51/1990) |

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
