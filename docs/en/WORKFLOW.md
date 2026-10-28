# Workflow, roles, review and gates

> English guide condensed from `PROMPTS.md`, `AGENTES.md`, `REVIEW.md` and `ORQUESTADOR.md` (Spanish originals, which carry the full prompts and tables). Command names, flags and file names are the real ones.

## The pipeline
```
brief -> STYLE -> audio -> timeline -> STORYBOARD => GATE -> animatic => GATE -> shots (parallel)
      -> autocam* -> LINT (+guard) -> index -> CRITIC => GATE -> sound -> master (fragments) [-> EDL]
```
No closed gate (human or autonomous), no film code and no master. Gates are listed in `gates.json` as `criterion::command` pairs; `node engine/gate.mjs close <gate>` closes one only if every command exits 0 (`validate`, `animatic`, `lint`, `master`). `--force "reason"` is allowed for the Director and is written to the ledger.

## Stages (what each prompt asks for)
1. **Brief.** Fill `data/brief.md`; reply with five lines: piece, silent-reading arc, look, rhythm, what you will not do. No code.
2. **Style.** Translate the request into axes and pick or compose a pack ([styles](STYLES.md)); fix `style` and `profile` in the timeline.
3. **Facts** (`explainer` only). `data/facts.json`: one entry per date, name or physical claim shown on screen, each with a primary source or it is cut.
4. **Timeline.** `data/timeline.json` from `data/timeline.template.json`. Every shot: `id`, `t`, `cam` (ONE move + closed-enum `why`), `action`, `on_beat`, `on_beat_at`, `text`, `transition_out`; declare `handoffs` for any entity crossing a cut. Run `node engine/lint.mjs --only validate` until it passes.
5. **Storyboard.** One SVG per shot in `storyboard/`, line art only, plus a `STRIP.svg`; wait for OK.
6. **Animatic.** `npm run animatic`, then `lint --only beats`, `--only camera`, `--only validate`. Adjust `t` and `cam` in the timeline, not the drawing.
7. **Style lock.** Render representative stills (`node engine/render.mjs --still <t>`) and freeze palette and type.
8. **Shots.** One `shots/<ID>.mjs` per shot (see the [shot contract](ARCHITECTURE.md#shot-contract)). Layout through `api.safe`/`api.at`; text only through the api; mandatory focus; the engine applies the camera; pure `seek`. Before handing in: `npm run lint` without FIX on your IDs and `node engine/render.mjs --shot <ID> --stills`.
9. **Lint.** `npm run lint`; fix each FIX minimally in the named shot until SHIP. A false positive is adjusted with `hold_ok` or `profileOverrides` in the timeline, with a written justification.
10. **Review.** Only with lint SHIP: `npm run sheet && npm run strips`, then passes in order: rhythm, AI-template look, typography, cinematography, rigour (explainer). Output is `SHIP` or `FIX` lines of `shot  t  problem  fix`.
11. **Master.** `npm run master` (use `--chunk 1500 --max-chunks 1` if the environment times out). Verify with `ffprobe` and `ffmpeg -i out/master.mp4 -af ebur128 -f null -` (target about -14 LUFS, true peak <= -1).

## Roles
Each role writes only to its own paths (`roles.json`, enforced by an optional Claude Code hook in `.claude/hooks/opus-roles.mjs`; launch agents with `OPUS_AGENT=<name> OPUS_ROLE=<role>`).

| role | owns |
|---|---|
| **Director** | stages 1-8 and 11; the only editor of `data/timeline.json`, `engine/profiles.json`, `styles/*.json`, `CRAFT.md`, `CINE.md` |
| **DP** (cinematographer) | per-shot size, framing, `cam` + `why`, depth, colour and light |
| **Researcher** (explainer) | `data/facts.json` |
| **TD** | `engine/`, tests and docs only; `npm test` must stay green; run `npm run docs` after touching primitives |
| **Animator {IDs}** | `shots/<ID>.mjs` and `out/sheets/<ID>.png`; claims a shot first with `node engine/lock.mjs claim shots/A2.mjs` |
| **Review-\*** | rhythm, demo-look, type, rigour, cinematography; judge only what lint cannot measure |

## What lint measures (so reviewers do not have to)
Determinism (`seek(t)` twice, identical buffers) · timeline schema (`data/timeline.schema.json`, errors with JSON path) · coverage, ids, references · text outside the safe area · minimum type size at output resolution · text/text and text/focus overlap · cuts on the beat · entity handoffs · closed-enum camera reasons and speed limits · transition taxonomy · motif progression · rhythm signature, peak-end, first/last frame rhyme · single focus and grey-value separation · composition (edges, anchor, air) · type levels (<= 3) · reading time · palette contrast, chroma, colour count · banned transitions · holds and pops. Plus the guard: static scan and a `ctx` Proxy (raw text, absolute transforms, save/restore leaks, fake camera), shot without focus, per-shot determinism, missing font, un-baked `cam: auto`.

## Visual critic
`npm run critic` refuses to run unless `out/lint.json` exists, is SHIP and is newer than the timeline and shots. It builds in/mid/out sheets in colour, grey and annotated form with measured facts and a closed rubric (framing, hierarchy, aesthetic, coherence, clarity). Without `--api`, a vision-capable agent reads `out/review/<film>/*.png` and returns `node engine/critic.mjs --verdict v.json` (schema in `packet.md`). With `--api`, N samples per shot are voted; any invalid response counts as FIX (fail-closed).

## Multi-agent orchestration (summary)
One writer per artefact: only the Director edits the timeline; others **propose** a JSON Patch (`node engine/orch.mjs propose …`) and the Director accepts or rejects. A change to a shot goes through `orch accept`, whose ratchet re-lints the shot and its neighbours and rejects the change if any check goes from green to red. Closing the `animatic` gate freezes inter-shot contracts (cut, exit camera, handoff state). Oscillation (A->B->A) or three attempts on one shot freezes it and escalates to the Director. Plan parallel work with `node engine/q.mjs deps` and `q impact <shot>`; `orch plan` produces waves, `orch resume` recovers after an interruption.
Everything is recorded in a hash-chained, signed, append-only ledger (`out/ledger.jsonl`, `node engine/ledger.mjs --tail 20`; `verify` checks the chain).
