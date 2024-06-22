import { useEffect, useRef, useState } from 'react';
import GlobalLoading from '../compents/globalloading';
import './editorapp.css'
import FlatProgressBar from '../compents/progressbar';
import { formatSecondsToHMS } from '../renderer/uitl';
import { getEffectFrames } from './uitl';

// let addFramesHandlers: Promise<any>[] = []
let savaFolder:string
const MIN_FRAME_MOD_TIME = 0.8
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
	const currentCanvasRef = useRef<{
		cnavas: any
	}>({
		cnavas: null
	})
	// const [exportStatus, setExportStatus] = useState(false)
	const videoFrameRef = useRef({
		previousFrameData: null,
        frameCount: 0,
        startTime: 0,
		frameRate: 30,
	})
	const exportCanvasSetRef = useRef<{
		recorder: any
	}>({
		recorder:  null
	})
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
		sx: 0,
		sy: 0,
		effectFrames: [],
		wscale: 1,
		hscale: 1,
		tReset: false,
		tIndex: 0,
		tx: 0,
		ty: 0,
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
			// perviewCanvasRef.current && setCurrentCanvas(perviewCanvasRef.current)
			perviewCanvasRef.current && (currentCanvasRef.current.cnavas = perviewCanvasRef.current)
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

	// 将video帧绘制到canvas【缩放、移动】
	const drawVideoFrame = async () => {
		const { cnavas: currentCanvas } = currentCanvasRef.current;
		if (!currentCanvas || !videoRef || !videoRef.current) return;
		if (!videoFrameRef.current.startTime && performance.now()) {
			videoFrameRef.current.startTime = performance.now();
		}
		const canvasWidth = currentCanvas.width
		const canvasHeight = currentCanvas.height
		const context = currentCanvas?.getContext('2d')
		if (!context) return;
		// 清空帧
		context.clearRect(0, 0, canvasWidth, canvasHeight);
		context.scale(1, 1);
		context.save();
		let { effectFrames, index, event, lastScale, wscale, hscale, sx, sy} = renderFrameInfo.current
		// 检索帧
		if (!event) {
			renderFrameInfo.current.tIndex = 0
			renderFrameInfo.current.tReset = true
			for (let i = index; i < effectFrames.length; i++) {
				const { start, t } = effectFrames[i]
				if (start <= videoRef.current.currentTime && videoRef.current.currentTime < start + t) {
					event = effectFrames[i]
					renderFrameInfo.current.event = event
					renderFrameInfo.current.index = i + 1
					renderFrameInfo.current.tx = (event as any).x
					renderFrameInfo.current.ty = (event as any).y
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
			// 记录移动x\y;解决缩放帧还原空白
			if (renderFrameInfo.current.tReset === true) {
				renderFrameInfo.current.sx = x
				renderFrameInfo.current.sy = y
			}
			let newScale = 1
			// 开始帧
			if (videoRef.current.currentTime - start < MIN_FRAME_MOD_TIME) {
				newScale = newScale + (videoRef.current.currentTime - start) / MIN_FRAME_MOD_TIME * (scale - 1)
				lastScale = newScale
				renderFrameInfo.current.lastScale = lastScale
			}
			// 结束帧
			if (videoRef.current.currentTime >= start + t - MIN_FRAME_MOD_TIME && videoRef.current.currentTime < start + t) {
				// console.log('结束帧', renderFrameInfo.current)
				newScale = lastScale - ((lastScale - 1) - (start + t - videoRef.current.currentTime) / MIN_FRAME_MOD_TIME * (lastScale - 1))
			}
			// 持续帧
			if (videoRef.current.currentTime - start > MIN_FRAME_MOD_TIME && videoRef.current.currentTime < start + t - MIN_FRAME_MOD_TIME) {
				newScale = lastScale
			}


			// 移动帧；处理当点击事件偏移大于500像素
			let { tIndex, tx, ty, } = renderFrameInfo.current
			if (children && children.length && children[tIndex]) {
				let { start: cstart, t: ct, x: cx, y: cy } = children[tIndex];
				ct = 0.5
				if (videoRef.current.currentTime >= cstart
					&& videoRef.current.currentTime < cstart + ct) {
					let modx = cx * wscale - tx * wscale
					let mody = cy * hscale - ty * hscale
					let modxScale = (1 - (cstart + ct - videoRef.current.currentTime) / ct ) * (modx)
					let modyScale = (1 - (cstart + ct - videoRef.current.currentTime) / ct ) * (mody)
					x = tx * wscale +  modxScale
					y = ty * hscale +  modyScale
					renderFrameInfo.current.tReset = false
					// 记录移动x\y;解决缩放帧还原空白
					renderFrameInfo.current.sx = x
					renderFrameInfo.current.sy = y
				}
				if (renderFrameInfo.current.tReset === false && videoRef.current.currentTime >= cstart + ct) {
					// 解决缩放帧还原空白，先还原一次
					// x = renderFrameInfo.current.sx
					// y = renderFrameInfo.current.sy
					renderFrameInfo.current.tIndex = tIndex + 1
					renderFrameInfo.current.tx = cx
					renderFrameInfo.current.ty = cy
					// renderFrameInfo.current.tReset = true
					// console.log('移动帧结束', renderFrameInfo.current)
				}
 			}

			// if (renderFrameInfo.current.tReset === false) {
			// 	x = renderFrameInfo.current.sx
			// 	y = renderFrameInfo.current.sy
			// 	console.log('移动帧', renderFrameInfo.current)
			// }
			x = renderFrameInfo.current.sx
			y = renderFrameInfo.current.sy
			// console.log('帧x\y', x, y)
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
		// if (mp4WasmRef.current) {
		// 	const addFrame = async (currentCanvas: HTMLCanvasElement, encode: WasmMP4) => {
		// 		const bitmap = await createImageBitmap(currentCanvas)
		// 		await encode.addFrame(bitmap);
		// 	}
		// 	addFramesHandlers.push(addFrame(currentCanvas, mp4WasmRef.current))
			
		// }
		if (videoRef.current.currentTime < videoRef.current.duration) {
			requestAnimationFrame(drawVideoFrame)
		} else {
			// setExportStatus(true)
		}
		
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
		currentCanvasRef.current.cnavas = perviewCanvasRef.current
		// if (currentCanvas !== perviewCanvasRef.current) {
		// 	setCurrentCanvas(perviewCanvasRef.current)
		// }
	}
	useEffect(() => {
		if (!videoRef.current) return
		const currentVideo = 	videoRef.current
		const onPlay = () => {
			requestAnimationFrame(drawVideoFrame)
		}
		const onStop = async () => {
			perviewRef.current.playstatus = false
			if (!exportCanvasSetRef.current.recorder) {
				setVideoInfo({
					loaded: true,
					status: false,
					export: 0,
				})
			}
			//  关闭
			try {
				exportCanvasSetRef.current.recorder?.stop();
			} catch (error) {
				console.log(error)
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
		const pause = () => {
			console.log('pause----')
			if (exportCanvasSetRef.current.recorder) {
				currentVideo.play()
				console.log('继续播放')
			}
		}
		currentVideo.addEventListener('play', onPlay)
		currentVideo.addEventListener('ended', onStop)
		currentVideo.addEventListener('timeupdate', updateScrubber)
		currentVideo.addEventListener('pause', pause)
		return () => {
			if (currentVideo) {
				currentVideo.removeEventListener('play', onPlay)
				currentVideo.removeEventListener('ended', onStop)
				currentVideo.removeEventListener('timeupdate', updateScrubber)
				currentVideo.removeEventListener('pause', pause)
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
		if (videoRef.current) {
			videoRef.current.pause()
			videoRef.current.currentTime = 0
		}
		initRenderFrameInfo()
		// 导出的时候还原宽高比率
		renderFrameInfo.current.hscale = 1
		renderFrameInfo.current.wscale = 1
		renderFrameInfo.current.tIndex = 0
		// setCurrentCanvas(exportCanvasRef.current)
		currentCanvasRef.current.cnavas = exportCanvasRef.current
		requestAnimationFrame(() => {
			const  stream  = exportCanvasRef.current?.captureStream();
			exportCanvasSetRef.current.recorder = new MediaRecorder(stream as MediaStream, {
                mimeType: 'video/webm;codecs=h264',
            });
			const chunks: BlobPart[] | undefined = [];
			exportCanvasSetRef.current.recorder.ondataavailable = (event: any) => {
                if ( event.data.size > 0) {
                    chunks.push(event.data);
                }
            };
			exportCanvasSetRef.current.recorder.onstop = async () => {
        const blob = new Blob(chunks, { type: 'video/webm;codecs=h264' });
				const blobUrl = URL.createObjectURL(blob);
				console.log('url--', blobUrl) 

				fetch(blobUrl)  
					.then(response => response.blob())  
					.then(blob => {  
						// 将 Blob 对象转换为 ArrayBuffer，以便通过 IPC 发送  
						return new Promise((resolve, reject) => {  
							const reader = new FileReader();  
							reader.onload = (event: any) => resolve(event.target.result);  
							reader.onerror = (event: any)  => reject(event.error);  
							reader.readAsArrayBuffer(blob);  
						});  
					})  
					.then(async (arrayBuffer) => {  
						// 将 ArrayBuffer 发送到主进程  
						await window.electron.ipcRenderer.invoke('exprot-blob-render',  { arrayBuffer: arrayBuffer, folder: savaFolder }); 
						setVideoInfo({
							loaded: true,
							status: false,
							export: 2,
						})
						exportCanvasSetRef.current.recorder = null
					})  
					.catch(error => {  
						console.error('Error fetching Blob:', error);  
					});
				// const arrayBuffer = await blob.arrayBuffer();
				// await window.electron.ipcRenderer.invoke('exprot-blob-render',  { arrayBuffer: arrayBuffer, folder: savaFolder }); 
				// const demuxer = new MP4Demux(arrayBuffer);
                // await demuxer.demux();
                // const videoTrack = demuxer.getVideoTracks()[0];
			}
			exportCanvasSetRef.current.recorder.start();
			requestAnimationFrame(() => {
				videoRef.current?.play()
			})
			// mp4WasmRef.current!.start()
		})
		// console.log('encoder---', encoder);
	}
	// 初始化,缩放帧数据
	const initRenderFrameInfo = () => {
		renderFrameInfo.current.event = null
		renderFrameInfo.current.index = 0
		renderFrameInfo.current.lastScale = 1
		renderFrameInfo.current.tIndex = 0
	}
	const handleProgressBar = (progress: number) => {
		console.log(progress)
		// const value = progress * videoRef.current!.duration / 100
		// videoRef.current!.currentTime = isNaN(value) ? 0 : value
	}
  return <>
		<GlobalLoading isLoading={!videoInfo.loaded} message="加载中..."/>
		<GlobalLoading isLoading={videoInfo.export !== 0} message={ videoInfo.export === 1 ?'导出中...' : '导出完成'}/>
	 	<div style={{ opacity: videoInfo.export === 0 && videoInfo.loaded ? 1 : 0  }}>
			<canvas ref={perviewCanvasRef}></canvas>
			<FlatProgressBar initialValue={0} value={videoPlay.progress} isDrag={false} onChange={handleProgressBar}></FlatProgressBar>
			<div className="video-hanlde">
				<div className="video-hanlde-left">
					<button className="button" onClick={handelPlay} style={{ display: videoInfo.loaded ? 'block' : 'none', marginRight: '10px'}}>  {
						videoInfo.status ? '暂停' : '播放' }  </button> 
						<div style={{ display: videoPlay.loaded && videoPlay.duration > 0 ? 'block' : 'none' }}>
						{formatSecondsToHMS( videoPlay.duration * videoPlay.progress / 100 || 0 )}/{formatSecondsToHMS( videoPlay.duration || 0)}
						</div>
				</div>
				<button className="button bl"  onClick={handleExport}> 导出 </button>
			</div>
		</div>
		<video controls ref={videoRef} className="video-el" style={{ width: '760px',}} />
		<div className="exprot-contaner">
			<canvas ref={exportCanvasRef}></canvas>
		</div>
	</> 
}

export default EditorApp;


