# kit-libre

Kit (v3) para hacer animaciones `frame(ctx, t)` con node-canvas, sin aprender ningun motor. Pocas piezas, sin
dependencias salvo `canvas`, todo determinista (PRNG con semilla, nada de `Math.random` ni `Date`) y con auditorias
automaticas. Inspirado en el kit de Anatomy (MIT). Implementa las recetas de `docs/current/MODO-LIBRE.md` (secciones 2-7).
Es generico: nada de ninguna historia. `roughjs` y `perfect-freehand` no hacen falta: `trazoMano` es propio.
La v2 sale de dos pruebas con un modelo pequeno: objetos diminutos, monedas esfericas, mapas dibujados a mano, fundidos cruzados, texto que se sale de su tarjeta.
Por eso hay objetos por piezas, costas reales, transiciones motivadas y una auditoria que SUSPENDE (codigo 1) esos fallos.

## Gramaticas: el MEDIO se elige por tema (v3)
El kit ya no tiene un solo gusto. Una gramatica es un medio completo y coherente (soporte, trazo, texto, acento, post y corte propio); se ELIGE segun el tema,
ninguna es la de por defecto, y mezclarlas en un mismo plano rompe la coherencia. `import { elegir } from '../kit/gramaticas/index.mjs'; const G = elegir('neon', { a1: '#ffb000' })`
(paleta opcional: `neutro`, `tinta`, `a1`, `a2`). API comun: `G.soporte(ctx,W,H,t,opts)`, `G.trazo(ctx,puntos,opts)`, `G.texto(ctx,str,x,y,opts)`, `G.acento(ctx,caja,{u})`,
`G.post(ctx,W,H,frameIndex)`, `G.transicion(ctx,u,A,B)`. Cada una es reconocible a 1x en un solo fotograma (`muestra-gramaticas.jpg`, `node muestra-gramaticas.mjs`).
- **neon** (`kit/gramaticas/neon.mjs`): luz sobre ladrillo humedo; tubos con halo, parpadeo, desregistro y encendido por tramos; rotulo de tubo; acento = un tubo que se enciende; corte = apagon. SI: noche, ciudad, musica, tension; NO: texto largo, datos finos, calidez o historia solemne.
- **tiza** (`kit/gramaticas/tiza.mjs`): pizarra con polvo, borrones y fantasmas; trazo con grano y presion irregular; letra de pizarra (mono de respaldo); acento = subrayado o circulo; corte = borrado. SI: explicar, aprender, procesos, humor; NO: lujo, precision tecnica, drama nocturno.
- **papel** (`kit/gramaticas/papel.mjs`): papel con fibra, pluma, acuarela y serif (el estilo de la v1/v2, extraido); acento = lavado de acuarela; corte = mancha de tinta. SI: historia, cartas, viajes, memoria; NO: tecnologia, ritmo rapido, noche urbana.
Las piezas de materia (`materia`, `formas`, `objetos`, `mapa`) siguen siendo de papel/acuarela: con otra gramatica usa `G.*` y figuras de trazo (`FARO` en `comun.mjs` es un ejemplo), no objetos fotorrealistas. `escena-generica.mjs` dibuja la misma escena en cualquiera.

## Como empezar
1. `cd kit-libre && npm install` (Node 22, ffmpeg y fc-list en el PATH).
2. `cp -r plantilla mi-film` (dentro de `kit-libre/`, junto a `kit/`; los imports usan `../kit/`). Elige el medio con `GRAMATICA=neon|tiza|papel` (sin ella, `tiza`) o fijalo en `frame.js`.
3. Edita `timeline.js` (escenas `{id,t0,dur,sujeto|ocupacion_ok}` y eventos `{t,tipo}`), `hechos.js` (cifras y textos reales) y `frame.js`.
4. `node mi-film/still.js` mira los stills (a mitad de escena y en cada cruce); `node kit/auditoria.mjs mi-film`.
5. `node mi-film/render.js --preview` (1/4 de tamano, 12 fps), luego `node mi-film/render.js` (final + audio + hoja).
6. `GRAMATICA=neon npm run preview` renderiza la plantilla; `node test.mjs` pasa las pruebas; `node muestra.mjs` rehace `muestra.jpg`.

