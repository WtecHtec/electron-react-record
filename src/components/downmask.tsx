
import {  useEffect, useState } from 'react'
import './downmask.css'


function DownMask() {
  const [count, setCount] = useState(3)

	useEffect(() => {
		if (count <= 0) {
			window?.ipcRenderer.send('count_down_end_render')
			return
		} 
		const interval = setInterval(() => {
			setCount(count - 1)
		}, 1000)
		return () => {
			interval && clearInterval(interval);
		}
	}, [count])
  return (
    <>
			<div className="countdown">{ count }</div>
    </>
  )
}

export default DownMask
