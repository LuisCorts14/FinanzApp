# FinanzApp

**Finanzas personales para personas que nunca han llevado sus cuentas.** FinanzApp ayuda a registrar ingresos y gastos, ponerse límites por categoría y ahorrar para metas con un plan concreto, sin planillas ni jerga financiera. Pensada para Chile: montos en pesos chilenos y un catálogo de bancos, tarjetas y billeteras locales.

![Dashboard de FinanzApp](docs/screenshots/dashboard.png)

## ¿Por qué?

Mucha gente no sabe con certeza a dónde se le va el dinero cada mes. Las apps de finanzas suelen asumir que el usuario ya sabe qué es una "cuenta vista", cómo armar un presupuesto o cuánto debería ahorrar. FinanzApp parte desde cero: usa lenguaje simple, muestra si vas bien o mal con colores e íconos, y va dejando consejos (regla 50/30/20, fondo de emergencia, "págate primero") en el camino.

## Funcionalidades

- **Dashboard del mes:** ingresos, gastos y balance con variación respecto al mes anterior, porcentaje de ahorro, gastos por categoría, ingresos vs. gastos por semana y últimas transacciones.
- **Cuentas con bancos de Chile:** al crear una cuenta eliges tu institución (BancoEstado, Banco de Chile, Santander, MACH, Tenpo, CMR...) y solo ves sus productos (CuentaRUT, Cuenta Corriente, tarjeta de crédito...). El tipo y la moneda de la cuenta salen del producto. Las tarjetas de crédito muestran su deuda en negativo.
- **Transacciones:** registro, edición y eliminación con filtros por mes y tipo, y un buscador por descripción o categoría. El saldo de cada cuenta se actualiza solo.
- **Categorías y presupuestos:** cada categoría de gasto puede tener un límite mensual, con una barra que pasa de verde a amarillo (80%) y rojo (excedido).
- **Metas de ahorro:** abonos y retiros con historial, cuánto apartar por día, semana o mes, un indicador de ritmo ("vas al día", "vas atrasado $X") y un gráfico del ahorro real contra el plan.
- **Reportes:** tasa de ahorro, estado de los presupuestos, gastos por categoría (barras, círculo o tabla) e ingresos vs. gastos de los últimos 12 meses.
- **Cuentas de usuario:** registro e inicio de sesión con JWT y recuperación de contraseña por correo. Cada persona ve solo sus datos.
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

**Backend:** Python 3.12 · FastAPI · SQLAlchemy 2.0 · Pydantic v2 · PostgreSQL 16 · Alembic · JWT (PyJWT + bcrypt) · Resend (correos)
**Frontend:** React 19 · TypeScript · Vite · React Router · Axios. Sin librerías de UI ni de gráficos: los componentes y gráficos están hechos a mano con CSS y SVG.
**Infra local:** Docker Compose (Postgres)

## Arquitectura

```
finanzApp/
├── app/
│   ├── api/v1/endpoints/   # auth, accounts, catalog, categories, transactions, stats, savings_goals
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
cp .env.example .env      # ajusta SECRET_KEY y, si quieres correos reales, RESEND_API_KEY
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

Si no configuras `RESEND_API_KEY`, el link para recuperar la contraseña se imprime en la consola del backend.

## Decisiones de diseño

- **El saldo se calcula, no se edita.** El saldo de una cuenta solo cambia a través de sus movimientos (crear, editar o borrar), así nunca se desincroniza del historial.
- **La categoría define si es ingreso o gasto.** La transacción no tiene un campo de tipo propio, así que no se puede, por ejemplo, registrar "Comida" como un ingreso por error.
- **El catálogo manda.** Si una cuenta se crea desde un producto del catálogo, el backend fija el tipo y la moneda según el producto, aunque el cliente envíe otros valores. Es una lista mantenida a mano, porque no existe una API pública con los productos bancarios de Chile.
- **Máximo 3 categorías de ingreso.** Es una decisión de producto: la mayoría de las personas tiene una o dos fuentes de ingreso, y limitar las categorías evita que se desordenen. Los gastos no tienen límite.
- **El plan de ahorro parte desde lo que ya tenías.** El ritmo de una meta se mide contra una línea que va desde lo ahorrado al crearla hasta el objetivo. Así una meta nueva con plata ya guardada aparece "al día" y no "adelantada" por todo ese monto.
- **Color con significado y accesible.** Verde, amarillo y rojo siempre van acompañados de un ícono o texto. Los colores de los gráficos se validaron para contraste y daltonismo.
- **Si falla la API de tasas de cambio, la app sigue funcionando.** Usa las últimas tasas en caché (6 h) en vez de romperse.

## Próximos pasos

- Tests automatizados (pytest para la API y tests de componentes en el frontend)
- Deploy público con una cuenta demo
- Cupo de tarjetas de crédito (usado / disponible) con alertas
- Editar cuentas existentes (institución y producto)
- Escanear boletas, perfil de usuario y notificaciones

## Autor

Desarrollado por **Luis Alberto** · [github.com/LuisCorts14](https://github.com/LuisCorts14)
