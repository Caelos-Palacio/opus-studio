#!/usr/bin/env node
// E8: esquema del timeline. Unidades puras (validador, sugerencias, enums ↔ código) + mutaciones de extremo a extremo
// (lint en una copia temporal: campo mal escrito / enum inválido → FIX con sugerencia; cargador rechaza la estructura rota).
import fs from 'node:fs';
import { rootFrom } from '../engine/paths.mjs';
import os from 'node:os';
import path from 'node:path';
import { spawnSync } from 'node:child_process';
import { validateTimeline, suggest, ENUMS } from '../engine/schema.mjs';
import { ease } from '../engine/core.mjs';

const ROOT = rootFrom(import.meta.url);
let fail = 0;
const ok = (name, cond, extra = '') => { console.log(`${cond ? '✓' : '✗'} schema: ${name}${cond ? '' : '  ' + extra}`); if (!cond) fail++; };
const rd = (p) => JSON.parse(fs.readFileSync(path.join(ROOT, p), 'utf8'));
const fixes = (r) => r.filter((x) => x.level === 'FIX');
const clone = (x) => JSON.parse(JSON.stringify(x));

// 1) Lo que el repo trae valida (demo sin avisos; template y fixture sin FIX).
for (const f of ['data/timeline.json', 'data/timeline.template.json', 'test/fixtures/showcase/timeline.json']) {
  const r = validateTimeline(rd(f)); ok(`${f} valida`, !fixes(r).length, JSON.stringify(fixes(r)));
}
ok('demo sin campos obsoletos', !validateTimeline(rd('data/timeline.json')).length);

// 2) Enums = código (una sola fuente; si alguien añade una voz/curva/perfil, el esquema debe seguirle).
const { VOICES } = await import('../engine/sound.mjs');
const same = (a, b) => JSON.stringify([...a].sort()) === JSON.stringify([...b].sort());
ok('enum ease = core.ease', same(ENUMS.ease, Object.keys(ease)), `${ENUMS.ease} vs ${Object.keys(ease)}`);
ok('enum voice = sound.VOICES', same(ENUMS.voice, Object.keys(VOICES)));
ok('enum profile = profiles.json', same(ENUMS.profile, Object.keys(rd('engine/profiles.json'))));
const prof = new Set(Object.values(rd('engine/profiles.json')).flatMap(Object.keys)), po = Object.keys((await import('../engine/schema.mjs')).TIMELINE_SCHEMA.$defs.profileOverrides.properties);
ok('profileOverrides = claves de perfil', same(po, prof), `${po} vs ${[...prof]}`);

