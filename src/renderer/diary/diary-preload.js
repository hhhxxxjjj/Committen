// Preload for the Diary window.
const { contextBridge, ipcRenderer } = require('electron');

contextBridge.exposeInMainWorld('committenDiary', {
  // Returns { events: [{type, when, ...}...], streak: { current, longest, broken } }
  list: () => ipcRenderer.invoke('diary:list'),
  close: () => ipcRenderer.send('diary:close'),
});
