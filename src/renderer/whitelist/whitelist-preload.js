// Preload for the Whitelist window.
const { contextBridge, ipcRenderer } = require('electron');

contextBridge.exposeInMainWorld('committenWhitelist', {
  // Returns { recent: [{name, lastWhen}...], user: [name...], defaults: [name...] }
  list: () => ipcRenderer.invoke('whitelist:list'),

  // Add an entry to the user's whitelist (deduped against defaults + user).
  // Returns { ok, alreadyDefault?, alreadyUser?, error? }
  add: (name) => ipcRenderer.invoke('whitelist:add', name),

  // Remove a user-added entry (defaults cannot be removed in v0.2-alpha).
  // Returns { ok, error? }
  remove: (name) => ipcRenderer.invoke('whitelist:remove', name),

  close: () => ipcRenderer.send('whitelist:close'),
});
