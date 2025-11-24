import { app, BaseWindow, WebContentsView, Menu, ipcMain, session } from 'electron'
import path from 'node:path'
const __dirname = import.meta.dirname;


function createWindow() {
  const menuTemplate = [
    { label: app.getName(), role: 'appMenu' },
    { role: 'windowMenu' },
  ];
  const menu = Menu.buildFromTemplate(menuTemplate);
  Menu.setApplicationMenu(menu);

  const win = new BaseWindow({
    width: 800,
    height: 600,
    useContentSize: false,
    title: 'Electric USB',
    webPreferences: { devTools: false, session: session.fromPartition('main', { cache: false }) }
  })
  win.menuBarVisible = false;
  // The web session partition needs to be persisted; otherwise, attempting to list USB devices will cause a segmentation fault.
  let webSession = session.fromPartition('persist:target', { cache: false });
  const webPageView = new WebContentsView({ webPreferences: { devTools: false, session: webSession } });
  win.on('close', async (_event) => {
    if (webSession !== undefined) {
      await webSession.clearStorageData({});
      webSession.removeAllListeners('select-usb-device');
      webSession.removeAllListeners('select-hid-device');
      webSession.removeAllListeners('usb-device-added');
      webSession.removeAllListeners('hid-device-added');
      webSession.removeAllListeners('usb-device-removed');
      webSession.removeAllListeners('hid-device-removed');
      webSession = undefined;
    }
  });


  const allowUsbView = new WebContentsView({
    webPreferences: {
      preload: path.join(__dirname, 'static', 'preload-select-device.js'),
      devTools: false,
      transparent: true,
      session: session.fromPartition('permissions', { cache: false })
    }
  });
  allowUsbView.webContents.loadFile('static/select-device.html');

  let startPageView = new WebContentsView({
    webPreferences: {
      preload: path.join(__dirname, 'static', 'preload-start.js'),
      devTools: false
    }
  });
  startPageView.webContents.loadFile('static/start.html');

  const updateSize = () => {
    const size = win.getContentSize();
    const bounds = { x: 0, y: 0, width: size[0], height: size[1] };
    webPageView.setBounds(bounds);
    allowUsbView.setBounds(bounds);
    if (startPageView !== undefined) {
      startPageView.setBounds(bounds);
    }
  };

  updateSize();
  win.on("resize", updateSize);

  let approvedDevices = [];
  let convertDevices = (devices) => devices.map((device) => {
    return {
      deviceId: device.deviceId,
      name: device.name,
      productName: device.productName,
      vendorId: device.vendorId,
      productId: device.productId,
      serialNumber: device.serialNumber,
      guid: device.guid,
      approved: approvedDevices.includes(device.deviceId),
    };
  });
  let selectDeviceCallback = undefined;
  const onDeviceSelected = (_event, deviceId) => {
    if (selectDeviceCallback !== undefined) {
      selectDeviceCallback(deviceId);
    }
    selectDeviceCallback = undefined;
    if (!approvedDevices.includes(deviceId)) {
      approvedDevices.push(deviceId);
    }
    win.contentView.removeChildView(allowUsbView);
  };
  ipcMain.on('device-selected', onDeviceSelected);
  win.on('closed', (_event) => ipcMain.off('device-selected', onDeviceSelected));

  webPageView.webContents.session.on('select-usb-device', (event, details, callback) => {
    if (selectDeviceCallback !== undefined) {
      event.preventDefault()
      callback();
      return;
    }

    const origin = details.frame.origin;

    win.contentView.addChildView(allowUsbView);

    webPageView.webContents.session.on('usb-device-added', (_event, device) => {
      const added = device;
      if (!details.deviceList.some((existing) => existing.deviceId === added.deviceId)) {
        details.deviceList.push(added);
      }
      allowUsbView.webContents.send('select-device', origin, convertDevices(details.deviceList));
    })

    webPageView.webContents.session.on('usb-device-removed', (_event, device) => {
      const removed = device;

      details.deviceList = details.deviceList.filter((existing) => existing.deviceId !== removed.deviceId);
      allowUsbView.webContents.send('select-device', origin, convertDevices(details.deviceList));
    })

    event.preventDefault()

    allowUsbView.webContents.send('select-device', origin, convertDevices(details.deviceList));
    selectDeviceCallback = callback;
  })

  webPageView.webContents.session.on('select-hid-device', (event, details, callback) => {
    if (selectDeviceCallback !== undefined) {
      event.preventDefault()
      callback();
      return;
    }

    const origin = details.frame.origin;

    win.contentView.addChildView(allowUsbView);

    webPageView.webContents.session.on('hid-device-added', (_event, device) => {
      const added = device.device;
      if (!details.deviceList.some((existing) => existing.deviceId === added.deviceId)) {
        details.deviceList.push(added);
      }
      allowUsbView.webContents.send('select-device', origin, convertDevices(details.deviceList));
    })

    webPageView.webContents.session.on('hid-device-removed', (_event, device) => {
      const removed = device.device;
      details.deviceList = details.deviceList.filter((existing) => existing.deviceId !== removed.deviceId);
      allowUsbView.webContents.send('select-device', origin, convertDevices(details.deviceList));
    })

    event.preventDefault()

    allowUsbView.webContents.send('select-device', origin, convertDevices(details.deviceList));
    selectDeviceCallback = callback;
  })

  webPageView.webContents.session.setPermissionCheckHandler((_webContents, permission, _requestingOrigin, details) => {
    return (permission === 'hid' || permission === 'usb') && details.securityOrigin.startsWith('https://');
  })

  webPageView.webContents.session.setDevicePermissionHandler((details) => {
    return details.deviceType === 'hid' && details.origin === 'https://' && approvedDevices.includes(details.device);
  })

  win.contentView.addChildView(startPageView);

  const onUrlAccepted = (_event, url) => {
    win.contentView.removeChildView(startPageView);
    startPageView = undefined;
    webPageView.webContents.loadURL(url)
    win.contentView.addChildView(webPageView);
  };
  ipcMain.on('url-accepted', onUrlAccepted);
  win.on('closed', (_event) => ipcMain.off('url-accepted', onUrlAccepted));
}

app.whenReady().then(() => {
  createWindow()

  app.on('activate', () => {
    if (BaseWindow.getAllWindows().length === 0) {
      createWindow()
    }
  })
})

app.on('window-all-closed', () => {
  if (process.platform !== 'darwin') {
    app.quit()
  }
})

