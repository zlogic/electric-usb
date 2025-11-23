import { app, BaseWindow, WebContentsView, Menu, ipcMain } from 'electron'
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
    useContentSize: true,
    title: 'Electric USB',
    menuBarVisible: false,
    webPreferences: { devTools: false }
  })
  // Sepecifying a custom here partition will result in a segmentation fault when trying to access USB devices.
  const webPageView = new WebContentsView({ webPreferences: { devTools: false } });

  const allowUsbView = new WebContentsView({
    webPreferences: {
      preload: path.join(__dirname, 'static', 'preload-select-device.js'),
      devTools: false,
      transparent: true,
      partition: 'permissions'
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
  ipcMain.on('device-selected', (_event, deviceId) => {
    if (selectDeviceCallback !== undefined) {
      selectDeviceCallback(deviceId);
    }
    selectDeviceCallback = undefined;
    if (!approvedDevices.includes(deviceId)) {
      approvedDevices.push(deviceId);
    }
    win.contentView.removeChildView(allowUsbView);
  });

  webPageView.webContents.session.on('select-usb-device', (event, details, callback) => {
    if (selectDeviceCallback !== undefined) {
      event.preventDefault()
      callback();
      return;
    }

    const origin = details.frame.origin;

    win.contentView.addChildView(allowUsbView);

    webPageView.webContents.session.on('usb-device-added', (_event, device) => {
      const added = device.device;
      if (!details.deviceList.some((existing) => existing.deviceId === added.deviceId)) {
        details.deviceList.push(added);
      }
      allowUsbView.webContents.send('select-device', origin, convertDevices(details.deviceList));
    })

    webPageView.webContents.session.on('usb-device-removed', (_event, device) => {
      const removed = device.device;
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

  ipcMain.on('url-accepted', (_event, url) => {
    win.contentView.removeChildView(startPageView);
    startPageView = undefined;
    webPageView.webContents.loadURL(url)
    win.contentView.addChildView(webPageView);
  });

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
