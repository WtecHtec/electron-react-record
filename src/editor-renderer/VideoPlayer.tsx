// src/editor-renderer/VideoPlayer.tsx
/* eslint-disable @typescript-eslint/no-explicit-any */

import { useEffect, useRef, useState } from 'react'

import './index.css'

import { formatSecondsToHMS, toBase64 } from './uitl';

import React from 'react';

import { Button, Drawer, Spin } from 'antd';

import { formatZoomDatas, getEffectFramesByZooms } from './frame';


import { getEffectFrames } from './uitl';



const MIN_FRAME_MOD_TIME = 0.4

const SCALE_DEFAULT = 1.2
const dpr = window.devicePixelRatio || 1;
function generateUUID() {

	return 'xxxxxxxx-xxxx-4xxx-yxxx-xxxxxxxxxxxx'.replace(/[xy]/g, function (c) {

		// eslint-disable-next-line prefer-const

		const r = (Math.random() * 16) | 0,

			v = c === 'x' ? r : (r & 0x3) | 0x8;

		return v.toString(16);

	});

}

const getId = () => {

	return generateUUID()

}


let timer = null;

const minsecondes = 2 // 最小秒数

let recorder; // 录屏


let recordEvents = [];

const VideoPlayer = (props) => {

	const videoRef = useRef<HTMLVideoElement>(null)

	const timeLineRef = useRef<HTMLDivElement>(null)

	const zoomRef = useRef<HTMLDivElement>(null)

	const zoomMaskRef = useRef<HTMLDivElement>(null)

	const plyrVideoRef = useRef<HTMLDivElement>(null)

	const plyrCanvasRef = useRef<HTMLCanvasElement>(null)

	const updateCanvasRef = useRef<HTMLCanvasElement>(null)

	const scaleUpdateDivRef = useRef<HTMLDivElement>(null)

	const exprotCanvasRef = useRef<HTMLCanvasElement>(null)

	const ffmpegRef = useRef<FFmpeg | null>(null)

	const mouseEvent = useRef({

		status: 1,

		time: 0,
		isDrag: false,
		direction: 'left',
		dragIndex: 0,
		minWidth: 10,
		cacheLeft: 0,
		cacheWidth: 0,
		targetDom: null,
		duration: 0,
		mintimeline: 0,

	})

	const [progressInfo, setProgressInfo] = useState({

		current: 0,
		move: 0,

	})

	const [zoomMaskInfo, setZoomMaskInfo] = useState({

		current: 0,
		status: true,
		width: 0,

	})


	const [playInfo, setPlayInfo] = useState({

		playing: false,
		status: false,
		update: false,
		duration: 0,
		current: 0,

	})


	const [attentionEyesInfo, setAttentionEyesInfo] = useState({

		selectIndex: -1,
		left: 0,
		top: 0,
		scale: 1.2,

	})


	const renderFrameInfo = useRef({

		lastScale: 1, // 上一帧的缩放

		event: null, // 当前事件

		index: 0, // 当前帧

		sx: 0, // 开始x

		sy: 0, //  开始y

		effectFrames: [],

		wscale: 1, // 缩放

		hscale: 1, // 缩放

		tReset: false, // 是否重置

		tIndex: 0, // 是否重置

		tx: 0, // 移动x

		ty: 0, // 移动y

	})


	const scaleInfoRef = useRef({

		updatescale: 1, // 更新时画布的缩放

		perviewScale: 1, // 预览时画布的缩放

		exportScale: 1,

		type: 0, // 操作类型

	})


	const [zoomDatas, setZoomDatas] = useState([])


	const [downUrl, setDownUrl] = useState('')


	const [playerRect, setPlayerRect] = useState({

		width: window.innerWidth,

	})



	const [open, setOpen] = useState(false);


	const [exporting, setExporting] = useState(false);


	// const [loadInfo, setLoadInfo] = useState({

	// 	isLoading: false,

	// 	message: 'load ffmpeg'

	// })


	const handleScaleUpdateMouseMove = (event) => {

		console.log('handleScaleUpdateMouseMove', event, attentionEyesInfo)

		const rect = scaleUpdateDivRef.current.getBoundingClientRect();

		const x = event.clientX - rect.left;

		const y = event.clientY - rect.top;

		// 限制可移动元素的位置，使其不超出容器

		const movableWidth = scaleUpdateDivRef.current.offsetWidth;

		const movableHeight = scaleUpdateDivRef.current.offsetHeight;

		const update = {

			left: x > movableWidth ? movableWidth : x < 0 ? 0 : x,

			top: y > movableHeight ? movableHeight : y < 0 ? 0 : y,

		}

		setAttentionEyesInfo((per) => ({

			...per,

			...update

		}))

		const newZoomDatas = [...zoomDatas]

		newZoomDatas[attentionEyesInfo.selectIndex] = {

			...newZoomDatas[attentionEyesInfo.selectIndex],

			scale: attentionEyesInfo.scale,

			x: update.left,

			y: update.top,

		}

		setZoomDatas(() => [...newZoomDatas])

	}


	const showDrawer = () => {

		setOpen(true);

	};


	const onClose = () => {

		scaleUpdateDivRef.current.removeEventListener('mousedown', handleScaleUpdateMouseMove)

		setOpen(false);

	};




	/**

	 * 初始化录制视频

	 */

	useEffect(() => {

		const handle = async (_: unknown, data: any) => {

			const {blobUrl, mouseEventDatas, recordTimeInfo} = data

			console.log("初始化录制视频:::", videoRef.current!.videoHeight, videoRef.current!.videoWidth)

			if (mouseEventDatas && mouseEventDatas.length && recordTimeInfo) {

				let events = getEffectFrames(recordTimeInfo, mouseEventDatas)

				renderFrameInfo.current.effectFrames = events as any;

               

				console.log("mouseEventDatas::",  events)

               

                

			}


            

    

            videoRef.current!.src = blobUrl;

            requestAnimationFrame(() => {

                setPlayInfo((per) => ({

                    ...per,

                    playing: true,

                } )as any);

            })



           

	

    };

    const handleDurationchange = () => {

       

        if (videoRef.current!.duration && Infinity !== videoRef.current!.duration) {

          

            initMouseEvent()


            requestAnimationFrame(() => {

                setPlayInfo((per) => ({

                    ...per,

                    playing: false,

                    status: true,

                    update: false,

                    duration: videoRef.current?.duration || 0,

                } )as any);

                let events = renderFrameInfo.current.effectFrames

                if (events && events.length) {

                    const originalMaxX = videoRef.current!.videoWidth;

                    const originalMaxY = videoRef.current!.videoHeight;

                     events = events.map((data) => {

                        return {

                            id: generateUUID(), // Generates a new unique ID

                            left: data.start * mouseEvent.current.mintimeline, // Calculation for 'left'

                            scale: "1.3", // Hardcoded based on your example

                            width:  mouseEvent.current.mintimeline , // Hardcoded based on your example

                            x: Math.round((data.x / originalMaxX) * 400), // Transformed X

                            y: Math.round((data.y / originalMaxY) * 400), // Transformed Y

                        };

                    })

                    console.log("events:::初始化：", events)

                    setZoomDatas( per => [...per, ...events])

                    videoRef.current!.style.opacity = 0
                    plyrCanvasRef.current!.style.opacity = 1

                }

                

            })

            

            // videoRef.current?.pause();

            // videoRef.current!.currentTime = 0

            // requestAnimationFrame(() => {

            // 	videoRef.current?.play()

            // })


        }

    }


    // const handleLoadedmetadata = () => {

    //     requestAnimationFrame(() => {

    //         videoRef.current?.play()

    //     })

    // }

    window.electron.ipcRenderer.on('record_url_main', handle);

    // videoRef.current!.addEventListener('loadedmetadata', handleLoadedmetadata);

    videoRef.current!.addEventListener('durationchange', handleDurationchange);

    return () => {

      window.electron.ipcRenderer.off('record_url_main', handle);

      videoRef.current!.removeEventListener('durationchange', handleDurationchange);

			

    //   videoRef.current!.removeEventListener('loadedmetadata', handleLoadedmetadata);

    };


	}, [ ])


	// const onFileChange = async (event) => {

	// 	setLoadInfo({ isLoading: true, message: 'load video' })

	// 	videoRef.current.src = ""

	// 	const file = event.target.files[0]

	// 		const videoUrl = URL.createObjectURL(file); // 创建URL

	// 		videoRef.current.src = videoUrl

	// 		setPlayInfo({

	// 			playing: false,

	// 			status: true,

	// 			update: false,

	// 		} as any);

	// 		setZoomDatas([])

	// 		event.target.value = ''

	// 	setTimeout(() => {

	// 		setLoadInfo({ isLoading: false, message: 'load video' })

	// 	}, 500)

	

	// }


	// useEffect(() => {

	//     /**

	//      * 选择 锚点

	//      * @param e 

	//      * @returns 

	//      */

	//     const handleClick = (e: any) => {

	//         if (attentionEyesInfo.selectIndex < 0) return

	//         // update scale

	//         let update = {}


	//         if (!e.target.className.includes('zoom-setting')) {

	//             update = {

	//                 x: e.offsetX,

	//                 y: e.offsetY,

	//             }

	//             console.log(' handleClick ---- update', update)

	//             setAttentionEyesInfo((per) => {

	//                 return {

	//                     ...per,

	//                     left: e.offsetX,

	//                     top: e.offsetY,

	//                 }

	//             })

	//         }

	//         const newZoomDatas = [...zoomDatas]

	//         newZoomDatas[attentionEyesInfo.selectIndex] = {

	//             ...newZoomDatas[attentionEyesInfo.selectIndex],

	//             ...update,

	//             vscale: attentionEyesInfo.scale,

	//         }

	//         console.log('newZoomDatas', newZoomDatas)

	//         setZoomDatas(() => [...newZoomDatas])

	//     }

	//     if (plyrVideoRef.current) {

	//         plyrVideoRef.current.addEventListener('click', handleClick)

	//     }

	//     return () => {

	//         if (plyrVideoRef!.current) {

	//             plyrVideoRef!.current.removeEventListener('click', handleClick)

	//         }

	//     }

	// }, [attentionEyesInfo.scale, attentionEyesInfo.selectIndex, zoomDatas])


	/**

	 * 点击其他地方 隐藏 锚点

	 * */

	// useEffect(() => {

	//     const handleDocumentClick = (e) => {

	//         if (!e.target.parentNode.className.includes('plyr--video')

	//             && !e.target.className.includes('zoom-item')

	//             && !e.target.parentNode.className.includes('dropdown')) {

	//             setAttentionEyesInfo((per) => {

	//                 return {

	//                     ...per,

	//                     selectIndex: -1,

	//                 }

	//             })

	//         }

	//     }

	//     document.addEventListener('click', handleDocumentClick)

	//     return () => {

	//         document.removeEventListener('click', handleDocumentClick)

	//     }

	// }, [])


	/**

	 * * @param moveValue 

	 * @returns 

	 */

	const getMinSeconds = (moveValue: number) => {

		// const diff = Math.round(moveValue / mouseEvent.current.mintimeline)

		// moveValue = Math.round(mouseEvent.current.mintimeline * diff)

		const diff = (moveValue / mouseEvent.current.mintimeline)

		moveValue = (mouseEvent.current.mintimeline * diff)

		moveValue = moveValue < 0 ? 0 : (moveValue > 100 ? 100 : moveValue)

		return Math.floor(moveValue)

	}

	// time line 

	useEffect(() => {

		const onMouseMove = (e: MouseEvent) => {

			videoRef.current?.pause()

			setPlayInfo(per => {

				return {

					...per,

					playing: false,

				}

			})

			const mod = timeLineRef.current?.clientWidth / 0.9 * 0.1 * 0.5

			let moveValue = Math.floor((e.clientX - mod) / timeLineRef.current?.clientWidth * 100)

			moveValue = getMinSeconds(moveValue)

			setProgressInfo(per => {

                console.log('moveValue-----', mouseEvent)

				videoRef.current.currentTime = mouseEvent.current.duration * moveValue / 100

				return {

					...per,

					move: moveValue

				}

			})

		}



		const onMouseDown = (e) => {

			const { target } = e

			if (target.className.includes('zoom-item-left') || target.className.includes('zoom-item-right')) return;

			setProgressInfo(per => {

				videoRef.current.currentTime = mouseEvent.current.duration * per.move / 100

				return {

					...per,

					current: per.move

				}

			})

		}


		if (timeLineRef.current) {

			timeLineRef.current.addEventListener('mousemove', onMouseMove)

			timeLineRef.current.addEventListener('mousedown', onMouseDown)

		}

		return () => {

			if (timeLineRef!.current) {

				timeLineRef!.current.removeEventListener('mousemove', onMouseMove);

				timeLineRef!.current.removeEventListener('mousedown', onMouseDown);

			}

		}

	}, [])


	useEffect(() => {

		if (attentionEyesInfo && attentionEyesInfo.selectIndex !== -1 && scaleUpdateDivRef.current) {

			scaleUpdateDivRef.current.addEventListener('mousedown', handleScaleUpdateMouseMove)

		}

		return () => {

			if (scaleUpdateDivRef.current) {

				scaleUpdateDivRef.current.removeEventListener('mousedown', handleScaleUpdateMouseMove)

			}

		}

	}, [attentionEyesInfo])


	/**

	 * 锚点 移动事件处理

	 */

	useEffect(() => {

		const onMouseMove = (e: MouseEvent) => {

			const { target } = e;

			const mod = zoomRef.current?.clientWidth / 0.9 * 0.1 * 0.5

			let moveValue = ((e.clientX - mod) / (zoomRef.current?.clientWidth)) * 100

			moveValue = moveValue < 0 ? 0 : (moveValue > 100 ? 100 : moveValue)

			moveValue = getMinSeconds(moveValue)

			const { isDrag, dragIndex, minWidth, direction, cacheLeft, cacheWidth, time, status } = mouseEvent.current

			if (status === 1 && time) {

				mouseEvent.current.status = 0

				return

			}

			const lastValue = cacheLeft + cacheWidth

			if (isDrag) {

				showZoomMask(false);

				if (direction === 'right') {

					const left = zoomDatas[dragIndex].left

					let width = moveValue - left;

					width = width > minWidth ? width : minWidth

					width = width <= 0 ? 0 : width

					const cpzoomDatas = [...zoomDatas]

					cpzoomDatas.sort((a, b) => a.left - b.left)

					for (let i = 0; i < cpzoomDatas.length; i++) {

						if (i !== dragIndex

							&& left < cpzoomDatas[i].left) {

							if (width + left >= cpzoomDatas[i].left) {

								width = cpzoomDatas[i].left - left

							}

							break

						}

					}

					setZoomDatas(per => {

						per[dragIndex].width = width

						return [...per]

					})

				} else if (direction === 'left') {

					const left = zoomDatas[dragIndex].left

					let nwmoveValue = moveValue >= lastValue - minWidth ? lastValue - minWidth : moveValue;

					const cpzoomDatas = [...zoomDatas]

					cpzoomDatas.sort((a, b) => (b.left + b.width) - (a.left + a.width))

					for (let i = 0; i < cpzoomDatas.length; i++) {

						if (i !== dragIndex

							&& left > cpzoomDatas[i].left) {

							if (nwmoveValue <= cpzoomDatas[i].left + cpzoomDatas[i].width) {

								nwmoveValue = cpzoomDatas[i].left + cpzoomDatas[i].width

							}

							break

						}

					}

					let nwidth = lastValue - nwmoveValue

					nwidth = nwidth > minWidth ? nwidth : minWidth

					setZoomDatas(per => {

						per[dragIndex].width = nwidth

						per[dragIndex].left = nwmoveValue

						return [...per]

					})

				}

			} else {

				showZoomMask(true);

			}


			// than 100%

			if (moveValue + mouseEvent.current.minWidth > 100) {

				showZoomMask(false)

			}


			// in zoom-item 

			if ((target as HTMLElement).className.includes('zoom-item')) {

				showZoomMask(false);

			}

			// range zoomdatas

			const postion = moveValue + zoomMaskInfo.width

			for (let i = 0; i < zoomDatas.length; i++) {

				const { left, width } = zoomDatas[i]

				if (postion > left && postion <= left + width) {

					showZoomMask(false)

					break

				}

				if (moveValue > left && moveValue < left + width) {

					showZoomMask(false)

					break

				}

			}


			setZoomMaskInfo(per => {

				return {

					...per,

					current: moveValue

				}

			})

		}

		const onMouseDown = (e) => {

			const { target } = e

            console.log("target.className:::", target.className)

			if (target.className.includes('zoom-mark')) {

				if (!getMaskStatus() || mouseEvent.current.duration < 2) return;

				setPlayInfo((per) => {

					return {

						...per,

						update: true,

					}

				})

				// add  zoom

				setZoomDatas(per => {

					return [

						...per,

						{

							id: getId(),

							left: zoomMaskInfo.current,

							width: mouseEvent.current.minWidth,

							x: 400 / 2,

							y: 200 / 2,

							scale: 1.2,

						}

					]

				})

				showZoomMask(false)

			} else if (target.className.includes('zoom-item-right')) {

				// drag right

				mouseEvent.current.status = 1

				showZoomMask(false)

				mouseEvent.current.time = setTimeout(() => {

					mouseEvent.current.isDrag = true

					mouseEvent.current.direction = 'right'

					mouseEvent.current.dragIndex = target.dataset['index']

					mouseEvent.current.cacheLeft = zoomDatas[target.dataset['index']].left

					mouseEvent.current.cacheWidth = zoomDatas[target.dataset['index']].width

					mouseEvent.current.status = 0

				}, 0) as any;

			} else if (target.className.includes('zoom-item-left')) {

				// drag left

				showZoomMask(false)

				mouseEvent.current.status = 1

				mouseEvent.current.time = setTimeout(() => {

					mouseEvent.current.isDrag = true

					mouseEvent.current.direction = 'left'

					mouseEvent.current.dragIndex = target.dataset['index']

					mouseEvent.current.cacheLeft = zoomDatas[target.dataset['index']].left

					mouseEvent.current.cacheWidth = zoomDatas[target.dataset['index']].width

					mouseEvent.current.targetDom = target

					mouseEvent.current.status = 0

				}, 0) as any;

			} else if (target.className.includes('zoom-item')) {

				// select zoom

				const index = target.dataset['index']

				const item = zoomDatas[index]

				showDrawer()

				requestAnimationFrame(() => {

					const context = updateCanvasRef.current.getContext('2d')
					if (context) { // Add null check for context
						context.imageSmoothingEnabled = false;
						context.imageSmoothingQuality = 'high';
					}

					// const videoWidth = videoRef.current?.videoWidth

					const videoHeight = videoRef.current?.videoHeight

					const wScale = scaleInfoRef.current.updatescale

					// scaleInfoRef.current.updatescale = wScale;


					const clientHeight = videoRef.current.clientHeight 

					context.clearRect(0, 0, 400, clientHeight)

					context.scale(wScale, wScale);

                    //  updateCanvasRef.current.width = videoRef.current?.videoWidth

					updateCanvasRef.current.height = videoRef.current?.videoHeight

					scaleUpdateDivRef.current.style.height = clientHeight + 'px'

					context.drawImage(videoRef.current, 0, 0, 400, clientHeight)

					setAttentionEyesInfo({

						selectIndex: index,

						left: item.x,

						top: item.y,

						scale: item.scale,

					});

				});

			}

		}


		const onMouseUp = () => {

			mouseEvent.current.isDrag = false

		}


		const onMouseLeave = () => {

			showZoomMask(false)

			mouseEvent.current.isDrag = false;

		}


		if (zoomRef.current) {

			zoomRef.current.addEventListener('mousemove', onMouseMove)

			zoomRef.current.addEventListener('mousedown', onMouseDown)

			zoomRef.current.addEventListener('mouseup', onMouseUp)

			zoomRef.current.addEventListener('mouseleave', onMouseLeave)

		}

		return () => {

			if (zoomRef!.current) {

				zoomRef!.current.removeEventListener('mousedown', onMouseDown)

				zoomRef!.current.removeEventListener('mousemove', onMouseMove)

				zoomRef!.current.removeEventListener('mouseup', onMouseUp)

				zoomRef!.current.removeEventListener('mouseleave', onMouseLeave)

			}

		}

	}, [zoomMaskInfo, zoomDatas])



	// eslint-disable-next-line react-hooks/exhaustive-deps

	const initMouseEvent = () => {

		console.log('initMouseEvent-----', videoRef)

		const width = timeLineRef.current?.clientWidth || 0

		const duration = (videoRef.current?.duration) || 0

		console.log('duration-----', duration, width)

		const scale = width / duration

		mouseEvent.current.mintimeline = ((scale * 1) / width * 100)

		mouseEvent.current.minWidth = Math.round(mouseEvent.current.mintimeline * minsecondes)

		mouseEvent.current.duration = duration

		// if (zoomDatas.length) {

		//     console.log('zoomDatas-----', zoomDatas, scale)

		// }

		const hScale = videoRef.current.clientHeight / videoRef.current.videoHeight

		scaleInfoRef.current.perviewScale = hScale;

		videoRef.current.style.width = videoRef.current.videoWidth * hScale  + 'px'
        // videoRef.current.style.height = videoRef.current.videoHeight  + 'px'



		plyrCanvasRef.current.width = videoRef.current.videoWidth 

		plyrCanvasRef.current.height = videoRef.current.videoHeight 

        exprotCanvasRef.current.width = videoRef.current.videoWidth 
		exprotCanvasRef.current.height = videoRef.current.videoHeight
        
        exprotCanvasRef.current.style.width = `${ videoRef.current.videoWidth * hScale}px`;
        exprotCanvasRef.current.style.height = `${videoRef.current.clientHeight }px`;

        const context  = plyrCanvasRef.current.getContext('2d')

			if (context) { // Add null check for context
				context.imageSmoothingEnabled = false;
				context.imageSmoothingQuality = 'high';
                // context.scale(dpr, dpr);
			}


     

          // 设置 canvas 尺寸为高分辨率
            // plyrCanvasRef.current.width = videoRef.current.videoWidth  * dpr;
            // plyrCanvasRef.current.height = videoRef.current.clientHeight * dpr;
            
            // // 缩放回正常显示尺寸（CSS 控制）
            plyrCanvasRef.current.style.width = `${ videoRef.current.videoWidth * hScale}px`;
            plyrCanvasRef.current.style.height = `${videoRef.current.clientHeight }px`;


		const videoWidth = videoRef.current?.videoWidth

        console.log('初始化 videoWidth ::: -----', videoWidth)
		const wScale = 400 / videoRef.current.videoWidth * hScale

		scaleInfoRef.current.updatescale = wScale;

        // scaleInfoRef.current.perviewScale = videoWidth;

        // scaleInfoRef.current.exportScale =  videoWidth;


      
		// setTimeout(() => {

		// 	drawVideoFrame();

		// 	const newZoomDatas = formatZoomDatas(recordEvents,

		// 		duration, scaleInfoRef.current.updatescale,	

		// 		scaleInfoRef.current.perviewScale, mouseEvent.current.minWidth);

		// 	console.log('newZoomDatas---', newZoomDatas)

		// 	setZoomDatas((per) => [...per, ...(newZoomDatas as any)])

		// }, 1000);

		setPlayInfo((per) => {

			return {

				...per,

				duration,

			}

		})

		setZoomMaskInfo(per => {

			return {

				...per,

				width: mouseEvent.current.minWidth

			}

		})

	}

	useEffect(() => {

		const updateScrubber = () => {

			console.log('updateScrubber-----', exporting)

			requestAnimationFrame(() => {

				if (exporting) return;

				const time = videoRef.current.currentTime

				const duration = mouseEvent.current.duration

				let position = (time / duration) * 100

				if (time === 0) {

					position = 0

				}

				setProgressInfo(per => {

					return {

						...per,

						current: position

					}

				})

				setPlayInfo((per) => {

					return {

						...per,

						current: time,

					}

				})

				if (!playInfo.playing) {

					if (timer) clearTimeout(timer);

					timer = setTimeout(() => {

						drawVideoFrame()

						clearTimeout(timer)

						timer = null

					}, 500) as any;

				}

			})

		}

		const handelEnded = () => {

			setPlayInfo((per) => {

				return {

					...per,

					playing: false,

				}

			})

			// 停止转换

			if (recorder) {

				recorder.stop();

			}

		}

		/**

		 * 初始化 时间轴

		 */

		const handleLoadedmetadata = () => {

            requestAnimationFrame(() => {

                videoRef.current?.play()



            })

			

		}

		const handleLoadstart = () => {


		}

		if (videoRef.current) {

			videoRef.current.addEventListener('timeupdate', updateScrubber)

			videoRef.current.addEventListener('ended', handelEnded)

			videoRef.current.addEventListener('loadedmetadata', handleLoadedmetadata)

			videoRef.current.addEventListener('loadstart', handleLoadstart)

		}

		return () => {

			if (videoRef!.current) {

				videoRef!.current.removeEventListener('timeupdate', updateScrubber)

				videoRef!.current.removeEventListener('ended', handelEnded)

				videoRef!.current.addEventListener('loadedmetadata', handleLoadedmetadata)

				videoRef!.current.removeEventListener('loadstart', handleLoadstart)

			}

		}

	}, [initMouseEvent, zoomDatas, exporting])


	const showZoomMask = (status: boolean) => {

		if (zoomMaskRef.current) {

			zoomMaskRef.current.style.opacity = status ? '1' : '0';

		}

	}

	const getMaskStatus = () => {

		if (zoomMaskRef.current) {

			return zoomMaskRef.current.style.opacity === String(1);

		}

		return true

	}


	// 更新视图

	useEffect(() => {

		console.log('更新视图 zoomDatas-----', zoomDatas)

		drawVideoFrame();

	}, [zoomDatas])


	/**

	 * 点击播放/暂停

	 */

	const onVideoPlay = () => {

		if (!playInfo.playing) {

			renderFrameInfo.current.event = null

			renderFrameInfo.current.index = 0
            scaleInfoRef.current.type  = 0
			videoRef.current?.play()

			drawVideoFrame(1)

		} else {

			videoRef.current?.pause()

		}

		setPlayInfo(per => {

			return {

				...per,

				playing: !playInfo.playing

			}

		})

	}


	/**

	 * * 删除锚点

	 */

	const onDeleteZoomItem = () => {

		if (attentionEyesInfo.selectIndex < 0) return

		const newDatas = [...zoomDatas]

		newDatas.splice(attentionEyesInfo.selectIndex, 1)

		setZoomDatas(newDatas)

		setAttentionEyesInfo((per => {

			return {

				...per,

				selectIndex: -1

			}

		}))

		onClose();


	}


	const onSaveFrame = async () => {

         

        const floder = await window.electron.ipcRenderer.invoke('select-folder-render')
		let savaFolder = floder
		if (!floder) return;


		videoRef.current.currentTime = 0

		scaleInfoRef.current.type = 1

		setExporting(true);

		// document.body.style.pointerEvents 

		requestAnimationFrame(() => {

			videoRef.current.play()

			drawVideoFrame(1);

			let stream = exprotCanvasRef.current.captureStream(60);

			const mimeType = 'video/webm;codecs=h264';

			// const mimeType = 'video/mp4;codecs=h264';

			recorder = new MediaRecorder(stream, { mimeType: mimeType });

			const data = []

			recorder.ondataavailable = function (event) {

				if (event?.data.size) data.push(event.data);

			}

			recorder.onstop = async () => {

				// let url = URL.createObjectURL(new Blob(data, { type:mimeType  }));

				//   console.log('recorder.onstop ----', url)

                const blob = new Blob(data, { type: 'video/webm;codecs=h264' });
				const blobUrl = URL.createObjectURL(blob);
				console.log('blob---', blob)



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
                    // const vfscale = `-vf scale=${videoRef.current.videoWidth   * dpr}:${videoRef.current.videoHeight  * dpr}:flags=lanczos`
                    // 将 ArrayBuffer 发送到主进程  
                    await window.electron.ipcRenderer.invoke('exprot-blob-render',  { arrayBuffer: arrayBuffer, folder: savaFolder  }); 
               
                })  
                .catch(error => {  
                    console.error('Error fetching Blob:', error);  
                });

				   // 创建一个临时的 <a> 元素

				//    const a = document.createElement('a');

				//    a.href = url;

				//    a.download = "avcraft.mp4";

			   

				//    // 模拟点击以触发下载

				//    document.body.appendChild(a);

				//    a.click();

			   

				//    // 清理

				//    document.body.removeChild(a);

				//    URL.revokeObjectURL(url); // 释放 URL 对象


				


				// const base64 = await toBase64(blob)

				// window.parent.postMessage({

				// 	action: 'download',

				// 	recordbase: base64,

				// }, '*')

				setExporting(false)

				timeLineRef.current.style.pointerEvents = 'auto'

				document.body.style.pointerEvents = 'auto'

			}

			recorder.start()

			timeLineRef.current.style.pointerEvents = 'none'

			document.body.style.pointerEvents = 'none'

			// setTimeout(() => {

			// 	typeof props.onExport === 'function' &&  props.onExport();

			// }, 500)

		})

	}


	/**

	 * 缩放程度

	 * @param

	 */

	const onScaleChange = (e) => {

		setAttentionEyesInfo((per) => {

			return {

				...per,

				scale: e.target.value

			}

		})

		if (attentionEyesInfo.selectIndex !== -1) {

			const newZoomDatas = [...zoomDatas]

			newZoomDatas[attentionEyesInfo.selectIndex] = {

				...newZoomDatas[attentionEyesInfo.selectIndex],

				scale: e.target.value,

			}

			setZoomDatas(() => [...newZoomDatas])

		}

	}


	/**

	 * 绘制视频

	 */

	const drawVideoFrame = (type = 0) => {

		if (type === 0 || (!videoRef.current.paused && !videoRef.current.ended)) {

			const { type: optType } = scaleInfoRef.current;

			const context = optType === 0
				? plyrCanvasRef.current.getContext('2d',  {
                    colorSpace: 'srgb',
                    alpha: false,
                    desynchronized: true, // 提高性能
                    willReadFrequently: false
                }
                )
				: exprotCanvasRef.current.getContext('2d',  {
                    colorSpace: 'srgb',
                    alpha: false,
                    desynchronized: true, // 提高性能
                    willReadFrequently: false
                }
                )

			if (context) { // Add null check for context
				context.imageSmoothingEnabled = false;
				context.imageSmoothingQuality = 'high';
			}
   

          
            
          

			const cw = optType === 0 ? plyrCanvasRef.current.width : plyrCanvasRef.current.width

			const ch = optType === 0 ? plyrCanvasRef.current.height : plyrCanvasRef.current.height

			// context.scale(1, 1);

              // 缩放 context，保证清晰度
         

			context.clearRect(0, 0, cw, ch);

			context.save()
            // context.scale(dpr, dpr);
          
      

			// context.scale(newScaleW, newScaleH);

			// 当前缩放帧数据

			let { index, event, lastScale, wscale, hscale, sx, sy } = renderFrameInfo.current


			if (zoomDatas.length > 0) {

				const effectFrames = getEffectFramesByZooms([...zoomDatas], videoRef.current.duration,

					scaleInfoRef.current.updatescale,

					optType === 0 ? scaleInfoRef.current.perviewScale : scaleInfoRef.current.perviewScale)

				// 检索帧

				if (!event || type === 0) {

					if (type === 0) {

						index = 0;

					}

					renderFrameInfo.current.tIndex = 0

					renderFrameInfo.current.tReset = true

					for (let i = index; i < effectFrames.length; i++) {

						const { start, t } = effectFrames[i]

						if (start <= videoRef.current.currentTime && videoRef.current.currentTime <= start + t) {

							event = effectFrames[i]

							renderFrameInfo.current.event = event

							renderFrameInfo.current.index = i + 1

							// renderFrameInfo.current.tx = (event as any).x

							// renderFrameInfo.current.ty = (event as any).y

							// console.log('检索帧 event----', event)

							break

						}

					}

				}

				// 处理帧

				if (event) {

					if (type === 0 && effectFrames.length && effectFrames[index - 1]) {

						event = effectFrames[index - 1]

						renderFrameInfo.current.event = event

					}

					let { x, y, start, t, children, scale = SCALE_DEFAULT } = event as any

					// x = x * scaleInfoRef.current.perviewScale

					// y = y * scaleInfoRef.current.perviewScale

					// 记录移动x\y;解决缩放帧还原空白

					// if (renderFrameInfo.current.tReset === true) {

					//     renderFrameInfo.current.sx = x

					//     renderFrameInfo.current.sy = y

					// }

					let newScale = 1

					// 开始帧

					if (videoRef.current.currentTime - start <= MIN_FRAME_MOD_TIME

						&& videoRef.current.currentTime - start > 0

					) {

						newScale = newScale + (videoRef.current.currentTime - start) / (MIN_FRAME_MOD_TIME) * (scale - 1)

						// newScale = newScale > scale ? scale : newScale;

						// console.log('开始帧 newScale----', newScale, scale);

						lastScale = newScale

						renderFrameInfo.current.lastScale = lastScale

					}

					// 结束帧

					if (videoRef.current.currentTime >= start + t - MIN_FRAME_MOD_TIME && videoRef.current.currentTime < start + t) {

						// console.log('结束帧', renderFrameInfo.current)

						newScale = lastScale - ((lastScale - 1) - (start + t - videoRef.current.currentTime) / MIN_FRAME_MOD_TIME * (lastScale - 1))

						console.log('结束帧 newScale----', newScale);

						newScale = newScale < 1 ? 1 : newScale;

					}

					// 持续帧

					if (videoRef.current.currentTime - start > MIN_FRAME_MOD_TIME && videoRef.current.currentTime <= start + t - MIN_FRAME_MOD_TIME) {

						newScale = lastScale === scale ? lastScale : scale

					}


					// x = renderFrameInfo.current.sx

					// y = renderFrameInfo.current.sy

					console.log('计算 newScale---- 1', x, y);

                   // context.setTransform(1, 0, 0, 1, 0, 0); // 重置

                //    const rects = plyrCanvasRef.current?.getBoundingClientRect()
                //    const zoomWidth = rects?.width || 0
                //    const zoomHeight =rects?.height || 0
                //      // 原始裁剪区域
                //     let sx = x - zoomWidth / 2;
                //     let sy = y - zoomHeight / 2;

                //     console.log('计算 newScale---- 2', zoomWidth, zoomHeight, sx, sy);

                    // 🚧 限制裁剪区域在视频范围内
                     // 四种情况
                    // if (sx < 0) sx = x;
                    // if (sy < 0) sy = y;
                    // if (sx + cw > videoWidth) sx = videoWidth - zoomWidth;
                    // if (sy + zoomHeight > videoHeight) sy = videoHeight - zoomHeight;

                   
                    // if (sx  > 0) {
                    //     sx =  zoomWidth - x
                    // }

                    // if (sy  > 0) {
                    //     sy =  zoomHeight - y
                    // }
                    
                    // console.log('计算 newScale---- 3', zoomWidth, zoomHeight, sx, sy);

                    context.translate(x, y);               // 平移
                    context.scale(newScale, newScale);           // 缩放
                  
                    context.translate(-x, -y);
         

               
					// context.translate(x, y);

					// context.scale(newScale, newScale);

					// context.translate(-x, -y);


					if (videoRef.current.currentTime >= start + t) {

						event = null

						renderFrameInfo.current.event = event

						renderFrameInfo.current.index = 0

					}

				}

			}

			context.drawImage(videoRef.current, 0, 0, cw, ch)

			context.restore()

			if (type === 1) {

				requestAnimationFrame(drawVideoFrame.bind(this, type))

			}

		}

	}


	const onDownLoad = async () => {

		if (!downUrl) return;

	}

	return <>

		<div className="videoPlayer" style={{ minWidth: playerRect.width + 'px', maxWidth: playerRect.width + 'px', }}>

			<div className="playerWrap">

				<div className="plyr--video" ref={plyrVideoRef}>

					{/* <div className="desc"> Upload Video</div> */}

					<video className="ply-video  " src="" ref={videoRef} playsinline={true} controls={false} ></video>

					<canvas className="ply-video-canvas opacity-0 " ref={plyrCanvasRef} ></canvas>

					{/* <div className="dropdown" style={{ left: `${attentionEyesInfo.left}px`, top: `${attentionEyesInfo.top}px`, display: attentionEyesInfo.selectIndex > -1 ? 'block' : 'none' }}>

                        <div className="attention-eyes" > </div>

                        <div className="dropdown-opreation">

                            <input type="range" onChange={onScaleChange} value={attentionEyesInfo.scale * 100} min={1} max={10} className="zoom-setting"></input>

                        </div>

                    </div> */}


				</div>

			</div>

			<div className="control">

				<div className="operation">

					<div style={{ display: 'flex', }}>

					{/* <button className="button default">

							<label htmlFor="upload">上传视频</label>

							<input type="file" id="upload" accept="video/*" onChange={onFileChange} style={{ display: 'none' }} ></input>

						</button> */}

						<button className="button default" onClick={onVideoPlay} disabled={!playInfo.status}>

							{playInfo.playing ? '暂  停' : '播  放'}

						</button>


					</div>

					<div style={{ color: '#666666', }}>

						{formatSecondsToHMS(playInfo.current || 0)} / {formatSecondsToHMS(playInfo.duration)}

					</div>

					<div style={{ display: 'flex', }}>

						<button className="button default" onClick={onSaveFrame}>

							{exporting ? <> <Spin />正在导出</> : '导出'}

						</button>

						{

							downUrl ? <>

								<button className="button default" onClick={onDownLoad}>

									预览视频

								</button>

								{/* <button className="button default" onClick={() => window.location.href = downUrl}>

									预览结果

								</button> */}

							</>

								: null

						}


					</div>

				</div>

				<div className="time-line" ref={timeLineRef} style={{ pointerEvents: !playInfo.status ? 'none' : 'auto' }}>

					<div className="time-line-progress" style={{ left: `${progressInfo.current}%` }}></div>

					<div className="time-line-progress time-line-progress-mark" style={{ left: `${progressInfo.move}%` }}></div>

					<div className="video-frame-line">

						<div className="video-frame-progress" style={{ width: `${progressInfo.current}%` }}></div>

					</div>

					<div className="attention-control" ref={zoomRef}>

						<div className="zoom-mark" ref={zoomMaskRef} style={{ left: `${zoomMaskInfo.current}%`, width: `${zoomMaskInfo.width}%`, transform: `translateX(-10px)` }}>+</div>

						{

							zoomDatas.length === 0

								? <div className="tip"> click add zoom</div>

								: zoomDatas.map((item, index) => {

									return <div className="zoom-item" data-index={index} style={{ left: `${item.left}%`, width: `${item.width}%` }} key={item.id}>

										<div className="zoom-item-left" data-index={index} ></div>

										<div className="zoom-item-right" data-index={index} ></div>

									</div>

								})

						}

					</div>

				</div>

			</div>

		</div>

		<Drawer title="Scale" keyboard={false} width={450} maskClosable={false} onClose={onClose} open={open} zIndex={999999}>

			<p>

				Position：

				<div className="scale-update" ref={scaleUpdateDivRef}>

					<canvas width={400} ref={updateCanvasRef}></canvas>

					<div className="dropdown" style={{ left: `${attentionEyesInfo.left}px`, top: `${attentionEyesInfo.top}px`, display: attentionEyesInfo.selectIndex > -1 ? 'block' : 'none' }}>

						<div className="attention-eyes" > </div>

					</div>

				</div>

			</p>

            <div style={{ marginTop: '24px',position:'relative', zIndex:999 }}>

			<p >

				Zoom Scale:

				<input type="range" onChange={onScaleChange} step={0.1} value={attentionEyesInfo.scale} min={1} max={2} className="zoom-setting"></input>

			</p>

			<p>

				{

					attentionEyesInfo.selectIndex !== -1

						? <button className="button default" onClick={onDeleteZoomItem} >删&nbsp;&nbsp;除</button>

						: null

				}

			</p>

            </div>

		</Drawer>

		<canvas className="export-canvas" ref={exprotCanvasRef}></canvas>

	</>

}


export default VideoPlayer