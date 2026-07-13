# Alfa Tours — Sitio web

Sitio web estático de **Transportes Turísticos Alfa Tours** (alfatours.mx).
Hecho con HTML, CSS y JavaScript puro — se publica en GitHub Pages y se actualiza por commits.

## Estructura
```
├── index.html          Inicio
├── servicios.html      Servicios
├── flota.html          Flota
├── nosotros.html       Nosotros
├── contacto.html       Contacto
├── css/styles.css      Estilos (paleta y tipografía de marca)
├── js/main.js          Menú móvil y utilidades
├── img/                Logo e imágenes de unidades (ver MANIFIESTO-IMAGENES.md)
├── CNAME               Dominio personalizado (alfatours.mx)
├── robots.txt          SEO
└── sitemap.xml         SEO
```

## Cómo publicar y conectar el dominio y los correos
Ver **[GUIA-DESPLIEGUE.md](GUIA-DESPLIEGUE.md)** — paso a paso de GitHub Pages, DNS en
Cloudflare y correos `@alfatours.mx` reenviados a Gmail.

## Ver el sitio en local
Abre `index.html` en el navegador, o levanta un servidor simple:
```bash
python3 -m http.server 8080
# luego abre http://localhost:8080
```
