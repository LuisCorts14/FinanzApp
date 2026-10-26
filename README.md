# FinanzApp

[![CI](https://github.com/LuisCorts14/FinanzApp/actions/workflows/ci.yml/badge.svg)](https://github.com/LuisCorts14/FinanzApp/actions/workflows/ci.yml)

### 🔗 [Ver la app en vivo](https://finanzapp-web-rust.vercel.app) · entra con **"Probar la demo"**, sin registrarte

**Finanzas personales para personas que nunca han llevado sus cuentas.** FinanzApp ayuda a registrar ingresos y gastos, ponerse límites por categoría y ahorrar para metas con un plan concreto, sin planillas ni jerga financiera. Pensada para Chile: montos en pesos chilenos y un catálogo de bancos, tarjetas y billeteras locales.

![Dashboard de FinanzApp](docs/screenshots/dashboard.png)

## ¿Por qué?

Mucha gente no sabe con certeza a dónde se le va el dinero cada mes. Las apps de finanzas suelen asumir que el usuario ya sabe qué es una "cuenta vista", cómo armar un presupuesto o cuánto debería ahorrar. FinanzApp parte desde cero: usa lenguaje simple, muestra si vas bien o mal con colores e íconos, y va dejando consejos (regla 50/30/20, fondo de emergencia, "págate primero") en el camino.

## Funcionalidades

- **Dashboard del mes:** ingresos, gastos y balance con variación respecto al mes anterior, porcentaje de ahorro, gastos por categoría, ingresos vs. gastos por semana y últimas transacciones.
- **Cuentas con bancos de Chile:** al crear una cuenta eliges tu institución (BancoEstado, Banco de Chile, Santander, MACH, Tenpo, CMR...) y solo ves sus productos (CuentaRUT, Cuenta Corriente, tarjeta de crédito...). El tipo y la moneda de la cuenta salen del producto, y cada cuenta se puede editar después para cambiar su institución o producto.
- **Tarjetas de crédito con cupo:** la deuda se muestra en negativo, junto al cupo usado y disponible y un consejo según el uso (mantenerse bajo el 30%, alerta desde el 80%).
- **Escanear boleta con IA:** tomas una foto y Claude (Haiku 5.5, el modelo más económico; configurable) lee el comercio, la fecha, el total y cada producto, asignándolo a una de tus categorías. La app agrupa los montos por categoría y te propone los gastos (p. ej. "Comida $3.280" y "Hogar $12.180" de una misma boleta del supermercado); tú revisas y confirmas antes de guardar. La foto no se guarda y hay un límite diario de escaneos por persona.
- **Transacciones:** registro, edición y eliminación con filtros por mes y tipo, y un buscador por descripción o categoría. El saldo de cada cuenta se actualiza solo.
- **Transferencias entre cuentas:** pagar la tarjeta desde la cuenta corriente, mandar plata a la cuenta de ahorro o sacar efectivo. Mueven los saldos de ambas cuentas pero no cuentan como ingreso ni como gasto, así los reportes no se inflan. Soportan cuentas con distinta moneda, y cada tarjeta tiene un atajo "Pagar tarjeta".
- **Categorías y presupuestos:** cada categoría de gasto puede tener un límite mensual, con una barra que pasa de verde a amarillo (80%) y rojo (excedido).
- **Metas de ahorro:** abonos y retiros con historial, cuánto apartar por día, semana o mes, un indicador de ritmo ("vas al día", "vas atrasado $X") y un gráfico del ahorro real contra el plan.
- **Plan para salir de deudas:** junta tus tarjetas de crédito con otras deudas (créditos de consumo, avances, casas comerciales, préstamos) con su tasa mensual y pago mínimo. Dices cuánto puedes pagar al mes y eliges *avalancha* (primero la tasa más alta, pagas menos intereses) o *bola de nieve* (primero la más chica, ves avances antes). La app simula mes a mes en qué orden se terminan, cuándo quedas libre, cuánto pagas en intereses y cuánto te ahorras frente a pagar solo el mínimo, con un gráfico de ambos caminos. Avisa si un pago mínimo no alcanza a cubrir los intereses.
- **Reportes:** tasa de ahorro, estado de los presupuestos, gastos por categoría (barras, círculo o tabla) e ingresos vs. gastos de los últimos 12 meses.
- **Cuentas de usuario:** registro e inicio de sesión con JWT y recuperación de contraseña por correo. Cada persona ve solo sus datos, y hay un límite de intentos contra quien intente adivinar contraseñas.
- **Mi perfil:** editar nombre y email (el email pide la contraseña actual), cambiar la contraseña cerrando las sesiones de otros dispositivos, ver un resumen de tus datos y eliminar la cuenta con todo lo asociado.
- **Configuración:** día de pago (el Dashboard calcula cuánto puedes gastar por día hasta el próximo sueldo), meta de ahorro mensual con una guía 50/30/20, umbral de aviso de los presupuestos y cuenta predeterminada. También permite **exportar todos tus movimientos a CSV** (abre bien en Excel en español).
- **Notificaciones:** la campana avisa cuando un presupuesto se acerca a su límite o lo supera, cuando gastas más de lo que ganas, cuando una tarjeta usa mucho cupo, cuando una meta va atrasada o se cumple, cuando se acerca tu sueldo y cuando llevas días sin registrar movimientos. Cada aviso lleva a la página donde se resuelve.
- **Multimoneda:** cuentas en USD u otras monedas, convertidas a CLP con tasas de cambio en caché.

## Capturas

| Metas de ahorro | Reportes |
|---|---|
| ![Detalle de una meta de ahorro](docs/screenshots/meta-ahorro.png) | ![Reportes](docs/screenshots/reportes.png) |

| Nueva cuenta (catálogo de bancos) | Cuentas |
|---|---|
| ![Selector de bancos de Chile](docs/screenshots/nueva-cuenta.png) | ![Cuentas](docs/screenshots/cuentas.png) |

| Transacciones | Categorías y presupuestos |
|---|---|
| ![Transacciones](docs/screenshots/transacciones.png) | ![Categorías](docs/screenshots/categorias.png) |

| Landing | Inicio de sesión | Móvil |
|---|---|---|
| ![Landing](docs/screenshots/landing.png) | ![Login](docs/screenshots/login.png) | ![Dashboard en móvil](docs/screenshots/dashboard-movil.png) |

## Stack

**Backend:** Python 3.12 · FastAPI · SQLAlchemy 2.0 · Pydantic v2 · PostgreSQL 16 · Alembic · JWT (PyJWT + bcrypt) · Resend (correos) · Claude API (lectura de boletas)
**Frontend:** React 19 · TypeScript · Vite · React Router · Axios. Sin librerías de UI ni de gráficos: los componentes y gráficos están hechos a mano con CSS y SVG.
**Infra local:** Docker Compose (Postgres)

## Arquitectura

```
finanzApp/
├── app/
│   ├── api/v1/endpoints/   # auth, accounts, catalog, categories, transactions, transfers, stats, savings_goals
│   ├── core/               # config, seguridad, tasas de cambio, catálogo de instituciones, correos
│   ├── db/                 # engine y sesión
│   ├── models/             # User, Account, Category, Transaction, SavingsGoal, SavingsContribution...
│   └── schemas/            # validación de entrada/salida con Pydantic
├── alembic/versions/       # migraciones (incluye migraciones de datos)
├── scripts/seed_demo_data.py
├── frontend/src/
│   ├── api/                # cliente HTTP por recurso
│   ├── components/         # layout, modales, tablas, gráficos (SVG/CSS)
│   ├── context/            # sesión (AuthContext)
│   ├── pages/              # Dashboard, Transacciones, Cuentas, Categorías, Reportes, Metas, auth, landing
│   └── utils/              # formato CLP, fechas, cálculo de ritmo de ahorro
└── docker-compose.yml
```

La documentación interactiva de la API (Swagger) queda en `http://localhost:8002/docs`.

## Cómo correrlo localmente

**Requisitos:** Python 3.12+, Node 20+ y Docker.

**1. Base de datos**
```bash
cp .env.example .env      # ajusta SECRET_KEY y, si quieres correos reales, SMTP_USER/SMTP_PASSWORD
docker compose up -d
```

**2. Backend** (puerto 8002)
```bash
python -m venv venv
.\venv\Scripts\activate    # Windows · en Linux/Mac: source venv/bin/activate
pip install -r requirements.txt
alembic upgrade head
uvicorn main:app --port 8002
```

**3. Frontend**
```bash
cd frontend
cp .env.example .env
npm install
npm run dev
```

Abre `http://localhost:5173`.

**Datos de demostración (opcional):** crea una cuenta desde la app y luego carga 5 meses de movimientos de ejemplo para ese usuario:
```bash
python scripts/seed_demo_data.py tu-email@ejemplo.com
```

Para enviar los correos de recuperación de contraseña, la opción gratuita es un Gmail dedicado a la app: activa la verificación en 2 pasos, crea una *contraseña de aplicación* y ponla en `SMTP_USER` / `SMTP_PASSWORD`. También funciona con Resend (`RESEND_API_KEY`), aunque para enviar a cualquier correo pide un dominio verificado. Sin ninguno, el link se imprime en la consola del backend. Para **escanear boletas**, agrega tu `ANTHROPIC_API_KEY` (de [console.anthropic.com](https://console.anthropic.com)) al `.env`; sin ella, esa sección aparece como no disponible y el resto de la app funciona igual.

## Deploy

La app corre en **Vercel** (frontend y backend, como dos proyectos del mismo repositorio) con **Neon** como base de datos PostgreSQL, todo en planes gratuitos.

En producción: frontend en [finanzapp-web-rust.vercel.app](https://finanzapp-web-rust.vercel.app) y API en [finanz-app-mocha-delta.vercel.app](https://finanz-app-mocha-delta.vercel.app/docs) (documentación interactiva en `/docs`).

| Proyecto en Vercel | Root Directory | Variables de entorno |
|---|---|---|
| Backend (FastAPI, detectado automáticamente) | `/` (raíz) | `DATABASE_URL` (Neon), `SECRET_KEY`, `CORS_ORIGINS` (URL del frontend), `FRONTEND_URL`, `DEMO_EMAIL`, `SMTP_USER`, `SMTP_PASSWORD` |
| Frontend (Vite) | `frontend` | `VITE_API_URL` (URL del backend + `/api/v1`), `VITE_DEMO_ENABLED=true` |

El backend usa conexiones sin pool en Vercel (`NullPool`), porque cada función serverless vive poco y Neon ya trae su propio pool. Las migraciones y la cuenta demo se ejecutan contra producción desde la máquina local, con las credenciales en un `.env.production` que no se sube a git:

```bash
set -a; source .env.production; set +a   # DATABASE_URL y DEMO_EMAIL de producción
alembic upgrade head
python scripts/demo_account.py           # crea o reinicia la cuenta demo
```

**Cuenta demo:** el botón "Probar la demo" entra sin contraseña a una cuenta con 6 meses de datos de ejemplo. Esa cuenta no permite cambiar su nombre, email ni contraseña, ni eliminarse, para que siga disponible para todos; `scripts/demo_account.py` la reinicia y se niega a tocar cualquier cuenta que no esté marcada como demo.

## Tests

El backend tiene una suite de **pytest** (105 tests) que recorre la API de punta a punta con `TestClient`: autenticación y recuperación de contraseña, límite de intentos, saldos que siguen a cada movimiento, catálogo de bancos, transferencias (incluyendo distinta moneda), escaneo de boletas (con la llamada a Claude simulada), saldos correctos bajo solicitudes concurrentes, estadísticas, presupuestos, metas de ahorro, la simulación del plan de deudas y aislamiento de datos entre usuarios.

```bash
pip install -r requirements-dev.txt
pytest
```

Los tests usan su propia base de datos `finanzapp_test` (se crea sola en el mismo Postgres de Docker) y se niegan a correr contra una base cuyo nombre no termine en `_test`, así nunca tocan los datos de desarrollo. Las tasas de cambio y el envío de correos se reemplazan por versiones falsas, sin llamadas a internet.

En cada push, **GitHub Actions** corre las migraciones sobre una base vacía, la suite de pytest, el lint y el build del frontend.

## Decisiones de diseño

- **El saldo se calcula, no se edita.** El saldo de una cuenta solo cambia a través de sus movimientos (crear, editar o borrar), así nunca se desincroniza del historial.
- **La categoría define si es ingreso o gasto.** La transacción no tiene un campo de tipo propio, así que no se puede, por ejemplo, registrar "Comida" como un ingreso por error.
- **La moneda de una cuenta con movimientos no se cambia.** Al editar, el backend rechaza un cambio de producto que implique otra moneda si la cuenta ya tiene transacciones, porque sus montos quedarían mal interpretados.
- **Las transferencias son una entidad propia.** No se modelan como un gasto más un ingreso con categoría, sino en su propia tabla. Así nunca aparecen en reportes ni presupuestos, y borrar una revierte los saldos de ambas cuentas de una sola vez.
- **Modelo económico por defecto.** El escaneo usa Claude Haiku 5.5 (del orden de 1-2 pesos por boleta). Con `RECEIPT_MODEL=claude-opus-5-5` se usa Opus, más preciso y con reintento automático en otro modelo si se declina una solicitud; ese parámetro solo se envía a los modelos que lo soportan.
- **La IA propone, la persona decide.** El escaneo de boletas usa salida estructurada (JSON Schema) y el backend no confía en lo que devuelve el modelo: descarta ids de categorías que no son de esa persona y fechas inválidas. Nada se guarda sin que la persona revise y confirme.
- **Cambiar la contraseña invalida los tokens anteriores.** Los JWT llevan una versión que se incrementa al cambiar o recuperar la contraseña; un token viejo deja de servir aunque no haya expirado.
- **Notificaciones calculadas, no guardadas.** Los avisos se calculan al momento a partir de los datos actuales, así nunca quedan desactualizados; solo se guarda cuáles leyó cada persona. La clave de cada aviso incluye su período, para que un presupuesto excedido en noviembre vuelva a avisar aunque se haya leído el de octubre.
- **Límite de intentos guardado en Postgres.** Login, registro, recuperación de contraseña y la entrada a la demo tienen un tope por email y por IP (por ejemplo, 5 intentos de login por minuto para un mismo email); al superarlo se responde 429 con el tiempo de espera. Los contadores viven en la base de datos y no en memoria porque en Vercel el backend corre en varias instancias que no comparten memoria.
- **El plan de deudas se calcula, no se guarda.** El backend simula los escenarios (avalancha, bola de nieve y solo mínimos) cada vez que se pide, a partir de los saldos actuales; así un gasto nuevo con la tarjeta cambia el plan al tiro. Solo se guardan el monto mensual y la estrategia elegidos. Las tasas se piden mensuales y con tope de 20%, para atajar el error común de escribir la tasa anual.
- **Saldos atómicos.** El saldo se ajusta con `UPDATE ... SET balance = balance + x` en la base de datos, no leyendo y escribiendo desde Python, para no perder actualizaciones cuando llegan varias solicitudes a la vez (un test de concurrencia lo cubre).
- **El catálogo manda.** Si una cuenta se crea desde un producto del catálogo, el backend fija el tipo y la moneda según el producto, aunque el cliente envíe otros valores. Es una lista mantenida a mano, porque no existe una API pública con los productos bancarios de Chile.
- **Máximo 3 categorías de ingreso.** Es una decisión de producto: la mayoría de las personas tiene una o dos fuentes de ingreso, y limitar las categorías evita que se desordenen. Los gastos no tienen límite.
- **El plan de ahorro parte desde lo que ya tenías.** El ritmo de una meta se mide contra una línea que va desde lo ahorrado al crearla hasta el objetivo. Así una meta nueva con plata ya guardada aparece "al día" y no "adelantada" por todo ese monto.
- **Color con significado y accesible.** Verde, amarillo y rojo siempre van acompañados de un ícono o texto. Los colores de los gráficos se validaron para contraste y daltonismo.
- **Si falla la API de tasas de cambio, la app sigue funcionando.** Usa las últimas tasas en caché (6 h) en vez de romperse.

## Próximos pasos

- Tests de componentes en el frontend
- Más consejos personalizados en el Dashboard

## Autor

Desarrollado por **Luis Alberto** · [github.com/LuisCorts14](https://github.com/LuisCorts14)

## Licencia

Código bajo licencia [MIT](LICENSE).
