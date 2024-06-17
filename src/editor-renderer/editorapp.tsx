import { useEffect, useRef, useCallback, useState } from 'react';
import loadMP4Module from 'mp4-wasm/build/mp4';
import GlobalLoading from '../compents/globalloading';
import './editorapp.css'
import FlatProgressBar from '../compents/progressbar';
import { formatSecondsToHMS } from '../renderer/uitl';
import { getEffectFrames } from './uitl';
import { encode } from 'punycode';
let addFramesHandlers: Promise<any>[] = []
let savaFolder:string
const MIN_FRAME_MOD_TIME = 1
const SCALE_DEFAULT = 1.2
interface WasmMP4 {
	end: () => Promise<Uint8Array>;
	addFrame: (data: any) => Promise<void>;
}
function EditorApp() {
  const videoRef = useRef<HTMLVideoElement>(null);
	const [currentCanvas, setCurrentCanvas] = useState<HTMLCanvasElement | null>()
	const perviewCanvasRef = useRef<HTMLCanvasElement>(null)
	const exportCanvasRef = useRef<HTMLCanvasElement>(null)
	let mp4WasmRef = useRef<WasmMP4 | null>(null)
	// 记录缩放比率
	const perviewRef = useRef({
		wscale: 1,
		hscale: 1,
		playstatus: false,
	})
	const [videoInfo, setVideoInfo] = useState({
		loaded: false,
		status: false,
		export: 0,
	})
	const [videoPlay, setVideoPlay] = useState({
		progress: 0,
		duration: 0,
		loaded: false
	})
	const renderFrameInfo = useRef({
		lastScale: 1,
		event: null,
		index: 0,
		effectFrames: [],
		wscale: 1,
		hscale: 1,
	})
	// 获取视频源、处理鼠标、键盘事件
  useEffect(() => {
		const handleLoadedmetadata = () => {
			setVideoInfo({
				loaded: true,
				status: true,
				export: 0,
			})
			const { width, height } = videoRef.current!.getBoundingClientRect();
			const { videoWidth, videoHeight} =  videoRef.current || { videoWidth: 1, videoHeight: 1 }
			const wscale = width / videoWidth;
			const hscale = height / videoHeight;
			perviewCanvasRef.current!.width = width
			perviewCanvasRef.current!.height = height
			exportCanvasRef.current!.width = videoWidth
			exportCanvasRef.current!.height = videoHeight
			perviewRef.current  = {
				...perviewRef.current,
				wscale,
				hscale,
				playstatus: true
			}
			// 设置比例
			renderFrameInfo.current.wscale = wscale
			renderFrameInfo.current.hscale = hscale
			perviewCanvasRef.current && setCurrentCanvas(perviewCanvasRef.current)
			requestAnimationFrame(() => {
				videoRef.current?.play()
			})
		};
		const handleDurationchange = () => {
			if (videoRef.current!.duration && Infinity !== videoRef.current!.duration) {
				setVideoPlay((p) => {
					return  {
						...p,
						duration: videoRef.current?.duration || 0,
						loaded: true
					}
				})
				// videoRef.current?.pause();
				// videoRef.current!.currentTime = 0
				// requestAnimationFrame(() => {
				// 	videoRef.current?.play()
				// })

			}
		}
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const handle = async (_: unknown, data: any) => {
			const {blobUrl, mouseEventDatas, recordTimeInfo} = data
			console.log(mouseEventDatas)
			if (mouseEventDatas && mouseEventDatas.length && recordTimeInfo) {
				const events = getEffectFrames(recordTimeInfo, mouseEventDatas)
				renderFrameInfo.current.effectFrames = events as any;
				console.log(events)
			}
      videoRef.current!.src = blobUrl;
			// videoRef.current!.addEventListener('canplaythrough', handleVideoLoadeddata);
			videoRef.current!.addEventListener('durationchange', handleDurationchange);
      videoRef.current!.addEventListener('loadedmetadata', handleLoadedmetadata);
    };
    window.electron.ipcRenderer.on('record_url_main', handle);
    return () => {
      window.electron.ipcRenderer.off('record_url_main', handle);
			videoRef.current!.removeEventListener('durationchange', handleDurationchange);
			videoRef.current!.removeEventListener('loadedmetadata', handleLoadedmetadata);
    };
  }, []);

	// 将video帧绘制到canvas
	const drawVideoFrame = async () => {
		if (!currentCanvas || !videoRef || !videoRef.current) return;
		const canvasWidth = currentCanvas.width
		const canvasHeight = currentCanvas.height
		const context = currentCanvas?.getContext('2d')
		if (!context) return;
		// 清空帧
		context.clearRect(0, 0, canvasWidth, canvasHeight);
		context.scale(1, 1);
		context.save();
		let { effectFrames, index, event, lastScale, wscale, hscale, } = renderFrameInfo.current
		// 检索帧
		if (!event) {
			for (let i = index; i < effectFrames.length; i++) {
				const { start, t } = effectFrames[i]
				if (start <= videoRef.current.currentTime && videoRef.current.currentTime < start + t) {
					event = effectFrames[i]
					renderFrameInfo.current.event = event
					renderFrameInfo.current.index = i + 1
					break
				}
			}
		}
		// 处理帧
		if (event) {
			// console.log('event --- 处理帧')
			let {x, y , start, t, children, scale = SCALE_DEFAULT} = event as any
			x = x * wscale
			y = y * hscale
			let newScale = 1
			// 开始帧
			if (videoRef.current.currentTime - start < MIN_FRAME_MOD_TIME) {
				newScale = newScale + (videoRef.current.currentTime - start) / MIN_FRAME_MOD_TIME * (scale - 1)
				lastScale = newScale
				renderFrameInfo.current.lastScale = lastScale
			}
			// 结束帧
			if (videoRef.current.currentTime >= start + t - MIN_FRAME_MOD_TIME && videoRef.current.currentTime < start + t) {
				newScale = lastScale - ((lastScale - 1) - (start + t - videoRef.current.currentTime) / MIN_FRAME_MOD_TIME * (lastScale - 1))
			}
			// 持续帧
			if (videoRef.current.currentTime - start > MIN_FRAME_MOD_TIME && videoRef.current.currentTime < start + t - MIN_FRAME_MOD_TIME) {
				newScale = lastScale
			}
			// 移动帧
			if (newScale === lastScale && children && children.length) {
				for (let i = 0; i < children.length; i++) {
					const { start: cstart, t: ct, x: cx, y: cy } = children[i];
					if (videoRef.current.currentTime >= cstart
						&& videoRef.current.currentTime < cstart + ct) {
						let modx = x -cx * wscale
						let mody = y - cy * hscale
						modx = (cstart + ct - videoRef.current.currentTime) / ct * Math.abs(modx)
						mody = (cstart + ct - videoRef.current.currentTime) / ct * Math.abs(mody)
						x = x + (modx > 0 ? -1 : 1) * modx
						y = y + (modx > 0 ? -1 : 1) * mody
						console.log('移动帧', x, y)
						break
					}
				}
			}
			context.translate(x, y);
			context.scale(newScale, newScale);
			context.translate(-x, -y);
			if (videoRef.current.currentTime >= start + t) {
				event = null
				renderFrameInfo.current.event = event
				renderFrameInfo.current.index = 0
			}
		}
    	// 绘制视频帧
		context!.drawImage(videoRef.current, 0, 0, canvasWidth, canvasHeight);
		context!.restore()
		// console.log('videoInfo.status===', perviewRef.current.playstatus)
		if (!perviewRef.current.playstatus) return
		if (mp4WasmRef.current) {
			const addFrame = async (currentCanvas: HTMLCanvasElement, encode: WasmMP4) => {
				const bitmap = await createImageBitmap(currentCanvas)
				await encode.addFrame(bitmap);
			}
			addFramesHandlers.push(addFrame(currentCanvas, mp4WasmRef.current))
		}
		requestAnimationFrame(drawVideoFrame)
	}

	const handelPlay = () => {
		if (videoRef.current?.currentTime === 0 || videoRef.current?.currentTime === videoRef.current?.duration) {
			initRenderFrameInfo()
		}
		videoInfo.status ? videoRef.current!.pause() :  videoRef.current!.play()
		const status = !videoInfo.status
		setVideoInfo({
			loaded: true,
			status: status,
			export: 0,
		})
		perviewRef.current.playstatus = status
		renderFrameInfo.current.hscale = perviewRef.current.hscale
		renderFrameInfo.current.wscale = perviewRef.current.wscale
		if (currentCanvas !== perviewCanvasRef.current) {
			setCurrentCanvas(perviewCanvasRef.current)
		}
	}
	useEffect(() => {
		if (!videoRef.current) return
		const currentVideo = 	videoRef.current
		const onPlay = () => {
			requestAnimationFrame(drawVideoFrame)
		}
		const onStop = async () => {
			perviewRef.current.playstatus = false
			if (!mp4WasmRef.current) {
				setVideoInfo({
					loaded: true,
					status: false,
					export: 0,
				})
			}
			if (mp4WasmRef.current && addFramesHandlers.length) {
				Promise.all(addFramesHandlers).then( async (datas) => {
					addFramesHandlers = []
					requestAnimationFrame(async () => {
						const buf = await mp4WasmRef.current!.end();
						mp4WasmRef.current = null
						// await mp4WasmRef.current!.flush();
						await window.electron.ipcRenderer.invoke('exprot-blob-render',  { arrayBuffer: buf, folder: savaFolder }); 
						// const url = URL.createObjectURL(new Blob([buf], { type: "video/mp4" }));
						// console.log('buf--', buf, url)
						setVideoInfo({
							loaded: true,
							status: false,
							export: 2,
						})
					})
				})
			}
			initRenderFrameInfo()
		}
		const updateScrubber = () => {
			setVideoPlay((p) => {
				return  {
					...p,
					progress: videoRef.current!.currentTime / (videoRef.current?.duration || 1 ) * 100,
					duration: videoRef.current?.duration === Infinity ? 0 : videoRef.current?.duration || 0,
				}
			})
		}
		currentVideo.addEventListener('play', onPlay)
		currentVideo.addEventListener('ended', onStop)
		currentVideo.addEventListener('timeupdate', updateScrubber)
		return () => {
			if (currentVideo) {
				currentVideo.removeEventListener('play', onPlay)
				currentVideo.removeEventListener('ended', onStop)
				currentVideo.removeEventListener('timeupdate', updateScrubber)
			}
		}
	}, [drawVideoFrame]);

	const handleExport = async () => {
		const floder = await window.electron.ipcRenderer.invoke('select-folder-render')
		savaFolder = floder
		if (!floder) return;
		setVideoInfo({
			loaded: true,
			status: false,
			export: 1,
		}) 
		perviewRef.current.playstatus = true
		const MP4 = await loadMP4Module();
		const encoder = MP4.createWebCodecsEncoder({
			width: exportCanvasRef.current?.width,
			height: exportCanvasRef.current?.height,
			fps: 60
		});
		mp4WasmRef.current = encoder;
		if (videoRef.current) {
			videoRef.current.currentTime = 0
		}
		initRenderFrameInfo()
		// 导出的时候还原宽高比率
		renderFrameInfo.current.hscale = 1
		renderFrameInfo.current.wscale = 1
		setCurrentCanvas(exportCanvasRef.current)
		requestAnimationFrame(() => {
			videoRef.current?.play()
			// mp4WasmRef.current!.start()
		})
		// console.log('encoder---', encoder);
	}
	// 初始化,缩放帧数据
	const initRenderFrameInfo = () => {
		renderFrameInfo.current.event = null
		renderFrameInfo.current.index = 0
		renderFrameInfo.current.lastScale = 1
	}
	const handleProgressBar = (progress: number) => {
		console.log(progress)
		const value = progress * videoRef.current!.duration / 100
		videoRef.current!.currentTime = isNaN(value) ? 0 : value
	}
  return <>
		<GlobalLoading isLoading={!videoInfo.loaded} message="加载中..."/>
		<GlobalLoading isLoading={videoInfo.export !== 0} message={ videoInfo.export === 1 ?'导出中...' : '导出完成'}/>
	 	<div style={{ opacity: videoInfo.export === 0 && videoInfo.loaded ? 1 : 0  }}>
			<canvas ref={perviewCanvasRef}></canvas>
			<FlatProgressBar initialValue={0} value={videoPlay.progress} onChange={handleProgressBar}></FlatProgressBar>
			<div className="video-hanlde">
				<div className="video-hanlde-left">
					<button className="button" onClick={handelPlay} style={{ display: videoInfo.loaded ? 'block' : 'none', marginRight: '10px'}}>  {
						videoInfo.status ? '暂停' : '播放' }  </button> 
						<div style={{ display: videoPlay.loaded && videoPlay.duration > 0 ? 'block' : 'none' }}>
						{formatSecondsToHMS( videoPlay.duration * videoPlay.progress / 100 || 0 )}/{formatSecondsToHMS( videoPlay.duration || 0)}
						</div>
				</div>
				<button className="button bl" onClick={handleExport}> 导出 </button>
			</div>
		</div>
		<video controls ref={videoRef} className="video-el" style={{ width: '760px',}} />
		<div className="exprot-contaner">
			<canvas ref={exportCanvasRef}></canvas>
		</div>
	</> 
}

export default EditorApp;


