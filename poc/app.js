import { removeBackground } from "https://esm.sh/@imgly/background-removal@1";
import { pixelize } from "./pixelize.js";

const dropZone = document.getElementById("drop-zone");
const fileInput = document.getElementById("file-input");
const originalCanvas = document.getElementById("original");
const outputCanvas = document.getElementById("output");
const statusEl = document.getElementById("status");

const pixelSizeInput = document.getElementById("pixel-size");
const paletteSizeInput = document.getElementById("palette-size");
const outlineInput = document.getElementById("outline");
const pixelSizeVal = document.getElementById("pixel-size-val");
const paletteSizeVal = document.getElementById("palette-size-val");
const outlineVal = document.getElementById("outline-val");

const saveBtn = document.getElementById("save-png");

let noBgCanvas = null;
let bgInfo = "";
let lastSourceName = "pet";

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
    if (noBgCanvas) rerender();
  });
}

async function handleFile(file) {
  noBgCanvas = null;
  bgInfo = "";
  saveBtn.disabled = true;
  lastSourceName = (file.name || "pet").replace(/\.[^.]+$/, "");
  setStatus(`Loading ${file.name}…`);

  let img;
  try {
    img = await loadImage(file);
  } catch (err) {
    setStatus(`Failed to load image: ${err.message}`);
    return;
  }
  drawToCanvas(img, originalCanvas, 256);

  setStatus("Removing background… (first run downloads ~50MB model)");
  const t0 = performance.now();
  let blob;
  try {
    blob = await removeBackground(file, {
      progress: (key, current, total) => {
        if (typeof current === "number" && typeof total === "number" && total > 0) {
          const pct = Math.round((100 * current) / total);
          setStatus(`${key} — ${pct}%`);
        } else {
          setStatus(key);
        }
      },
    });
  } catch (err) {
    console.error(err);
    setStatus(`Background removal failed: ${err.message}`);
    return;
  }
  const t1 = performance.now();

  const noBgImg = await loadImage(blob);
  noBgCanvas = document.createElement("canvas");
  noBgCanvas.width = noBgImg.naturalWidth;
  noBgCanvas.height = noBgImg.naturalHeight;
  noBgCanvas.getContext("2d").drawImage(noBgImg, 0, 0);

  bgInfo = `bg-removed ${Math.round(t1 - t0)}ms (${noBgCanvas.width}×${noBgCanvas.height})`;
  rerender();
}

function rerender() {
  if (!noBgCanvas) return;
  const t0 = performance.now();
  try {
    const result = pixelize(noBgCanvas, {
      pixelSize: parseInt(pixelSizeInput.value, 10),
      paletteSize: parseInt(paletteSizeInput.value, 10),
      outline: parseInt(outlineInput.value, 10),
    });
    outputCanvas.width = result.width;
    outputCanvas.height = result.height;
    outputCanvas.getContext("2d").drawImage(result, 0, 0);
  } catch (err) {
    console.error(err);
    setStatus(`Pixelize error: ${err.message}`);
    return;
  }
  const t1 = performance.now();
  saveBtn.disabled = false;
  setStatus(`${bgInfo}  ·  pixelized ${Math.round(t1 - t0)}ms`);
}

saveBtn.addEventListener("click", () => {
  if (saveBtn.disabled) return;
  const ps = pixelSizeInput.value;
  const pal = paletteSizeInput.value;
  const ol = outlineInput.value;
  outputCanvas.toBlob((blob) => {
    if (!blob) return;
    const url = URL.createObjectURL(blob);
    const a = document.createElement("a");
    a.href = url;
    a.download = `${lastSourceName}_px${ps}_pal${pal}_ol${ol}.png`;
    a.click();
    URL.revokeObjectURL(url);
  }, "image/png");
});

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

function drawToCanvas(img, canvas, maxSize) {
  const scale = Math.min(1, maxSize / Math.max(img.naturalWidth, img.naturalHeight));
  canvas.width = Math.round(img.naturalWidth * scale);
  canvas.height = Math.round(img.naturalHeight * scale);
  canvas.getContext("2d").drawImage(img, 0, 0, canvas.width, canvas.height);
}

function setStatus(text) {
  statusEl.textContent = text;
}