Reglas: `frame(ctx,t)` es PURA (sin estado entre fotogramas); disena en 1920x1080 y escala con `ctx.canvas.width/1920`;
usa `conCamara` ANTES de escalar; las texturas pesadas se cachean solas (las cachean los materiales); fondo nunca plano.
v2: el sujeto de cada plano ocupa >= 30 % del cuadro; el texto va dentro de su contenedor (`textoEn`) y con contraste >= 4,5:1; los cortes son transiciones
motivadas (ver `plantilla/frame.js`: la mancha de tinta del sobre revela el mapa y el agua sube del mapa al mar); los objetos principales salen de `objetos.mjs`.

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
- `tinta(ctx,x,y,r,lt,seed)`: mancha que se corre con radio `1-e^(-k lt)`, borde irregular, halo y tentaculos continuos que se afinan.
- `metal(ctx,x,y,r,{tono,desgaste,estrias,seed})`: disco metalico anisotropo con relieve y canto estriado (cacheado).
- `grano(ctx,W,H,frameIndex,alfa)`: grano de pelicula sembrado por fotograma con parpadeo de exposicion.
- `vineta(ctx,W,H,fuerza)`: oscurecimiento radial de bordes (cacheado). `limpiarCache()`: vacia las cachas.

## kit/formas.mjs
- `perfil(puntos,paso)`: puntos `[y,radio]` a perfil denso suave. `suavizar(pts,paso)`: Catmull-Rom remuestreado.
- `torno(ctx,perfil,{x,y,luz,tono,rot,estrias,reflejo})`: cuerpo de revolucion (jarra, esfera, columna) con sombreado CONTINUO por pixel (normal, difusa, rebote, brillo; cacheado). Una esfera sale esfera, no pelota de playa.
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
- `escribirse(str,lt,{cps,pausa})`: parte de `str` escrita tras `lt` s. Con `{ctx,x,y,alinear,...texto}` TAMBIEN la dibuja con ancla estable por linea (el texto centrado no se mueve al escribirse) y devuelve la caja del texto completo.
- `ajustarTexto(str,ancho,alto,{tam,min})` parte en lineas y baja el cuerpo hasta caber. `textoEn(ctx,str,{x,y,w,h},opts)` lo dibuja DENTRO de un contenedor y devuelve la caja con `contenedor` (la auditoria la vigila).
- `contraste(c1,c2)`: razon WCAG (>= 4.5). `texto()` devuelve `{x,y,w,h,color,tam,alfa}`.

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

## kit/objetos.mjs (objetos por piezas; cada uno >= 10, devuelve `{piezas,caja}`; centrados en x,y con `rot`)
- `botella({alto,rot,lleno,corcho,lastre,tarjetaDentro,algas,tono,sombra,t,seed})`: vidrio con labio, cuello, hombro, pared con espesor, fondo grueso,
  agua con menisco (siempre horizontal aunque gires la botella), grava, rollo de papel con cordel, corcho, burbujas, algas y dos reflejos.
- `moneda({r,cara:'perfil'|'escudo',leyenda,desgaste,canto,giro,tono,luz,grosor})`: relieve por mapa de alturas + luz direccional, busto con pelo recogido, corona de laurel y cinta, leyenda circular,
  perlas, patina; `giro` 0 (frente) a PI/2 (de canto: banda estriada, nunca una esfera).
- `sobre({w,abierto,sello})`: solapa que gira, lacre que se rompe, carta que asoma. `tarjeta({w,h,lineas,sello,doblez})`: texto ajustado dentro (devuelve `textos`).
- `sello({tam,texto,golpe,almohadilla})` (>= 10 piezas siempre): baja, toca hacia 0.45 y deja la huella. `lupa({r,ang,aumento})`: amplia de verdad lo que hay debajo.

