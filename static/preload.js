const { contextBridge, ipcRenderer } = require('electron/renderer')
contextBridge.exposeInMainWorld('electronAPI', {
    onSelectDevice: (callback) => ipcRenderer.on('select-device', (_event, origin, deviceList) => callback(origin, deviceList)),
    deviceSelected: (deviceId) => ipcRenderer.send('device-selected', deviceId)
})
