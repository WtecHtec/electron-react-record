/* eslint-disable func-names */
/* eslint-disable promise/catch-or-return */
/* eslint-disable prettier/prettier */
/* eslint global-require: off, no-console: off, promise/always-return: off */

/**
 * This module executes inside of electron's main process. You can start
 * electron renderer process from here and communicate with the other processes
 * through IPC.
 *
 * When running `npm run build` or `npm run build:main`, this file is compiled to
 * `./src/main.js` using webpack. This gives us some performance wins.
 */
import path from 'path';
import {
  app,
  BrowserWindow,
  shell,
  ipcMain,
  Tray,
  Menu,
  desktopCapturer,
  screen,
	dialog,
	OpenDialogOptions,
} from 'electron';
import { autoUpdater } from 'electron-updater';
import log from 'electron-log';
import MenuBuilder from './menu';
import { openFolderInExplorer, resolveHtmlPath, timestamp2Time } from './util';
import { uIOhook, UiohookKey } from 'uiohook-napi'
import fs from 'fs'
const ffmpeg = require('fluent-ffmpeg');
const ffmpegPath = require('ffmpeg-static');
import { createAppLoggerFile } from "./AppFile.js";

import { globalLogger } from './logger'
let logDirectory = createAppLoggerFile()
console.log("ffmpegPath:::", ffmpegPath)
// ffmpeg.setFfmpegPath(ffmpegPath);

// 修改 ffmpeg 路径处理
let ffmpegPathResolved = ffmpegPath;
if (app.isPackaged) {
  // 在打包环境中，需要调整路径
  ffmpegPathResolved = ffmpegPath.replace(
    'app.asar',
    'app.asar.unpacked'
  );
}
console.log("ffmpegPath:::", ffmpegPathResolved);
globalLogger.info("ffmpegPath:::" + ffmpegPathResolved )
ffmpeg.setFfmpegPath(ffmpegPathResolved);

class AppUpdater {
  constructor() {
    log.transports.file.level = 'info';
    autoUpdater.logger = log;
    autoUpdater.checkForUpdatesAndNotify();
  }
}

let mainWindow: BrowserWindow | null = null;

ipcMain.on('ipc-example', async (event, arg) => {
  const msgTemplate = (pingPong: string) => `IPC test: ${pingPong}`;
  console.log(msgTemplate(arg));
  event.reply('ipc-example', msgTemplate('pong'));
});

if (process.env.NODE_ENV === 'production') {
  const sourceMapSupport = require('source-map-support');
  sourceMapSupport.install();
}

const isDebug =
  process.env.NODE_ENV === 'development' || process.env.DEBUG_PROD === 'true';

// if (isDebug) {
//   require('electron-debug')();
// }

const installExtensions = async () => {
  const installer = require('electron-devtools-installer');
  const forceDownload = !!process.env.UPGRADE_EXTENSIONS;
  const extensions = ['REACT_DEVELOPER_TOOLS'];

  return installer
    .default(
      extensions.map((name) => installer[name]),
      forceDownload,
    )
    .catch(console.log);
};
const RESOURCES_PATH = app.isPackaged
  ? path.join(process.resourcesPath, 'assets')
  : path.join(__dirname, '../../assets');

const getAssetPath = (...paths: string[]): string => {
  return path.join(RESOURCES_PATH, ...paths);
};

// eslint-disable-next-line @typescript-eslint/no-unused-vars
const createWindow = async () => {
  if (isDebug) {
    await installExtensions();
  }
  mainWindow = new BrowserWindow({
    show: false,
    width: 1024,
    height: 728,
    icon: getAssetPath('icon.png'),
    webPreferences: {
      preload: app.isPackaged
        ? path.join(__dirname, 'preload.js')
        : path.join(__dirname, '../../.erb/dll/preload.js'),
    },
  });

  mainWindow.loadURL(resolveHtmlPath('index.html'));

  mainWindow.on('ready-to-show', () => {
    if (!mainWindow) {
      throw new Error('"mainWindow" is not defined');
    }
    if (process.env.START_MINIMIZED) {
      mainWindow.minimize();
    } else {
      mainWindow.show();
    }
  });

  mainWindow.on('closed', () => {
    mainWindow = null;
  });

  const menuBuilder = new MenuBuilder(mainWindow);
  menuBuilder.buildMenu();

  // Open urls in the user's browser
  mainWindow.webContents.setWindowOpenHandler((edata) => {
    shell.openExternal(edata.url);
    return { action: 'deny' };
  });

  // Remove this if your app does not use auto updates
  // eslint-disable-next-line
  new AppUpdater();
};

/**
 * Add event listeners...
 */

app.on('window-all-closed', () => {
  // Respect the OSX convention of having the application in memory even
  // after all windows have been closed
  if (process.platform !== 'darwin') {
    app.quit();
  }
});

