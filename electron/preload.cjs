const { contextBridge, ipcRenderer } = require('electron');

// Narrow, explicit surface exposed to the renderer. No raw fs or ipcRenderer access.
contextBridge.exposeInMainWorld('studioNative', {
  isElectron: true,
  storageInfo: () => ipcRenderer.invoke('storage:info'),
  storageReadAll: () => ipcRenderer.invoke('storage:readAll'),
  storageWrite: (key, value) => ipcRenderer.invoke('storage:write', key, value),
  // AI features run in the main process so the API key never reaches the page
  ai: {
    status: () => ipcRenderer.invoke('ai:status'),
    setKey: (key) => ipcRenderer.invoke('ai:setKey', key),
    clearKey: () => ipcRenderer.invoke('ai:clearKey'),
    micAccess: () => ipcRenderer.invoke('ai:micAccess'),
    transcribe: (base64, mimeType) => ipcRenderer.invoke('ai:transcribe', base64, mimeType),
    mix: (payload) => ipcRenderer.invoke('ai:mix', payload),
    pullLocal: () => ipcRenderer.invoke('ai:pullLocal'),
    onPullProgress: (cb) => {
      const handler = (_event, progress) => cb(progress);
      ipcRenderer.on('ai:pullProgress', handler);
      return () => ipcRenderer.removeListener('ai:pullProgress', handler);
    },
    openPage: (url) => ipcRenderer.invoke('ai:openExternal', url),
    clipboardKey: () => ipcRenderer.invoke('ai:clipboardKey'),
  },
});
