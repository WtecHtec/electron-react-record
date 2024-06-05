import { app, BrowserWindow, Tray, Menu } from 'electron'
// import { createRequire } from 'node:module'
import { fileURLToPath } from 'node:url'
import path from 'node:path'



// const require = createRequire(import.meta.url)
const __dirname = path.dirname(fileURLToPath(import.meta.url))

// The built directory structure
//
// ├─┬─┬ dist
// │ │ └── index.html
// │ │
// │ ├─┬ dist-electron
// │ │ ├── main.js
// │ │ └── preload.mjs
// │
process.env.APP_ROOT = path.join(__dirname, '..')

// 🚧 Use ['ENV_NAME'] avoid vite:define plugin - Vite@2.x
export const VITE_DEV_SERVER_URL = process.env['VITE_DEV_SERVER_URL']
export const MAIN_DIST = path.join(process.env.APP_ROOT, 'dist-electron')
export const RENDERER_DIST = path.join(process.env.APP_ROOT, 'dist')

process.env.VITE_PUBLIC = VITE_DEV_SERVER_URL ? path.join(process.env.APP_ROOT, 'public') : RENDERER_DIST

let win: BrowserWindow | null
let tray: Tray | null; // 全局变量来持有 Tray 实例


function createWindow() {
	win = new BrowserWindow({
		icon: path.join(process.env.VITE_PUBLIC, 'electron-vite.svg'),
		webPreferences: {
			preload: path.join(__dirname, 'preload.mjs'),
		},
	})

	// Test active push message to Renderer-process.
	win.webContents.on('did-finish-load', () => {
		win?.webContents.send('main-process-message', (new Date).toLocaleString())
		// 打开调试面板
		win?.webContents.openDevTools()
	})

	if (VITE_DEV_SERVER_URL) {
		win.loadURL(VITE_DEV_SERVER_URL)
	} else {
		// win.loadFile('dist/index.html')
		win.loadFile(path.join(RENDERER_DIST, 'index.html'))
	}

	createTray()

}

// Quit when all windows are closed, except on macOS. There, it's common
// for applications and their menu bar to stay active until the user quits
// explicitly with Cmd + Q.
app.on('window-all-closed', () => {
	if (process.platform !== 'darwin') {
		app.quit()
		win = null
	}
})

app.on('activate', () => {
	// On OS X it's common to re-create a window in the app when the
	// dock icon is clicked and there are no other windows open.
	if (BrowserWindow.getAllWindows().length === 0) {
		createWindow()
	}

})


function createTray(init = 0) {
	if (tray) {
		console.log("Tray already created!");
		return
	}
	tray = new Tray(path.join(process.env.VITE_PUBLIC,  init === 0 ? 'tray-icon-start.png' : 'tray-icon-stop.png'));
	const startItem = {
		label: 'Start Record',
		click: function () {
			console.log("Start Record");
			tray?.destroy()
			tray = null
			createTray(1)
		}
	}
	const stopItem = {
		label: 'Stop Record',
		click: function () {
			console.log("Start Record");
			tray?.destroy()
			tray = null
			createTray(0)
		}
	}
	const contextMenu = Menu.buildFromTemplate([
		init === 0 ? startItem : stopItem,
		{
			label: 'Quit',
			role: 'quit'
		}
	]);

	tray.setToolTip('AV CRAFT');
	tray.setContextMenu(contextMenu);
}



app.whenReady().then(createWindow)
