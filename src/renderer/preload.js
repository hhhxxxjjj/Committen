// preload: 把有限的 IPC 能力暴露给 renderer
const { contextBridge, ipcRenderer } = require('electron');

contextBridge.exposeInMainWorld('committen', {
  quit: () => ipcRenderer.send('cat:quit'),
  resetPosition: () => ipcRenderer.send('cat:reset-position'),
  openConfig: () => ipcRenderer.send('cat:open-config'),

  // v0.2 P2:打开 Hatch 窗口
  openHatch: () => ipcRenderer.send('hatch:open'),

  // v0.2 P3:打开 Pets 列表窗口
  openPetsList: () => ipcRenderer.send('pets:open'),

  // 主进程通知 renderer 切 sprite 状态(idle / walk / eat)
  onSetState: (callback) => {
    ipcRenderer.on('cat:set-state', (_e, state) => callback(state));
  },

  // 主进程下发当前 pet pack(manifest + 每状态的图片 URL)
  // v0.2 P1:由 sprite-pack-loader 解析,renderer 据此动态生成 sprite CSS
  onPack: (callback) => {
    ipcRenderer.on('cat:pack', (_e, pack) => callback(pack));
  },

  // 主进程推送饱腹感数值(0-100)
  onHunger: (callback) => {
    ipcRenderer.on('cat:hunger', (_e, value) => callback(value));
  },

  // 主进程推送猫朝向变化(1=右,-1=左)
  onDirection: (callback) => {
    ipcRenderer.on('cat:direction', (_e, dir) => callback(dir));
  },
});
