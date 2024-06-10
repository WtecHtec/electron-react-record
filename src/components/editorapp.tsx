import { useEffect, useRef } from "react"

function EditorApp() {
	const videoRef = useRef<HTMLVideoElement>(null)
	useEffect(() => {
		const handle =  async (_: unknown, url: string) => { 
			videoRef.current!.src = url
			videoRef.current!.addEventListener('loadedmetadata', () => {
				videoRef.current!.play()
			})
		}
		window.ipcRenderer.on('record_url_main', handle)
		return () => {
			window.ipcRenderer.off('record_url_main', handle)
		}
	}, [])
	return <>
		<video controls ref={videoRef} style={{ width: '100vw' }}></video>
	</>
}

export default EditorApp