let tray: Tray | null; // 全局变量来持有 Tray 实例
let maskWin: BrowserWindow | null; // 全局变量来持有 倒计时浮窗 实例
let recordWin: BrowserWindow | null; // 全局变量来持有 录屏浮窗 实例
let editorWin: BrowserWindow | null; // 全局变量来持有 视频编辑 实例
let markWin: BrowserWindow | null; // 全局变量来持有 视频编辑 实例
let blobUrl: string; // 全局变量来持有 录屏 结果
const recordTimeInfo = {
	startTime: 0, // 开始录制时间
	endTime: 0, // 结束录制时间
} 
const mouseEventDatas: { type: string; x?: number; y?: number; time: number; }[] = []; // 鼠标、键盘事件数据
const isMac = process.platform === "darwin";
const HANLDE_MAP: string[] = []
let recording = 0; // 录制状态 0:未录制 1: 录制中
let marking = 0; // 标注状态 0:未标注 1: 标注中

function handleOpenMark() {
	console.log("Open Mark");
	tray?.destroy()
	tray = null
	createTray(1, 1)
	createMarkWin()
}

function handleCloseMark() {
	console.log("Close Mark");
	tray?.destroy()
	tray = null
	createTray(1, 0)
	markWin?.close()
	markWin = null
}
/**
 * 系统托盘
 * @param init 
 * @returns 
 */
function createTray(init = 0, mark = 0) {
	if (tray) {
		console.log("Tray already created!");
		return
	}
	recording = init
	marking = mark
	tray = new Tray(path.join(RESOURCES_PATH,  init === 0 ? 'tray-icon-start.png' : 'tray-icon-stop.png'));
	const startItem = [{
		label: 'Start Record',
		click () {
			mouseEventDatas.length = 0
			// eslint-disable-next-line no-use-before-define
			createCountDownMaskWin();
		}
	},
	]
	const stopItem = [{
		label: 'Stop Record',
		click () {
			console.log("Stop Record");
			tray?.destroy()
			tray = null
			createTray(0)
			if (recordWin) {
				recordWin?.webContents.send('end_record_main')
			}
			if (markWin) {
				markWin?.close()
			}
			// markWin = null
		}
	},
  mark === 0 ?	{
		label: '(W)Mark',
		click () {
			handleOpenMark()
		}
	} : {
		label: '(W)Finish Mark',
		click () {
			handleCloseMark()
		}
	}
]
	const contextMenu = Menu.buildFromTemplate(
		(init === 0 ? [...startItem] : [...stopItem]).concat(
		{
			label: 'Quit',
			click () {
				app.quit();
			}
		}));

	tray.setToolTip('Record Craft');
	tray.setContextMenu(contextMenu);
}

/** 创建编辑器窗口 */
function createEditorWindow() {
	editorWin = new BrowserWindow({
	//	icon: path.join(process.env.VITE_PUBLIC, 'electron-vite.svg'),
		width: 800,
		height: 600,
		// transparent: true, // 透明窗口
		// frame: true, // 无边框
		resizable: false,
		webPreferences: {
			backgroundThrottling: false,
			webSecurity: false, // 禁用相同来源策略  
			preload: app.isPackaged
			? path.join(__dirname, 'preload.js')
			: path.join(__dirname, '../../.erb/dll/preload.js'),
		},
	})

	// Test active push message to Renderer-process.
	editorWin.webContents.on('did-finish-load', () => { 
		editorWin?.webContents.send('record_url_main',  { blobUrl, mouseEventDatas, recordTimeInfo })
		// 打开调试面板
		// editorWin?.webContents.openDevTools()
	})

	editorWin.on('closed', () => {
		// editorWin?.close()
		// editorWin?.destroy()
		editorWin = null
		recordWin?.close()
		recordWin = null
		blobUrl = ''
	})
	// editorWin.webContents.on('destroyed', () => {
	
	// })
	editorWin.loadURL(resolveHtmlPath('editor.html'));
	// if (VITE_DEV_SERVER_URL) {
	// 	editorWin.loadURL(VITE_DEV_SERVER_URL + 'editor.html')
	// } else {
	// 	// win.loadFile('dist/index.html')
	// 	editorWin.loadFile(path.join(RENDERER_DIST, 'editor.html'))
	// }

}

/**
 * 录屏状态 浮窗
 * @returns 
 */
