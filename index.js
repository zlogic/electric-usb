import { app, BaseWindow , WebContentsView, Menu } from 'electron'

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
    const view1 = new WebContentsView({webPreferences:{devTools: false, partition: 'target'}});
    win.contentView.addChildView(view1);

    const view2 = new WebContentsView({webPreferences:{devTools: false, partition: 'permissions'}});
    win.contentView.addChildView(view2);
    view2.setBackgroundColor("#00000000");
    view2.webContents.loadFile('select-device.html');

    const updateSize = () => {
	const size = win.getContentSize();
	const bounds = {x: 0,y: 0,width: size[0],height: size[1]};
	view1.setBounds(bounds);
	view2.setBounds(bounds);
    };

    updateSize();
    win.on("resize", updateSize);

	let grantedDeviceThroughPermHandler

	view1.webContents.session.on('select-hid-device', (event, details, callback) => {
	    console.log("Welcome!");
		// Add events to handle devices being added or removed before the callback on
		// `select-usb-device` is called
		view1.webContents.session.on('hid-device-added', (event, device) => {
			console.log('hid-device-added FIRED WITH', device)
			// Optionally update details.deviceList
		})

		view1.webContents.session.on('hid-device-removed', (event, device) => {
			console.log('hid-device-removed FIRED WITH', device)
			// Optionally update details.deviceList
		})

		event.preventDefault()
	    // TODO: let user select a device
	    // https://github.com/nanhantianyi/k5web/blob/f13615d74ab397fb21353614d268c29625f5a504/main.js#L55
	    // modal window https://www.electronjs.org/docs/latest/api/browser-window#modal-windows
		if (details.deviceList && details.deviceList.length > 0) {
			const deviceToReturn = details.deviceList.find((device) => {
				return !grantedDeviceThroughPermHandler || (device.deviceId !== grantedDeviceThroughPermHandler.deviceId)
			})
			if (deviceToReturn) {
				callback(deviceToReturn.deviceId)
			} else {
				callback()
			}
		}
	})

	view1.webContents.session.setPermissionCheckHandler((webContents, permission, requestingOrigin, details) => {
	    // TODO: check origin properly
	    console.log("Check perm "+ details.securityOrigin + "> "+ permission)
		if (permission === 'hid' && details.securityOrigin === accessWebsite) {
		    console.log("permission granted")
			return true
		}
	})

	view1.webContents.session.setDevicePermissionHandler((details) => {
	    console.log("Handle perm "+ details.device.name + " > " + details.deviceType)
	    // TODO: check origin properly
		if (details.deviceType === 'hid' && details.origin === accessWebsite) {
			if (!grantedDeviceThroughPermHandler) {
				grantedDeviceThroughPermHandler = details.device
				return true
			} else {
				return false
			}
		}
	})

	view1.webContents.session.setUSBProtectedClassesHandler((details) => {
		return details.protectedClasses.filter((usbClass) => {
		    console.log("Check protected "+usbClass);
			// Exclude classes except for audio classes
			return usbClass.indexOf('hid') === -1
		})
	})

	view1.webContents.loadURL(accessWebsite)
}

app.whenReady().then(() => {
	createWindow()

	app.on('activate', () => {
		if (BrowserWindow.getAllWindows().length === 0) {
			createWindow()
		}
	})
})

app.on('window-all-closed', () => {
	if (process.platform !== 'darwin') {
		app.quit()
	}
})
