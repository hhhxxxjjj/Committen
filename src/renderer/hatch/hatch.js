// Hatch window orchestration:
//   file drop → @imgly bg-removal → cropAndLetterboxToSquare → pixelize
//   → preview → IPC save to userData/pets/<id>/
//
// @imgly still loaded from esm.sh (same as POC). Local bundle is a v0.2.1 TODO.

import { removeBackground } from "https://esm.sh/@imgly/background-removal@1";
import { cropAndLetterboxToSquare, pixelize } from "./pixelize.js";

const dropZone = document.getElementById("drop-zone");
const fileInput = document.getElementById("file-input");
const originalCanvas = document.getElementById("originalPreview");
const finalCanvas = document.getElementById("finalPreview");
const statusEl = document.getElementById("status");

const pixelSizeInput = document.getElementById("pixel-size");
const paletteSizeInput = document.getElementById("palette-size");
const outlineInput = document.getElementById("outline");
const pixelSizeVal = document.getElementById("pixel-size-val");
const paletteSizeVal = document.getElementById("palette-size-val");
const outlineVal = document.getElementById("outline-val");

const nameInput = document.getElementById("pet-name");
const saveBtn = document.getElementById("save-btn");
const cancelBtn = document.getElementById("cancel-btn");

// Cached intermediate canvases — bg-removal + crop+letterbox runs once per file,
// pixelization re-runs on every slider change.
let squaredCanvas = null;

dropZone.addEventListener("click", () => fileInput.click());
fileInput.addEventListener("change", (e) => {
  const f = e.target.files[0];
  if (f) handleFile(f);
});

for (const ev of ["dragenter", "dragover"]) {
  dropZone.addEventListener(ev, (e) => {
    e.preventDefault();
    dropZone.classList.add("hover");
  });
}
for (const ev of ["dragleave", "drop"]) {
  dropZone.addEventListener(ev, (e) => {
    e.preventDefault();
    dropZone.classList.remove("hover");
  });
}
dropZone.addEventListener("drop", (e) => {
  const f = e.dataTransfer?.files?.[0];
  if (f) handleFile(f);
});

for (const el of [pixelSizeInput, paletteSizeInput, outlineInput]) {
  el.addEventListener("input", () => {
    pixelSizeVal.textContent = pixelSizeInput.value;
    paletteSizeVal.textContent = paletteSizeInput.value;
    outlineVal.textContent = outlineInput.value;
    if (squaredCanvas) rerender();
  });
}

nameInput.addEventListener("input", updateSaveBtn);

saveBtn.addEventListener("click", onSave);
cancelBtn.addEventListener("click", () => window.committenHatch.close());

async function handleFile(file) {
  squaredCanvas = null;
  saveBtn.disabled = true;
  setStatus(`Loading ${file.name}…`);

  let img;
  try {
    img = await loadImage(file);
  } catch (err) {
    setStatus(`Failed to load image: ${err.message}`, "error");
    return;
  }
  drawScaled(img, originalCanvas, 240);

  setStatus("Removing background… (first run downloads ~50MB model)");
  const t0 = performance.now();
  let blob;
  try {
    blob = await removeBackground(file, {
      progress: (key, current, total) => {
        if (typeof current === "number" && typeof total === "number" && total > 0) {
          setStatus(`${key} — ${Math.round((100 * current) / total)}%`);
        } else {
          setStatus(key);
        }
      },
    });
  } catch (err) {
    console.error(err);
    setStatus(`Background removal failed: ${err.message}`, "error");
    return;
  }
  const t1 = performance.now();

  const noBgImg = await loadImage(blob);
  const noBgCanvas = document.createElement("canvas");
  noBgCanvas.width = noBgImg.naturalWidth;
  noBgCanvas.height = noBgImg.naturalHeight;
  noBgCanvas.getContext("2d").drawImage(noBgImg, 0, 0);

  squaredCanvas = cropAndLetterboxToSquare(noBgCanvas);
  if (!squaredCanvas) {
    setStatus("Background removal returned nothing visible. Try a different photo.", "error");
    return;
  }

  setStatus(
    `bg-removed in ${Math.round(t1 - t0)}ms (${noBgCanvas.width}×${noBgCanvas.height})  ·  ` +
      `cropped to ${squaredCanvas.width}×${squaredCanvas.width}.`
  );
  rerender();
  updateSaveBtn();
}

function rerender() {
  if (!squaredCanvas) return;
  const t0 = performance.now();
  try {
    const result = pixelize(squaredCanvas, {
      pixelSize: parseInt(pixelSizeInput.value, 10),
      paletteSize: parseInt(paletteSizeInput.value, 10),
      outline: parseInt(outlineInput.value, 10),
    });
    finalCanvas.width = result.width;
    finalCanvas.height = result.height;
    finalCanvas.getContext("2d").drawImage(result, 0, 0);
  } catch (err) {
    console.error(err);
    setStatus(`Pixelize error: ${err.message}`, "error");
    return;
  }
  const t1 = performance.now();
  setStatus(`Pixelized in ${Math.round(t1 - t0)}ms. Name your pet, then click Hatch!`, "ok");
}

function updateSaveBtn() {
  saveBtn.disabled = !squaredCanvas || nameInput.value.trim().length === 0;
}

async function onSave() {
  if (saveBtn.disabled) return;
  const name = nameInput.value.trim();
  setStatus(`Saving "${name}"…`);
  saveBtn.disabled = true;

  const blob = await canvasToBlob(finalCanvas, "image/png");
  const buf = await blob.arrayBuffer();

  let result;
  try {
    result = await window.committenHatch.savePet({ name, pngBuffer: buf });
  } catch (err) {
    setStatus(`Save failed: ${err.message}`, "error");
    saveBtn.disabled = false;
    return;
  }

  if (!result || !result.ok) {
    setStatus(`Save failed: ${result?.error || "unknown"}`, "error");
    saveBtn.disabled = false;
    return;
  }

  setStatus(`Hatched! "${name}" saved as ${result.id}. Open Pets… in the cat menu to switch.`, "ok");
  setTimeout(() => window.committenHatch.close(), 1800);
}

function loadImage(blobOrFile) {
  return new Promise((resolve, reject) => {
    const url = URL.createObjectURL(blobOrFile);
    const img = new Image();
    img.onload = () => {
      URL.revokeObjectURL(url);
      resolve(img);
    };
    img.onerror = () => {
      URL.revokeObjectURL(url);
      reject(new Error("Image decode failed"));
    };
    img.src = url;
  });
}

function drawScaled(img, canvas, maxSize) {
  const scale = Math.min(1, maxSize / Math.max(img.naturalWidth, img.naturalHeight));
  canvas.width = Math.round(img.naturalWidth * scale);
  canvas.height = Math.round(img.naturalHeight * scale);
  canvas.getContext("2d").drawImage(img, 0, 0, canvas.width, canvas.height);
}

function canvasToBlob(canvas, type) {
  return new Promise((resolve) => canvas.toBlob(resolve, type));
}

function setStatus(text, kind) {
  statusEl.textContent = text;
  statusEl.classList.remove("is-error", "is-ok");
  if (kind === "error") statusEl.classList.add("is-error");
  if (kind === "ok") statusEl.classList.add("is-ok");
}