// eslint-disable-next-line @typescript-eslint/no-unused-vars
function createRecordWin() {
	if (recordWin) {
		return;
	}
	if (isMac) {
		app.dock.hide(); // - 1 -
	}
	// 获取屏幕的主显示器信息
	const { width, height } = screen.getPrimaryDisplay().workAreaSize;

	// 设置窗口的宽度和高度
	const windowWidth = 120;
	const windowHeight = 92;
	// app.commandLine.appendSwitch('disable-features', 'IOSurfaceCapturer,DesktopCaptureMacV2')
	recordWin = new BrowserWindow({
		width: windowWidth,
		height: windowHeight,
		x: width - windowWidth,
		y: height - windowHeight,
		frame: true, // 无边框
		transparent: true, // 透明窗口
		alwaysOnTop: true, // 窗口总是显示在最前面
		webPreferences: {
			preload: app.isPackaged
			? path.join(__dirname, 'preload.js')
			: path.join(__dirname, '../../.erb/dll/preload.js'),
		},
	})

	// Test active push message to Renderer-process.
	recordWin.webContents.on('did-finish-load', () => {
		desktopCapturer.getSources({ types: ['screen'] }).then(() => {
			recordWin?.webContents.send('start_record_main', 'screen:1:0')
			// for (const source of sources) {
			// 	if (source.name === 'Electron') {
			// 		maskWin?.webContents.send('SET_SOURCE', source.id)
			// 		return
			// 	}
			// }
		})
		// recordWin?.webContents.openDevTools()
	});

	recordWin?.setContentProtection(true)
	// 设置窗口始终在最前面
	recordWin.setAlwaysOnTop(true, "screen-saver"); // - 2 -
	// 设置窗口在所有工作区都可见
	recordWin.setVisibleOnAllWorkspaces(true); // - 3 -
	recordWin.loadURL(resolveHtmlPath('record.html'));
	// if (VITE_DEV_SERVER_URL) {
	// 	recordWin.loadURL(VITE_DEV_SERVER_URL + 'record.html')
	// } else {
	// 	// win.loadFile('dist/index.html')
	// 	recordWin.loadFile(path.join(RENDERER_DIST, 'record.html'))
	// }
	// maskWin.maximize(); // 全屏显示窗口
}

/**
 * 倒计时浮窗
 * @returns 
 */
function createCountDownMaskWin() {
  if (maskWin) {
		return;
	}
	if (isMac) {
		app.dock.hide(); // - 1 -
	}
	maskWin = new BrowserWindow({
		width: 800,
		height: 600,
		frame: true, // 无边框
		transparent: true, // 透明窗口
		alwaysOnTop: true, // 窗口总是显示在最前面
		webPreferences: {
			preload: app.isPackaged
			? path.join(__dirname, 'preload.js')
			: path.join(__dirname, '../../.erb/dll/preload.js'),
		},
	})

	// Test active push message to Renderer-process.
	maskWin.webContents.on('did-finish-load', () => {
		// maskWin?.webContents.openDevTools()
	})
	// if (VITE_DEV_SERVER_URL) {
	// 	maskWin.loadURL(VITE_DEV_SERVER_URL + 'countdownmask.html')
	// } else {
	// 	// win.loadFile('dist/index.html')
	// 	maskWin.loadFile(path.join(RENDERER_DIST, 'countdownmask.html'))
	// }
	// console.log(resolveHtmlPath('countdown.html'))
	maskWin.loadURL(resolveHtmlPath('countdown.html'));
	maskWin.maximize(); // 全屏显示窗口
	// 设置窗口始终在最前面
	maskWin.setAlwaysOnTop(true, "screen-saver"); // - 2 -
	// 设置窗口在所有工作区都可见
	maskWin.setVisibleOnAllWorkspaces(true); // - 3 -
}

function createMarkWin () {
	if (maskWin) {
		return;
	}
	if (isMac) {
		app.dock.hide(); // - 1 -
	}
	markWin = new BrowserWindow({
		frame: true, // 无边框
		transparent: true, // 透明窗口
		alwaysOnTop: true, // 窗口总是显示在最前面
		webPreferences: {
			preload: app.isPackaged
			? path.join(__dirname, 'preload.js')
			: path.join(__dirname, '../../.erb/dll/preload.js'),
		},
	})
	markWin.loadURL(resolveHtmlPath('mark.html'));
	markWin.maximize(); // 全屏显示窗口
	// 设置窗口始终在最前面
	markWin.setAlwaysOnTop(true, "screen-saver", 2); // - 2 -
	// 设置窗口在所有工作区都可见
	markWin.setVisibleOnAllWorkspaces(true); // - 3 -
	// markWin.maximize(); // 全屏显示窗口
	markWin.on('closed', () => {
		markWin = null
	})
}

