# MD Logística S.R.L. × Agencia Muove — Demo funcional

Prototipo funcional de la plataforma propuesta por **Agencia Muove** para **MD Logística S.R.L.** (base en Paso de los Libres, corredor Argentina ↔ Brasil). Funciona 100 % en el navegador, sin backend ni API keys.

## Accesos de demostración

| Rol | Usuario | Contraseña | Ve |
|---|---|---|---|
| Administración | `administracion` | `mdlogistica2026` | Los 4 paneles (con vista previa de chofer y cliente) |
| Finanzas | `finanzas` | `finanzas2026` | Panel de Finanzas |
| Chofer | `chofer` | `chofer2026` | App del Chofer de la unidad MD-104 |
| Cliente | `arcor` | `cliente2026` | Portal de Arcor S.A.I.C. |

## Qué incluye

- **Mapa oficial de Argentina (IGN Argenmap)** con capas Mapa vial AR+BR, Oscuro y Satélite; respaldo automático si el IGN no responde.
- **Rutas reales**: los corredores siguen las rutas nacionales (trazados de OpenStreetMap/OSRM precalculados en `src/data/routeGeometries.ts`). Las rutas nuevas se calculan en vivo por ruteo vial.
- **Simulación GPS por kilómetro**, con geocercas automáticas: mitad de recorrido, a 60 km de destino (aviso al cliente), arribo, y **cruce por Aduana Integrada Paso de los Libres – Uruguaiana** en el corredor a Porto Alegre.
- **Ciclo de viaje completo**: orden de carga → publicación a uno o varios choferes → aceptar/rechazar → carga → viaje → descarga → remito conformado con foto → factura ARCA (o CT-e SEFAZ para clientes de Brasil) → cobro.
- **App del Chofer** con modo sin señal real (cola offline que se sincroniza en orden al reconectar), gastos en ARS, comunicados y perfil con vencimientos.
- **Portal de Clientes** con seguimiento solo de sus propias unidades, métricas calculadas, documentos imprimibles (Carta de Porte, Hoja de Ruta, CRT, MIC/DTA, Remito, Factura/CT-e) y estado de cuenta.
- **Finanzas**: facturación, cobranzas con vencidas, auditoría de gastos, liquidación a choferes/fleteros, rentabilidad por viaje/camión/cliente/ruta y exportación CSV.
- **Controles de demo** (botón "Demo", solo admin): pausar, velocidad del tiempo (real / x150 / x600) y reinicio.

Los datos se guardan en el navegador (`localStorage`); "Reiniciar datos de la demo" vuelve al estado inicial.

## Ejecutar

```bash
npm install
npm run dev
```

Publicar: `npx vercel --prod`, o subir la carpeta `dist/` (generada con `npm run build`) a cualquier hosting estático.

Para regenerar los trazados de ruta: `node scripts/gen-routes.mjs src/data/routeGeometries.ts` (usa el OSRM público).
