const { app, BrowserWindow } = require('electron')

var args = process.argv;
console.log(args);
// Search for first -- arg
// Or show a welcome dialog instead?
const accessWebsite = 'https://launcher.keychron.com/'

function createWindow () {
	const win = new BrowserWindow({
		width: 800,
		height: 600
	})
	let grantedDeviceThroughPermHandler

	win.webContents.session.on('select-hid-device', (event, details, callback) => {
	    console.log("Welcome!");
		// Add events to handle devices being added or removed before the callback on
		// `select-usb-device` is called
		win.webContents.session.on('hid-device-added', (event, device) => {
			console.log('hid-device-added FIRED WITH', device)
			// Optionally update details.deviceList
		})

		win.webContents.session.on('hid-device-removed', (event, device) => {
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

	win.webContents.session.setPermissionCheckHandler((webContents, permission, requestingOrigin, details) => {
	    // TODO: check origin properly
	    console.log("Check perm "+ details.securityOrigin + "> "+ permission)
		if (permission === 'hid' && details.securityOrigin === accessWebsite) {
		    console.log("permission granted")
			return true
		}
	})

	win.webContents.session.setDevicePermissionHandler((details) => {
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

	win.webContents.session.setUSBProtectedClassesHandler((details) => {
		return details.protectedClasses.filter((usbClass) => {
		    console.log("Check protected "+usbClass);
			// Exclude classes except for audio classes
			return usbClass.indexOf('hid') === -1
		})
	})


    // TODO: load website in iframe?
	win.loadURL(accessWebsite)
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