function handleMessages() {
	// 结束录制
	ipcMain.on('stop_record_render', (_: unknown, url: string) => {
		uIOhook.stop()
		blobUrl = url
		recordWin?.hide()
		recordWin = null
		createEditorWindow()
		tray?.destroy()
		tray = null
		createTray(0)
		recordTimeInfo.endTime = new Date().getTime()
		if (markWin) {
			markWin.close()
			markWin = null
		}
	})
	// 开始录制、开启记录鼠标
	ipcMain.on('record_mouse_render', () => {
		uIOhook.start()
		recordTimeInfo.startTime = new Date().getTime()
	});
	// 倒计时结束
	ipcMain.on('count_down_end_render', () => {
		maskWin?.hide()
		maskWin?.destroy()
		maskWin = null
		try {
			tray?.destroy()
			tray = null
			createTray(1)
			createRecordWin()
		} catch (error) {
			console.log(error)
		}
	})

	// 选择保存录制文件夹
	if (!HANLDE_MAP.includes('select-folder-render')) {
		HANLDE_MAP.push('select-folder-render')
		ipcMain.handle('select-folder-render', async () => {
			const options: OpenDialogOptions = {
				properties: ['openDirectory'],
			};
			const results = await dialog.showOpenDialog(options)
			if (!results.canceled) {
				return results.filePaths[0]
			}
			return ''
		})
	}
	// 导出
	if (!HANLDE_MAP.includes('exprot-blob-render')) { 
		HANLDE_MAP.push('exprot-blob-render')
		ipcMain.handle('exprot-blob-render', async (_, {arrayBuffer, folder} ) => {
			// Mp4Demux.demux(arrayBuffer)
			const buffer = Buffer.from((arrayBuffer));  
			const inputPath = 'av-craft.webm'
			const outputPath = `${folder}/av-craft-${timestamp2Time(new Date().getTime())}.mp4`
			await exportMp4(buffer, inputPath, outputPath)
			// 导出成功后，1s后打开文件夹
			setTimeout(() => {
				openFolderInExplorer(folder)
				// editorWin?.close()
				// editorWin?.destroy()
				// editorWin = null
			}, 1 * 1000)
			return outputPath
		})
	}
}

function exportMp4(buffer: string | NodeJS.ArrayBufferView, inputPath: fs.PathOrFileDescriptor, outputPath: unknown) {
 return new Promise((resolve, reject) => {
	let webmPath = path.join(logDirectory, "/" + inputPath) 
	fs.writeFile(webmPath , buffer, () => {
		console.log('inputPath---', webmPath)
		globalLogger.info("inputPath:::" + webmPath )
		ffmpeg()
			.input(webmPath)
			// .inputOptions('-vsync 1') // 确保输入的时间戳同步
			.videoFilters([
				'eq=contrast=1.2:brightness=0.05:saturation=1.1:gamma=1.0', // 调整对比度、亮度、饱和度、伽玛
			])
			.outputOptions([
				// '-c:v libx264', // 设置视频编解码器
			// 	'-c:a aac', // 设置音频编解码器
				// '-preset slow', // 设置较慢的预设以提高编码质量
				// '-crf 18', // 设置恒定质量因子，值越低质量越高（范围：0-51，默认23）
				'-movflags +faststart', // 优化 mp4 播放
				// '-pix_fmt yuv420p', // 设置像素格式
				// '-r 30',
				// '-vsync 1' // 保持输出的时间戳同步
			])
			.output(outputPath)
			.on('end', () => {
				console.log('Conversion Finished 0');
				globalLogger.info("exportMp4 end :::" + outputPath )
				resolve(outputPath)
			})
			.on('error', (err: any) => {
				console.log(err);
				globalLogger.info("exportMp4 error :::" + err )
				resolve('')
			})
			.run();
	});

 })
}
app
  .whenReady()
  .then(() => {
		// 监听系统级事件
		uIOhook.on('mousemove', (e) => {
			const { x , y}  = e;
			mouseEventDatas.push({
				type: 'mousemove',
				x,
				y,
				time: new Date().getTime(),
			})
		})

		uIOhook.on('mousedown', (e) => {
			const { x , y}  = e;
			mouseEventDatas.push({
				type: 'mousedown',
				x,
				y,
				time: new Date().getTime(),
			})
		})

		uIOhook.on('keydown', (e) => {
			mouseEventDatas.push({
				type: 'keydown',
				time: new Date().getTime(),
			})
			if (recording === 1 && e.keycode === UiohookKey.Shift) {
				marking === 0 ?
			 	handleOpenMark() : handleCloseMark()
			}
		})

		uIOhook.on('keyup', () => {
			mouseEventDatas.push({
				type: 'keyup',
				time: new Date().getTime(),
			})
		})
    //  createMarkWin();
		createTray();
		handleMessages();
    // createWindow();
    // app.on('activate', () => {
    //   // On macOS it's common to re-create a window in the app when the
    //   // dock icon is clicked and there are no other windows open.
    //   if (mainWindow === null) createWindow();
    // });
  })
  .catch(console.log);
