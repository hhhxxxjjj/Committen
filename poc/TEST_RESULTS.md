# P0 POC — Test Results

> PO gate per `docs/v0.2-pet-hatch.md` §6 & §12.

## Environment

- Date: 2026-05-18
- Browser: Chrome 148 (per server logs)
- OS: Windows 11
- `@imgly` version: latest 1.x via esm.sh
- First-time model download: completed without issue (timing not recorded)

## Test photos

| # | Description | Params | Quality (1–5) | Notes |
| - | ----------- | ------ | ------------- | ----- |
| 1 | Golden retriever puppy, closeup, clean bg     | px64/pal16/ol0 | **5** | face/eyes/tongue clean; ship-quality |
| 2 | Jack Russell terrier, full body lying down    | px64/pal16/ol0 | **3** | landscape framing → pixel budget thin; spec §7 prediction confirmed |
| 3 | Lakers player #24, portrait                   | px64/pal16/ol0 | **4** | jersey + number readable; face darker but recognizable |
| 4 | Two small dogs side-by-side                   | px64/pal16/ol0 | **2** | both kept by bg-removal but each rendered tiny — aspect ratio problem |
| 5 | Doge meme (Shiba Inu closeup)                 | px64/pal16/ol0 | **5** | meme spirit intact |
| 6 | Cat backlit, looking up                       | px64/pal16/ol0 | **3** | left ear eaten by bg-removal; **PO accepted: "蛮正常的"** |
| 7 | Teddy bear (non-pet object)                   | px64/pal16/ol0 | **5** | bg-removal generalizes to objects; bow visible |

Quality rubric: 5 = ship / 4 = fine after tweaks / 3 = recognizable but ugly / 2 = recognizable but bad / 1 = broken

## Slider sweet spots observed

All 7 tests run on defaults (`px64 / pal16 / ol0`). Slider tuning **not** evaluated in P0 — defaults clearly produce acceptable output for 5/7 cases, which is enough to clear the gate. Power-user slider UX deferred to P2.

## Failure modes seen

- [x] **Bg-removal ate part of subject** (#6: cat ear in backlit shot). PO judged acceptable.
- [x] **Aspect-ratio / multi-subject mismatch** (#2, #4): current pipeline preserves bg-removed bbox; landscape or multi-subject inputs spread pixel budget too thin.
- [ ] Bg-removal kept background blobs — not seen
- [ ] Pixelization lost subject detail to noise — not seen at default params
- [ ] Palette was too desaturated / muddy — not seen
- [ ] Outline merged adjacent body parts — not tested (outline=0 in all runs)

## Verdict (PO)

- [ ] **PASS** — quality acceptable → start P1
- [x] **PASS with conditions** — P1 starts; conditions below are blocking on P2 ship
- [ ] **FAIL** — re-evaluate per §0

### Blocking conditions for v0.2.0-alpha ship

1. **P2 pipeline must add crop-to-subject + letterbox-to-square.** New order: `bg-remove → crop to alpha bbox → letterbox to square → pixelize`. Without this, #2 and #4 patterns ship broken.
2. **UX must hard-enforce single-subject, centered framing.** spec §7 has text guidance; promote to UI affordance: draggable square crop frame inside the Hatch window, user picks framing before pixelize runs. The guidance text alone is not enough — users will drop landscape full-body pet photos.
3. **Default cat remains switchable as the safe fallback.** Already in spec §3.3 ("默认猫保留全套多帧动画") — re-affirming here as a hard P1 requirement, not just spec aspiration.

Signed: hhhxxxjjj (PO)   Date: 2026-05-18
