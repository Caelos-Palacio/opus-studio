# kit-libre

Kit basico para hacer animaciones `frame(ctx, t)` con node-canvas, sin aprender ningun motor. Pocas piezas, sin
dependencias salvo `canvas`, todo determinista (PRNG con semilla, nada de `Math.random` ni `Date`) y con auditorias
automaticas. Inspirado en el kit de Anatomy (MIT). Implementa las recetas de `docs/current/MODO-LIBRE.md` (secciones 2-7).
Es generico: nada de ninguna historia. `roughjs` y `perfect-freehand` no hacen falta: `trazoMano` es propio.

## Como empezar
1. `cd kit-libre && npm install` (Node 22, ffmpeg y fc-list en el PATH).
2. `cp -r plantilla mi-film` (dentro de `kit-libre/`, junto a `kit/`; los imports usan `../kit/`).
3. Edita `timeline.js` (escenas `{id,t0,dur}` y eventos `{t,tipo}`), `hechos.js` (cifras y textos reales) y `frame.js`.
4. `node mi-film/still.js` mira los stills (a mitad de escena y en cada cruce); `node kit/auditoria.mjs mi-film`.
5. `node mi-film/render.js --preview` (1/4 de tamano, 12 fps), luego `node mi-film/render.js` (final + audio + hoja).
6. `npm run preview` renderiza la plantilla; `node test.mjs` pasa las pruebas; `node muestra.mjs` rehace `muestra.jpg`.

Reglas: `frame(ctx,t)` es PURA (sin estado entre fotogramas); disena en 1920x1080 y escala con `ctx.canvas.width/1920`;
usa `conCamara` ANTES de escalar; las texturas pesadas se cachean solas (las cachean los materiales); fondo nunca plano.

## kit/base.mjs
- `hash(str)`: cadena a semilla uint32. `mulberry32(s)`: generador reproducible. `rng(s)`: igual, acepta numero o texto.
- `gauss(rnd)`: normal N(0,1). `valor(x,y,seed)`: ruido de valor 2D. `fbm(x,y,seed,oct)`: ruido fractal en [0,1].
- `lerp`, `clamp`, `smoothstep`: utilidades de interpolacion.
- `inOutCubic(t)`, `outBack(t,s)`, `outExpo(t)`: easings. `spring(t,zeta,omega)`: muelle amortiguado 0 a 1.
- `hexRgb`, `rgbHex`, `rgba(hex,a)`: conversiones de color. `aOklab`, `deOklab`: sRGB a OKLab y vuelta.
- `mezclar(c1,c2,k)`: mezcla hex en OKLab. `oscurecer(hex,k)`, `aclarar(hex,k)`: mezcla con negro o blanco.

## kit/materia.mjs
- `papel(ctx,W,H,{tono,fibra,seed})`: papel con fbm, fibras y vineta suave (cacheado).
- `acuarela(ctx,poligono,{color,capas,seed})`: lavado de 25-40 capas deformadas, borde oscuro y granulacion (cacheado).
- `deformar(pts,niveles,amp,rnd)`: subdivision recursiva de un poligono con desplazamiento gaussiano.
- `agua(ctx,W,H,t,{arriba,abajo,particulas,causticas})`: degradado, 2 nieblas en parallax, particulas y causticas.
- `vidrio(ctx,puntos,{tinte,alfa,refraccion})`: cuerpo translucido, brillos, fondo desplazado y borde variable.
- `tinta(ctx,x,y,r,lt,seed)`: mancha que se corre con radio `1-e^(-k lt)`, borde irregular y halo.
- `metal(ctx,x,y,r,{tono,desgaste,estrias,seed})`: disco metalico anisotropo con relieve y canto estriado (cacheado).
- `grano(ctx,W,H,frameIndex,alfa)`: grano de pelicula sembrado por fotograma con parpadeo de exposicion.
- `vineta(ctx,W,H,fuerza)`: oscurecimiento radial de bordes (cacheado). `limpiarCache()`: vacia las cachas.

