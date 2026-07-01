# Guía de uso de Graphify (Claude Code)

> Graphify convierte este repo en un grafo de conocimiento consultable, para que Claude Code
> conteste preguntas sobre la arquitectura leyendo el grafo en vez de recorrer archivo por
> archivo con Grep/Read cada vez — eso es lo que ahorra tokens.

Instalado en esta máquina en: `C:\Users\T14\.local\bin\graphify.exe`
Skill registrado en: `C:\Users\T14\.claude\skills\graphify\`

---

## 1. Cómo correrlo por primera vez (o de nuevo, borraste el grafo anterior)

Dentro de una sesión de Claude Code, parado en la raíz del proyecto (`EditMaster`), escribí:

```
/graphify .
```

Esto va a:
1. Escanear el repo (código, docs, SQL, etc.).
2. Extraer estructura del código (AST — gratis, sin tokens de LLM).
3. Extraer significado de docs/papers/imágenes si los hay (esto sí usa tokens, vía subagentes).
4. Construir el grafo, detectar comunidades (módulos relacionados), y generar:
   - `graphify-out/graph.json` — el grafo en sí (lo que se consulta después)
   - `graphify-out/GRAPH_REPORT.md` — reporte legible con nodos importantes, conexiones sorprendentes, preguntas sugeridas
   - `graphify-out/graph.html` — visualización interactiva (abrí en el navegador)

Al final te muestra los "God Nodes" (piezas centrales del código), conexiones sorprendentes, y te ofrece explorar una pregunta interesante. Podés decir que sí o seguir de largo.

**Costo:** la primera construcción gasta tokens (una vez). Las consultas posteriores son baratas.

---

## 2. Cómo usarlo día a día (consultar el grafo ya construido)

Una vez que existe `graphify-out/graph.json`, en vez de pedirle a Claude que "busque en todo el código", usá:

```
/graphify query "¿cómo funciona el flujo de pago con Mercado Pago?"
/graphify query "¿qué archivos dependen de InscripcionPage?"
/graphify path "MercadoPago" "Supabase"
/graphify explain "webhook-mercado-pago"
```

- `query` → recorre el grafo (BFS) y responde con contexto acotado, en vez de grep sobre todo el repo.
- `path` → camino más corto entre dos conceptos/módulos (útil para entender dependencias).
- `explain` → explicación de un nodo puntual en lenguaje simple.

Si le preguntás algo de arquitectura a Claude directamente ("¿cómo está armado el login?", "¿dónde se procesa X?"), el skill ya está configurado para consultar el grafo primero automáticamente, antes de leer archivos sueltos.

---

## 3. Cómo mantenerlo actualizado (sin gastar de más)

**No hace falta correrlo todos los días ni en cada guardado de archivo.** Es por evento, no por reloj:

| Situación | Qué correr |
|---|---|
| Cambiaste unos pocos archivos | `/graphify . --update` (incremental — solo re-extrae lo que cambió) |
| Terminaste una sesión de trabajo / hiciste commit | Ideal para correr `--update` acá |
| Reestructuraste todo el proyecto | `/graphify .` completo de nuevo |
| Solo querés reclusterizar sin re-extraer | `/graphify . --cluster-only` |

**Opción recomendada para no pensarlo más:** instalar el hook de git post-commit que trae el skill, así se actualiza solo después de cada commit:

```
Pedile a Claude Code: "instalá el hook de post-commit de graphify"
```

Alternativa para sesiones largas de código activo, sin usar tokens de LLM en cada cambio:

```
/graphify . --watch
```

---

## 4. Guardar tu código con Git (aparte de graphify)

Importante: **graphify NO reemplaza a git.** Graphify guarda un mapa/índice de tu código para que la IA lo entienda más rápido; **no** es backup ni control de versiones. Seguí commiteando tu código normalmente:

```bash
git add .
git commit -m "mensaje"
git push
```

`graphify-out/` **no se sube a git** (está pensado como carpeta local regenerable, similar a `dist/` o `node_modules/`). Si querés asegurarte de que nunca aparezca como "cambio pendiente", agregá esto a tu `.gitignore`:

```
graphify-out/
.graphifyignore
```

---

## 5. Resumen de comandos

```
/graphify .                          # construir grafo completo desde cero
/graphify . --update                 # actualizar solo lo que cambió (recomendado día a día)
/graphify . --cluster-only           # re-agrupar comunidades sin re-extraer
/graphify query "<pregunta>"         # preguntar sobre el código usando el grafo
/graphify path "<A>" "<B>"           # camino/relación entre dos conceptos
/graphify explain "<concepto>"       # explicación puntual de un nodo
/graphify . --no-viz                 # construir sin generar el HTML (más rápido)
```

---

## 6. Si algo se rompe

- Si borraste `graphify-out/` sin querer: no pasa nada, solo corré `/graphify .` de nuevo.
- Si `graphify` no se reconoce en una terminal nueva: cerrá y abrí la terminal (el PATH se actualizó, pero necesita una sesión nueva).
- Si el grafo quedó desactualizado y las respuestas no tienen sentido: `/graphify . --update`.
