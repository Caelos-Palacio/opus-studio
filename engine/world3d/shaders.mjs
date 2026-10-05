// Sombreadores del backend GL (WebGL 1 / GLSL ES 1.00). Todo el cálculo es en sRGB "dibujado" (sin flujo lineal ni PBR):
// el estilo manda sobre el 3D. Cada objeto es un InstancedMesh (matriz TRS por instancia + color por instancia).
//   MODE 0 plano (sin luz) · 1 toon (bandas) · 2 soft (lambert envolvente) · 3 ink (hatching en pantalla)
//   HULL: pase de contorno (caras traseras ensanchadas uHullPx píxeles hacia fuera en pantalla; grosor constante)
export const VERT = /* glsl */ `
precision highp float;
varying vec3 vN; varying vec3 vC; varying float vDepth;
uniform vec2 uRes; uniform float uHullPx;
void main() {
  vec3 p = position; vec3 n = normal; vec3 hn = normalize(position);
  vC = vec3(1.0);
  #ifdef USE_INSTANCING_COLOR
    vC = instanceColor;
  #endif
  #ifdef USE_INSTANCING
    mat3 m3 = mat3(instanceMatrix);
    vec3 s2 = vec3(dot(m3[0], m3[0]), dot(m3[1], m3[1]), dot(m3[2], m3[2]));
    n = m3 * (n / s2); hn = m3 * hn;
    p = (instanceMatrix * vec4(p, 1.0)).xyz;
  #endif
  vec4 mv = modelViewMatrix * vec4(p, 1.0);
  vN = normalize(normalMatrix * n);
  vDepth = -mv.z;
  vec4 clip = projectionMatrix * mv;
  #ifdef HULL
    vec3 hv = normalize(normalMatrix * hn);
    vec2 d = (projectionMatrix * vec4(hv, 0.0)).xy;
    float dl = length(d); d = dl > 1e-5 ? d / dl : vec2(0.0);
    clip.xy += d * (uHullPx * 2.0 / uRes) * clip.w;
  #endif
  gl_Position = clip;
}`;

export const FRAG = /* glsl */ `
precision highp float;
varying vec3 vN; varying vec3 vC; varying float vDepth;
uniform vec3 uL; uniform vec3 uInk; uniform vec3 uLine; uniform vec3 uBg; uniform vec3 uFogC;
uniform float uFogD; uniform float uBands; uniform float uSnap; uniform float uHatch; uniform float uShadowMix;
uniform vec3 uPal[8];
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
  #ifdef HULL
    col = uLine;
    float fh = 1.0 - exp(-pow(uFogD * vDepth, 2.0));
    col = mix(col, uFogC, fh * 0.85);
    gl_FragColor = vec4(col, 1.0);
  #else
    vec3 shade = mix(base, uBg, uShadowMix), hi = mix(base, uInk, 0.32);
    #if MODE > 0
      vec3 n = normalize(vN); if (!gl_FrontFacing) n = -n;
      float ndl = dot(n, uL);
    #endif
    #if MODE == 1
      float lit = clamp(ndl * 0.5 + 0.5, 0.0, 0.9999);
      float lv = min(floor(lit * uBands) / max(1.0, uBands - 1.0), 1.0);
      col = mix(shade, base, lv);                                     // bandas: del tono de sombra al color pleno (sin brillo extra)
    #elif MODE == 2
      float lit = clamp(ndl * 0.5 + 0.55, 0.0, 1.0);
      col = lit < 0.7 ? mix(shade, base, smoothstep(0.0, 0.7, lit)) : mix(base, hi, smoothstep(0.7, 1.0, lit) * 0.6);
    #elif MODE == 3
      float lit = clamp(ndl * 0.5 + 0.5, 0.0, 1.0), dk = 1.0 - lit;
      float a = fract((gl_FragCoord.x + gl_FragCoord.y) / uHatch), b = fract((gl_FragCoord.x - gl_FragCoord.y) / uHatch);
      float l1 = step(0.5, a) * step(0.30, dk), l2 = step(0.5, b) * step(0.62, dk);
      col = mix(base, uInk, clamp(max(l1, l2) * 0.85, 0.0, 1.0));
      col = mix(col, shade, step(0.85, dk) * 0.5);
    #endif
    float f = 1.0 - exp(-pow(uFogD * vDepth, 2.0));
    col = mix(col, uFogC, f);
    col = snapPal(col);
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
uniform vec3 uShadowC; uniform float uShadowA; uniform float uFogD;
void main() {
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
