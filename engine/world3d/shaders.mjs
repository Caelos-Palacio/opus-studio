// Sombreadores del backend GL (WebGL 1 / GLSL ES 1.00). Todo el cálculo es en sRGB "dibujado" (sin flujo lineal ni PBR):
// el estilo manda sobre el 3D. Cada objeto es un InstancedMesh (matriz TRS por instancia + color por instancia).
//   MODE 0 plano (sin luz) · 1 toon (bandas) · 2 soft (lambert envolvente) · 3 ink (hatching en pantalla)
//   HULL: pase de contorno (caras traseras ensanchadas uHullPx píxeles hacia fuera en pantalla; grosor constante)
export const VERT = /* glsl */ `
precision highp float;
varying vec3 vN; varying vec3 vC; varying float vDepth;
#ifdef WORLD
varying vec3 vW; varying vec3 vNW; varying vec3 vVP; varying float vAOH; varying vec3 vLoc; varying vec3 vSc;
#endif
uniform vec2 uRes; uniform float uHullPx;
void main() {
  vec3 p = position; vec3 n = normal; vec3 hn = normalize(position);
  vC = vec3(1.0);
  #ifdef USE_INSTANCING_COLOR
    vC = instanceColor;
  #endif
  vec3 s2 = vec3(1.0);
  #ifdef USE_INSTANCING
    mat3 m3 = mat3(instanceMatrix);
    s2 = vec3(dot(m3[0], m3[0]), dot(m3[1], m3[1]), dot(m3[2], m3[2]));
    n = m3 * (n / s2); hn = m3 * hn;
    p = (instanceMatrix * vec4(p, 1.0)).xyz;
  #endif
  vec4 mv = modelViewMatrix * vec4(p, 1.0);
  vN = normalize(normalMatrix * n);
  vDepth = -mv.z;
  #ifdef WORLD
    vW = p; vNW = normalize(n); vVP = mv.xyz; vLoc = position; vSc = sqrt(s2);
    #ifdef USE_INSTANCING
      vAOH = max(1e-4, 0.2 * sqrt(s2.y));
    #else
      vAOH = 0.5;
    #endif
  #endif
  vec4 clip = projectionMatrix * mv;
  #ifdef HULL
    vec3 hv = normalize(normalMatrix * hn);
    vec2 d = vec2(projectionMatrix[0][0] * hv.x, projectionMatrix[1][1] * hv.y);   // dirección en pantalla (sin el desplazamiento de lente de la cámara derivada del shot)
    float dl = length(d); d = dl > 1e-5 ? d / dl : vec2(0.0);
    clip.xy += d * (uHullPx * 2.0 / uRes) * clip.w;
  #endif
  gl_Position = clip;
}`;

