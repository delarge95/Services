# Services — Cotizador interactivo de servicios 3D

Cotizador web para clientes freelance: wizard guiado por árbol de decisión, previews WebGL en vivo (HolyBro X500 real, yunque con morph targets), motor de precios por variables y panel de configuración con re-precio en vivo.

Stack: Astro 5 + React 19 + three.js. Desplegado en GitHub Pages.

## Desarrollo

```bash
npm install
npm run dev        # http://127.0.0.1:4321/cotizador
```

## Verificación

```bash
npm test           # vitest: mapeo árbol → cotización
npm run check      # astro check (0 errores)
```

## Estructura

| Ruta | Rol |
|---|---|
| `src/pages/cotizador.astro` | Página de entrada |
| `src/components/services/` | UI: wizard, previews WebGL, panel de config |
| `src/data/services/` | Árbol de decisión, catálogo, motor de precios, i18n ES/EN |
| `src/lib/services/` | Resúmenes de cotización, tests |
| `public/cotizador/models/` | GLBs (HolyBro X500, yunque con shape keys) |

## Deploy

GitHub Pages vía `.github/workflows/deploy.yml` (push a `main`). El build usa `base: /Services/` cuando corre en Actions.
