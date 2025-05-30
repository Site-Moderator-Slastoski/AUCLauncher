const { contextBridge, ipcRenderer } = require('electron');

contextBridge.exposeInMainWorld('electronAPI', {
    launchGame: () => ipcRenderer.invoke('launchGame'),
    installGame: () => ipcRenderer.invoke('installGame')
});
