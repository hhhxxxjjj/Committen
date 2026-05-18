// Preload for the Hatch window. Exposes a tiny IPC surface to the renderer.
const { contextBridge, ipcRenderer } = require('electron');

contextBridge.exposeInMainWorld('committenHatch', {
  // Save the hatched pet. pngBuffer is an ArrayBuffer of the pixelized PNG.
  // Returns { ok: true, id, displayName } on success; { ok: false, error } on failure.
  savePet: ({ name, pngBuffer }) =>
    ipcRenderer.invoke('hatch:save', { name, pngBuffer }),

  // Close the Hatch window (without saving).
  close: () => ipcRenderer.send('hatch:close'),
});
