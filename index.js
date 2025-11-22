import { app, BaseWindow , WebContentsView, Menu, ipcMain } from 'electron'
import path from 'node:path'
const __dirname = import.meta.dirname;

const accessWebsite = 'https://launcher.keychron.com/'

function createWindow () {
    const menuTemplate = [
  {    label: app.getName(),      role: 'appMenu'  },
  {    role: 'windowMenu'  },
];
    const menu = Menu.buildFromTemplate(menuTemplate);
    Menu.setApplicationMenu(menu);

	const win = new BaseWindow({
		width: 800,
		height: 600,
	    useContentSize: true,
	    title: 'Electric USB',
	    menuBarVisible: false,
	    webPreferences: {
		devTools: false
	    }
	})
    const webPageView = new WebContentsView({webPreferences:{devTools: false, partition: 'target'}});
    win.contentView.addChildView(webPageView);

    const allowUsbView = new WebContentsView({webPreferences:{preload: path.join(__dirname, 'static', 'preload.js'), devTools: false, partition: 'permissions'}});
    allowUsbView.setBackgroundColor("#00000000");
    allowUsbView.webContents.loadFile('static/select-device.html');

    const updateSize = () => {
	const size = win.getContentSize();
	const bounds = {x: 0,y: 0,width: size[0],height: size[1]};
	webPageView.setBounds(bounds);
	allowUsbView.setBounds(bounds);
    };

    updateSize();
    win.on("resize", updateSize);

	let approvedDevices = [];
        let selectDeviceCallback = undefined;

	webPageView.webContents.session.on('select-hid-device', (event, details, callback) => {
	    if (selectDeviceCallback !== undefined) {
		callback();
		return;
	    }
    win.contentView.addChildView(allowUsbView);

		// Add events to handle devices being added or removed before the callback on
		// `select-usb-device` is called
		webPageView.webContents.session.on('hid-device-added', (_event, device) => {
			console.log('hid-device-added FIRED WITH', device)
			// Optionally update details.deviceList
		})

		webPageView.webContents.session.on('hid-device-removed', (_event, device) => {
			console.log('hid-device-removed FIRED WITH', device)
			// Optionally update details.deviceList
		})

		event.preventDefault()

	    let devices = details.deviceList.map((device) => {
		return {
		    deviceId: device.deviceId,
		    name: device.name,
		    vendorId: device.vendorId,
		    productId: device.productId,
		    serialNumber: device.serialNumber,
		    guid: device.guid,
		    approved: approvedDevices.includes(device.deviceId),
		};
	    });
	    allowUsbView.webContents.send('select-device', devices);
	    selectDeviceCallback = callback;
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
	})

	webPageView.webContents.session.setPermissionCheckHandler((_webContents, permission, _requestingOrigin, details) => {
	    // TODO: check origin properly
		if (permission === 'hid' && details.securityOrigin === accessWebsite) {
			return true
		}
	})

	webPageView.webContents.session.setDevicePermissionHandler((details) => {
	    // TODO: check origin properly
		if (details.deviceType === 'hid' && details.origin === accessWebsite && approvedDevices.includes(details.device)) {
				return true
			} else {
				return false
			}
	})

	webPageView.webContents.loadURL(accessWebsite)
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
