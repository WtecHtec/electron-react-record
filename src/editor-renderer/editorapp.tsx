import { useEffect, useRef, useCallback, useState } from 'react';
import loadMP4Module from 'mp4-wasm/build/mp4';
import GlobalLoading from '../compents/globalloading';
import './editorapp.css'
import FlatProgressBar from '../compents/progressbar';
import { formatSecondsToHMS } from '../renderer/uitl';
let addFramesHandlers: Promise<any>[] = []
let savaFolder:string

interface WasmMP4 {
	end: () => Promise<Uint8Array>;
	addFrame: (data: Uint8Array) => Promise<void>;
}
function EditorApp() {
  const videoRef = useRef<HTMLVideoElement>(null);
	const [currentCanvas, setCurrentCanvas] = useState<HTMLCanvasElement | null>()
	const perviewCanvasRef = useRef<HTMLCanvasElement>(null)
	const exportCanvasRef = useRef<HTMLCanvasElement>(null)
	const mp4WasmRef = useRef<WasmMP4>(null)
	const perviewRef = useRef({
		wscale: 1,
		hscale: 1,
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
			}
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
				videoRef.current?.pause();
				videoRef.current!.currentTime = 0
				requestAnimationFrame(() => {
					videoRef.current?.play()
				})

			}
		}
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const handle = async (_: unknown, data: any) => {
			const {blobUrl, mouseEventDatas } = data
			console.log(mouseEventDatas)
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

	const drawVideoFrame = useCallback(async () => {
		if (!currentCanvas || !videoRef || !videoRef.current) return;
		const canvasWidth = currentCanvas.width
		const canvasHeight = currentCanvas.height
		const context = currentCanvas?.getContext('2d')
		context!.drawImage(videoRef.current, 0, 0, canvasWidth, canvasHeight);
		context!.restore()
		if (!videoInfo.status) return
		if (mp4WasmRef.current) {
			const addFrame = mp4WasmRef.current.addFrame(videoRef.current);
			addFramesHandlers.push(addFrame)
		}
		requestAnimationFrame(drawVideoFrame)
	}, [currentCanvas, videoInfo])

	const handelPlay = () => {
		videoInfo.status ? videoRef.current!.pause() :  videoRef.current!.play()
		const status = !videoInfo.status
		setVideoInfo({
			loaded: true,
			status: status,
			export: 0,
		})
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
		}
		const updateScrubber = () => {
			setVideoPlay((p) => {
				return  {
					...p,
					progress: videoRef.current!.currentTime / videoRef.current?.duration * 100,
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
		setCurrentCanvas(exportCanvasRef.current)
		requestAnimationFrame(() => {
			videoRef.current?.play()
			// mp4WasmRef.current!.start()
		})
		console.log('encoder---', encoder);
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