export const FRAG = /* glsl */ `
precision highp float;
varying vec3 vN; varying vec3 vC; varying float vDepth;
#ifdef WORLD
varying vec3 vW; varying vec3 vNW; varying vec3 vVP; varying float vAOH; varying vec3 vLoc; varying vec3 vSc;
#endif
uniform vec3 uL; uniform vec3 uInk; uniform vec3 uLine; uniform vec3 uBg; uniform vec3 uFogC;
uniform float uFogD; uniform float uBands; uniform float uSnap; uniform float uHatch; uniform float uShadowMix; uniform float uMask;
uniform vec2 uRes;
uniform vec3 uPal[8];
#ifdef GRAD
uniform vec3 uGrad[8]; uniform float uGradN;
#endif
#ifdef SHADOW
uniform sampler2D uShT; uniform mat4 uShM; uniform vec4 uShP;   // x: tamaño de texel, y: sesgo de profundidad, z: sesgo por normal (mundo), w: radio PCF (texeles)
uniform float uShStr;
float unpackD(vec4 c) { return dot(c, vec4(1.0, 1.0 / 255.0, 1.0 / 65025.0, 1.0 / 16581375.0)); }
// 1 = iluminado, 0 = en sombra. PCF 3×3 sobre el mapa de profundidad (empaquetada en RGBA8: headless-gl no tiene texturas de profundidad).
float shadowTerm(vec3 wp, vec3 nw) {
  vec3 q = (uShM * vec4(wp + nw * uShP.z, 1.0)).xyz * 0.5 + 0.5;
  if (q.x <= 0.0 || q.x >= 1.0 || q.y <= 0.0 || q.y >= 1.0 || q.z >= 1.0) return 1.0;
  float r = uShP.w * uShP.x, s = 0.0, b = q.z - uShP.y;
  for (int i = -1; i <= 1; i++) for (int j = -1; j <= 1; j++) s += step(b, unpackD(texture2D(uShT, q.xy + vec2(float(i), float(j)) * r)));
  float e = min(min(q.x, 1.0 - q.x), min(q.y, 1.0 - q.y));
  return mix(1.0, s / 9.0, smoothstep(0.0, 0.05, e));
}
#endif
#ifdef GROUND
uniform vec3 uBright; uniform vec3 uDark; uniform float uGroundLit; uniform vec3 uPool; uniform float uShA;
#endif
#ifdef AO
uniform float uAO; uniform float uGY;
#endif
#ifdef RIM
uniform vec3 uRimC; uniform float uRimS; uniform float uRimPx; uniform float uPxU;
#endif
// color del fondo a la altura del fragmento: plano, o muestreo del degradado vertical (niebla = lo que hay detrás, no un color fijo)
vec3 fogCol() {
  #ifdef GRAD
    float f = clamp(1.0 - gl_FragCoord.y / uRes.y, 0.0, 1.0) * (uGradN - 1.0);
    vec3 c = uGrad[0];
    for (int k = 0; k < 7; k++) { if (float(k) < uGradN - 1.0) c = mix(c, mix(uGrad[k], uGrad[k + 1], clamp(f - float(k), 0.0, 1.0)), step(float(k), f + 1e-4)); }
    return c;
  #else
    return uFogC;
  #endif
}
// Cuantización SUAVE a la paleta: se acerca al color más cercano con fuerza uSnap, pero se relaja donde dos colores de la
// paleta están casi a la misma distancia (degradados de niebla/sombra): sin escalones duros ni posterización.
vec3 snapPal(vec3 c) {
  vec3 best = uPal[0]; float d1 = 1e9, d2 = 1e9;
  for (int i = 0; i < 8; i++) {
    vec3 q = uPal[i]; float rm = 0.5 * (c.r + q.r); vec3 d = c - q;
    float dd = sqrt((2.0 + rm) * d.r * d.r + 4.0 * d.g * d.g + (3.0 - rm) * d.b * d.b);
    if (dd < d1) { d2 = d1; d1 = dd; best = q; } else if (dd < d2 && dd > d1 + 1e-4) { d2 = dd; }
  }
  float clear = smoothstep(0.0, 0.35, d2 - d1);
  return mix(c, best, uSnap * clear);
}
void main() {
  vec3 base = vC, col = base;
  float fogK = 1.0 - exp(-pow(uFogD * vDepth, 2.0));
  #ifdef HULL
    col = uLine;
    col = mix(col, fogCol(), fogK * 0.85);
    if (uMask > 0.5) col = vec3(0.0);
    gl_FragColor = vec4(col, 1.0);
  #elif defined(GROUND)
    // suelo receptor: ilumina (charco de luz alrededor del sujeto) y recibe la sombra proyectada; en modo «catcher» solo dibuja la sombra con alfa
    float sh = shadowTerm(vW, vec3(0.0, 1.0, 0.0));
    #ifdef HARD
      sh = smoothstep(0.30, 0.70, sh);
    #endif
    #ifdef CATCH
      float ac = (1.0 - sh) * uShA * (1.0 - fogK);
      gl_FragColor = vec4(uMask > 0.5 ? vec3(0.0) : uDark, uMask > 0.5 ? 0.0 : ac);
    #else
      vec2 dp = vW.xz - uPool.xy;
      float pool = exp(-dot(dp, dp) / (uPool.z * uPool.z));       // charco de luz alrededor del sujeto; lejos el suelo vuelve a su color (sin costura con el suelo 2D)
      vec3 litc = mix(base, uBright, uGroundLit * pool), shc = mix(base, uDark, 0.6);
      col = mix(litc, shc, (1.0 - sh) * uShA);
      #ifdef GRAD
        col = snapPal(col); col = mix(col, fogCol(), fogK);
      #else
        col = mix(col, uFogC, fogK); col = snapPal(col);
      #endif
      if (uMask > 0.5) col = vec3(0.0);
      gl_FragColor = vec4(col, 1.0);
    #endif
  #else
    vec3 shade = mix(base, uBg, uShadowMix), hi = mix(base, uInk, 0.32);
    #if MODE > 0
      vec3 n = normalize(vN); if (!gl_FrontFacing) n = -n;
      float ndl = dot(n, uL);
      float occ = 1.0;
      #ifdef SHADOW
        vec3 nw = normalize(vNW); if (!gl_FrontFacing) nw = -nw;
        float sh = shadowTerm(vW, nw);
        #ifdef HARD
          sh = smoothstep(0.30, 0.70, sh);
        #endif
        occ *= 1.0 - uShStr * (1.0 - sh) * smoothstep(-0.1, 0.25, ndl);
      #endif
      #ifdef AO
        occ *= 1.0 - uAO * exp(-max(vW.y - uGY, 0.0) / vAOH);
      #endif
    #endif
    #if MODE == 1
      float lit = clamp((ndl * 0.5 + 0.5) * occ, 0.0, 0.9999);
      float lv = min(floor(lit * uBands) / max(1.0, uBands - 1.0), 1.0);
      col = mix(shade, base, lv);                                     // bandas: del tono de sombra al color pleno (sin brillo extra)
    #elif MODE == 2
      float lit = clamp((ndl * 0.5 + 0.55) * occ, 0.0, 1.0);
      col = lit < 0.7 ? mix(shade, base, smoothstep(0.0, 0.7, lit)) : mix(base, hi, smoothstep(0.7, 1.0, lit) * 0.6);
    #elif MODE == 3
      float lit = clamp((ndl * 0.5 + 0.5) * occ, 0.0, 1.0), dk = 1.0 - lit;
      float a = fract((gl_FragCoord.x + gl_FragCoord.y) / uHatch), b = fract((gl_FragCoord.x - gl_FragCoord.y) / uHatch);
      float l1 = step(0.5, a) * step(0.30, dk), l2 = step(0.5, b) * step(0.62, dk);
      col = mix(base, uInk, clamp(max(l1, l2) * 0.85, 0.0, 1.0));
      col = mix(col, shade, step(0.85, dk) * 0.5);
    #endif
    #if defined(RIM) && MODE > 0
      // luz de borde (color de acento) en el lado que da la espalda a la luz clave: separa el volumen del fondo.
      // RIMK 2 (cajas): banda de uRimPx píxeles en las aristas de la cara; RIMK 1/3 (curvos): fresnel (3: solo la pared, no las tapas).
      float rm = 0.0;
      #if RIMK == 2
        vec3 dd = (0.5 - abs(vLoc)) * vSc;
        float d2 = dd.x + dd.y + dd.z - min(dd.x, min(dd.y, dd.z)) - max(dd.x, max(dd.y, dd.z));
        rm = 1.0 - smoothstep(uRimPx * 0.7, uRimPx, d2 * uPxU / max(vDepth, 1e-3));
      #else
        float fr = 1.0 - clamp(dot(n, normalize(-vVP)), 0.0, 1.0);
        #if MODE == 1
          rm = step(0.62, fr);
        #else
          rm = smoothstep(0.5, 0.95, fr);
        #endif
        #if RIMK == 3
          rm *= 1.0 - step(0.7, abs(normalize(vNW).y));
        #endif
      #endif
      col = mix(col, uRimC, rm * smoothstep(0.35, -0.2, ndl) * uRimS);
    #endif
    #ifdef GRAD
      col = snapPal(col); col = mix(col, fogCol(), fogK);
    #else
      col = mix(col, uFogC, fogK); col = snapPal(col);
    #endif
    #ifdef EMIS
      if (uMask > 0.5) col = base * (1.0 - fogK); 
    #else
      if (uMask > 0.5) col = vec3(0.0);
    #endif
    gl_FragColor = vec4(col, 1.0);
  #endif
}`;

