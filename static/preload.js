const { contextBridge, ipcRenderer } = require('electron/renderer')
contextBridge.exposeInMainWorld('electronAPI', {
    onSelectDevice: (callback) => ipcRenderer.on('select-device', (_event, deviceList) => callback(deviceList)),
    deviceSelected: (deviceId) => ipcRenderer.send('device-selected', deviceId)
})
