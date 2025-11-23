const { contextBridge, ipcRenderer } = require('electron/renderer')
contextBridge.exposeInMainWorld('electronAPI', {
    urlAccepted: (url) => ipcRenderer.send('url-accepted', url)
})