// Sombra de contacto: disco blando bajo la base (instanciado). Alfa radial, atenuado por la niebla.
export const DECAL_VERT = /* glsl */ `
precision highp float;
varying vec2 vUv; varying float vDepth;
void main() {
  vUv = uv; vec3 p = position;
  #ifdef USE_INSTANCING
    p = (instanceMatrix * vec4(p, 1.0)).xyz;
  #endif
  vec4 mv = modelViewMatrix * vec4(p, 1.0); vDepth = -mv.z; gl_Position = projectionMatrix * mv;
}`;
export const DECAL_FRAG = /* glsl */ `
precision highp float;
varying vec2 vUv; varying float vDepth;
uniform vec3 uShadowC; uniform float uShadowA; uniform float uFogD; uniform float uMask;
void main() {
  if (uMask > 0.5) discard;
  float r = length(vUv * 2.0 - 1.0);
  float a = (1.0 - smoothstep(0.15, 1.0, r)) * uShadowA;
  a *= exp(-pow(uFogD * vDepth, 2.0));
  gl_FragColor = vec4(uShadowC, a);
}`;

// Resolución: promedio SSAA por filtrado bilineal del destino (2× exacto con una muestra en el centro del píxel).
export const QUAD_VERT = /* glsl */ `
varying vec2 vUv;
void main() { vUv = uv; gl_Position = vec4(position.xy, 0.0, 1.0); }`;
export const QUAD_FRAG = /* glsl */ `
precision highp float;
varying vec2 vUv; uniform sampler2D tMap;
void main() { gl_FragColor = texture2D(tMap, vUv); }`;