## kit/formas.mjs
- `perfil(puntos,paso)`: puntos `[y,radio]` a perfil denso suave. `suavizar(pts,paso)`: Catmull-Rom remuestreado.
- `torno(ctx,perfil,{x,y,luz,tono,rot,estrias})`: cuerpo de revolucion (botella, jarra, moneda de canto) en 4 tonos con reflejo.
- `tubo(ctx,puntos,{grosor,variacion,seed,color,luz})`: cuerda o cable con grosor variable, sombra, luz y torsion.
- `catenaria(a,b,caida,n)`: puntos de una curva colgante entre a y b.
- `red(ctx,{x,y,w,h,cols,filas,seed,grosor})`: red de cuerdas irregulares con nudos; devuelve los nudos.
- `solido(ctx,plan,alto,tonos,{luz})`: extrusion de un poligono de planta con 4 bandas por cara y tapa clara.
- `sombraContacto(ctx,x,y,rx,{ry,alfa})`: sombra elíptica bajo un objeto apoyado.
- `trazoMano(ctx,puntos,{presion,seed,color,tam})`: trazo de pluma o lapiz con presion y temblor.

## kit/texto.mjs
- `registrarFuentes()`: busca con `fc-list` una serif y una mono, las registra como KitSerif y KitMono.
- `texto(ctx,str,x,y,{tam,peso,color,alinear,fondoVelo,mono,alfa})`: dibuja texto (y = borde superior) y devuelve su caja.
- `cifrasTabulares(ctx,numero,x,y,opts)`: numero con digitos en celdas de ancho fijo; devuelve la caja.
- `escribirse(str,lt,{cps,pausa})`: parte de `str` escrita tras `lt` segundos. `contraste(c1,c2)`: razon WCAG (>= 4.5).

## kit/camara.mjs
- `conCamara(ctx,t,plano,fn,{empuje,dur,deriva,seed})`: empuje lento, microderiva y parallax (`fondo` x0.3, `medio` x0.7, `sujeto` x1).
- `desenfoque(ctx,t,fn,{n,obtura})`: desenfoque de movimiento promediando n submuestras de `fn(ctx,t)`.

## kit/render.mjs
- `renderizar({modulo,W,H,fps,dur,escala,salida,audio,procesos})`: N-1 procesos escriben rawvideo a ffmpeg; concat y audio.
- `hojaContacto(mp4,salida,{n,cols,ancho})`: hoja jpg de 12 fotogramas del mp4.

## kit/audio.mjs (wav PCM 16-bit, 48 kHz, estereo)
- `pista(dur)`: pista vacia. `mezcla(pistas)`: las suma. `nivelar(p,{rmsDb})`: ajusta el nivel.
- `cama(p,opts)`: ruido pasa-bajos con LFO lento que no se corta. `reverb(p,{tau,mezcla,grave})`: convolucion con IR sintetica.
- Voces: `gota`, `papel`, `clic`, `moneda`, `golpe` `(p,t,{pan,gan,seed})`; `piano(p,t,midi,opts)`; `pad(p,t,dur,notas,opts)`.
- `ducking(p,eventos,{db})`: baja la musica durante los eventos. `convolucion(x,ir)`: convolucion por FFT.
- `limitador(p,{techo})`: limitador suave a -3 dBTP. `picoVerdadero(p)`: pico verdadero en dB.
- `escribirWav(p,ruta)`: guarda el wav. `medir(archivo)`: `{I,TP,LRA}` con ffmpeg ebur128 (usalo sobre el mp4 final).
- `componer(eventos,dur,{cama,tau,grave,notas,pads})`: audio completo desde los eventos del timeline.

## kit/auditoria.mjs
- `textoTapado(cajasTexto,cajasObjetos)`: intersecciones texto/objeto. `ocupacion(canvas)`: fraccion del cuadro con sujeto.
- `vacio(canvas)`: detecta cuadros planos o sin detalle. `determinismo(frameFn,ts)`: md5 doble.
- `zoom4x(canvas,regiones,dir)`: guarda recortes ampliados x4.
- CLI `node kit/auditoria.mjs <proyecto> [--escala .5] [--mp4 f.mp4]`: informe y codigo de salida 1 si hay fallos graves
  (determinismo, cuadro vacio, texto tapado, pico > -1 dBTP). El proyecto exporta `escenas` (timeline.js) y `frame`, `W`, `H`, `cajas(t)` (frame.js).
