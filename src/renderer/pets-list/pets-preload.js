// Preload for the Pets list window.
const { contextBridge, ipcRenderer } = require('electron');

contextBridge.exposeInMainWorld('committenPets', {
  // Returns { pets: [{ id, displayName, type, thumbnailUrl, builtin }...], activePet }
  list: () => ipcRenderer.invoke('pets:list'),

  // Write config.activePet and relaunch. Returns { ok, error? }.
  setActive: (id) => ipcRenderer.invoke('pets:set-active', id),

  close: () => ipcRenderer.send('pets:close'),
});