// Pase de sombra: profundidad lineal (ortográfica) empaquetada en RGBA8 (sin texturas de profundidad en WebGL1/headless-gl).
export const SHADOW_VERT = /* glsl */ `
precision highp float;
void main() {
  vec3 p = position;
  #ifdef USE_INSTANCING
    p = (instanceMatrix * vec4(p, 1.0)).xyz;
  #endif
  gl_Position = projectionMatrix * (modelViewMatrix * vec4(p, 1.0));
}`;
export const SHADOW_FRAG = /* glsl */ `
precision highp float;
void main() {
  vec4 e = fract(gl_FragCoord.z * vec4(1.0, 255.0, 65025.0, 16581375.0));
  e -= e.yzww * vec4(1.0 / 255.0, 1.0 / 255.0, 1.0 / 255.0, 0.0);
  gl_FragColor = e;
}`;

// Fondo con degradado vertical (cuando el fondo de la escena no es plano): se pinta antes que la geometría.
export const BG_VERT = /* glsl */ `
varying vec2 vUv;
void main() { vUv = uv; gl_Position = vec4(position.xy, 0.9999, 1.0); }`;
export const BG_FRAG = /* glsl */ `
precision highp float;
varying vec2 vUv; uniform vec3 uGrad[8]; uniform float uGradN;
void main() {
  float f = clamp(1.0 - vUv.y, 0.0, 1.0) * (uGradN - 1.0);
  vec3 c = uGrad[0];
  for (int k = 0; k < 7; k++) { if (float(k) < uGradN - 1.0) c = mix(c, mix(uGrad[k], uGrad[k + 1], clamp(f - float(k), 0.0, 1.0)), step(float(k), f + 1e-4)); }
  gl_FragColor = vec4(c, 1.0);
}`;
