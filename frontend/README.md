# Vendex — prototipo frontend

“Tu copiloto para planear, dar seguimiento y vender más.” Prototipo visual 100% interactivo (sin backend) para presentar a inversionistas.

## Ejecutar

```bash
cd frontend
npm install
npm run dev      # desarrollo
npm run build    # genera dist/ (rutas relativas, se puede abrir desde cualquier hosting estático)
```

## Stack

React 19 + Vite, Tailwind CSS v4, Lucide Icons, fuente Inter. El estado vive en `src/store.jsx` y se guarda en `localStorage` (botón “Restablecer datos de demo” en la barra lateral).

## Estructura

| Archivo | Qué contiene |
| --- | --- |
| `src/data/mock.js` | Países (Perú, Bolivia, Venezuela), vendedores, catálogo de máquinas, clientes, tratos, tareas, alertas y estrategia de ejemplo (datos ficticios) |
| `src/lib/money.js` | Monedas USD, PEN (S/), BOB (Bs), VES (Bs.) y conversión con tipo de cambio editable |
| `src/views/Today.jsx` | Hoy · Mi Copiloto: KPIs, alertas inteligentes, agenda con checkboxes |
| `src/views/Pipeline.jsx` | Embudo Kanban con arrastrar y soltar, mover por botones y “Por ahora no” |
| `src/views/Clients.jsx` | Directorio con búsqueda, filtros, acciones rápidas e importación desde Excel (simulada) |
| `src/views/Planning.jsx` | Simulador de meta, meta por país y tablero de estrategia editable |
| `src/components/ClientDrawer.jsx` | Ficha del cliente + línea de tiempo (reemplaza las columnas STATUS 1, 2, 3 del Excel) |
| `src/components/Modals.jsx` | Nuevo trato, WhatsApp con plantillas, registrar llamada, pago mixto USD/moneda local, importar Excel, tipo de cambio |

Navegación por hash: `#hoy`, `#embudo`, `#clientes`, `#planeacion`.