## kit/transiciones.mjs: `(ctx,u,dibujarA,dibujarB,opts)`, PURAS en u; u<=0 = A, u>=1 = B
Usan el tamano del canvas (pasales el ctx SIN escalar y que `dibujarA/B` escalen). Coordenadas de opts normalizadas 0..1. Elige por MOTIVO, no por gusto:
- `revelarTinta({origen,color})`: hay una mancha (tinta, agua, vino) en A; crece y por dentro aparece B. Cambio de lugar con derrame.
- `barridoObjeto({objeto,dir,ancho})`: un objeto (barco, mano, ola; por defecto una brocha con cerdas y cola seca) cruza y su cuerpo tapa el corte; `objeto(g,{x,y,w,h,dir,vert})` lo pinta.
- `papelQueSube({papel})`: B es un documento, mapa o pagina; entra desde abajo con sombra. De la accion a la informacion.
- `cortinaAgua({modo:'sube'|'baja',color})`: escenas marinas, llanto, inmersion o recuerdo; superficie ondulada, B refractado.
- `zoomA({foco:{x,y,r},forma:'circulo'|'marco'})`: A tiene un detalle (ojo de buey, moneda, ventana) que es la puerta a B.
- `corteEco({a,b,forma})`: una forma de A (disco, rectangulo) tiene la misma forma en B; el resto se apaga y la forma viaja. Corte por analogia.

## kit/mapa.mjs + kit/datos/costas.json (Natural Earth 1:50m, dominio publico, 86 KB; solo lon -25..30, lat 35..72)
- `encuadre({lon0,lat0,lon1,lat1},W,H,{modo})`, `proyectar(lon,lat,enc)`, `invertir(x,y,enc)`: Mercator. Fuera de la region no hay datos.
- `dibujarCostas(ctx,enc,{estilo:'acuarela'|'tinta'|'grabado',seed,mar,tierra,tinta})`: tierra en lavados, costa de grosor variable (cacheado). `graticula(ctx,enc)`.
- `marcador(ctx,{x,y,nombre},{u,esc})` (chincheta que cae; devuelve cajas), `ruta(ctx,a,b,u,{arco,esc})` (trazo discontinuo con punta). `esc` = tamano relativo a 1920.
- Regenerar datos: `curl -o /tmp/land.json https://raw.githubusercontent.com/nvkelso/natural-earth-vector/master/geojson/ne_50m_land.geojson`
  y `node herramientas/costas-build.mjs /tmp/land.json`. Sin red, el JSON incluido sigue valiendo.

## kit/auditoria.mjs: FALLOS GRAVES (codigo 1)
- `ocupacionSujeto`: el sujeto DECLARADO de cada plano debe ocupar >= 30 % del cuadro. Declara `cajas(t).sujeto` (frame.js) o `escena.sujeto`;
  un plano general intencionado lleva `ocupacion_ok:{porque:'...'}` (12+ letras). Sin ninguna de las dos, falla. Tambien falla si la caja esta vacia o fuera del cuadro.
- `textoDesbordado`: una caja de texto con `contenedor` que se sale de el, o texto fuera del cuadro. Usa `textoEn` y no pasara.
- `contrasteCaja`: contraste del color del texto contra el fondo REAL renderizado (anillo + pixeles vecinos); mediana < 4,5:1 falla (decil peor < 3 avisa). Con `alfa` < 1 se mide el color EFECTIVO (mezcla con el fondo); solo se ignora el texto casi invisible (alfa < 0,1).
- Tambien: `textoTapado(cajasTexto,cajasObjetos)`, `vacio(canvas)`, `determinismo(frameFn,ts)`, `ocupacion(canvas)` (pixeles distintos del fondo; informativa),
  `zoom4x(canvas,regiones,dir)`, `auditarCuadro({canvas,cajas,escena,W,H})` (las tres comprobaciones sobre un cuadro) y pico verdadero > -1 dBTP con `--mp4`.
- CLI `node kit/auditoria.mjs <proyecto> [--escala .5] [--mp4 f.mp4]`: informe por escena (`ok`, `aviso`, `FALLO`). El proyecto exporta `escenas` (timeline.js) y
  `frame`, `W`, `H`, `cajas(t)` -> `{texto:[{id,x,y,w,h,color,tam,alfa,contenedor?}],objetos:[...],sujeto}` (frame.js), todo en coordenadas de 1920x1080.