// 3) Mutaciones puras.
const base = rd('data/timeline.json');
const mut = (f) => { const t = clone(base); f(t); return validateTimeline(t); };
const has = (r, re, level = 'FIX') => r.some((x) => x.level === level && re.test(`${x.problem} → ${x.remedy}`));
let r = mut((t) => { t.shots[1].transiton_out = t.shots[1].transition_out; delete t.shots[1].transition_out; });
ok('campo mal escrito → FIX con sugerencia y ruta', has(r, /^\/shots\/1\/transiton_out: .*¿quisiste decir "transition_out"\?/), JSON.stringify(r));
r = mut((t) => { t.shots[2].cam.why = 'revela'; });
ok('enum inválido cam.why → FIX con sugerencia', has(r, /^\/shots\/2\/cam\/why: "revela" no está en \[approach\|reveal/) && has(r, /¿quisiste decir "reveal"\?/), JSON.stringify(r));
r = mut((t) => { t.shots[0].transition_out = 'crossfade'; });
ok('transition_out fuera de taxonomía → FIX', has(r, /\/shots\/0\/transition_out: "crossfade" no está en/));
r = mut((t) => { t.shots[0].size = 'XCU'; });
ok('tamaño de plano inválido → FIX', has(r, /\/shots\/0\/size/));
r = mut((t) => { t.shots[0].cam.mvoe = 'push'; });
ok('transposición (mvoe) → "move"', has(r, /cam\/mvoe.*¿quisiste decir "move"\?/));
r = mut((t) => { t.shots[0].vignette = 'storyboard/A1.svg'; });
ok('campo muerto vignette → WARN (no FIX)', has(r, /vignette: campo obsoleto/, 'WARN') && !fixes(r).length);
r = mut((t) => { delete t.shots[1].cam.why; });
ok('cámara en movimiento sin why → FIX', has(r, /\/shots\/1\/cam\/why: falta/));
r = mut((t) => { t.handoffs[0].to = 'A22'; t.shots[2].after = 'A22'; });
ok('referencias rotas → FIX con sugerencia', has(r, /handoffs\/0\/to.*"A2"/) && has(r, /after: "A22" no es un shot/));
r = mut((t) => { t.style = 'noirr'; });
ok('estilo inexistente → FIX "noir"', has(r, /estilo "noirr".*¿quisiste decir "noir"\?/));
r = mut((t) => { t.autoSfx = { beat: 'popp' }; t.music = { file: 'x.wav', gian: 2 }; });
ok('anyOf: enum y campo dentro de la rama correcta', has(r, /autoSfx\/beat: "popp".*"pop"/) && has(r, /music\/gian.*"gain"/), JSON.stringify(r));
r = mut((t) => { t.shots[0].t = '0-2'; });
ok('tipo incorrecto → FIX', has(r, /\/shots\/0\/t: se esperaba array/));
ok('suggest no inventa', suggest('xx', ['CU', 'MS']) === null && suggest('wipe', ['cut', 'wipe-obj']) === 'wipe-obj');

// 4) Extremo a extremo en una copia: lint --only validate escribe FIX con sugerencia; el cargador rechaza.
const copy = () => {
  const d = fs.mkdtempSync(path.join(os.tmpdir(), 'opus-schema-'));
  for (const e of fs.readdirSync(ROOT)) if (!['node_modules', 'out', '.git'].includes(e)) fs.cpSync(path.join(ROOT, e), path.join(d, e), { recursive: true });
  fs.symlinkSync(path.join(ROOT, 'node_modules'), path.join(d, 'node_modules'));
  return d;
};
const e2e = (name, edit, re) => {
  const d = copy();
  try {
    const f = path.join(d, 'data/timeline.json'), t = JSON.parse(fs.readFileSync(f, 'utf8')); edit(t); fs.writeFileSync(f, JSON.stringify(t, null, 2));
    const p = spawnSync(process.execPath, ['engine/lint.mjs', '--only', 'validate'], { cwd: d, encoding: 'utf8', timeout: 120000 }), L = JSON.parse(fs.readFileSync(path.join(d, 'out/lint.json'), 'utf8'));
    ok(`lint e2e: ${name}`, p.status === 1 && L.verdict === 'FIX' && L.issues.some((i) => i.level === 'FIX' && re.test(`${i.problem} → ${i.remedy}`)), p.stdout.slice(-400));
    if (name.startsWith('campo')) {
      const q = spawnSync(process.execPath, ['--input-type=module', '-e', "import('./engine/film.mjs').then((m) => m.loadFilm()).then(() => process.exit(0), (e) => { console.log(e.message); process.exit(1); })"], { cwd: d, encoding: 'utf8', timeout: 120000 });
      ok('cargador (render/cut) rechaza timeline sin esquema', q.status === 1 && /no valida el esquema/.test(q.stdout), q.stdout + q.stderr);
    }
  } finally { fs.rmSync(d, { recursive: true, force: true }); }
};
e2e('campo mal escrito', (t) => { t.shots[0].acton = t.shots[0].action; }, /\/shots\/0\/acton.*¿quisiste decir "action"\?/);
e2e('enum inválido', (t) => { t.shots[0].cam.why = 'aproach'; }, /cam\/why: "aproach".*¿quisiste decir "approach"\?/);

console.log(fail ? `schema: ${fail} fallos` : 'schema: ok');
process.exit(fail ? 1 : 0);
