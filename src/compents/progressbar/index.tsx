import  { useRef, useState, useEffect } from 'react';  
import './index.css'
function FlatProgressBar({ initialValue = 0, value = 0, onChange = (p: number)=> {} }) {
  const [progress, setProgress] = useState(initialValue);  
  const progressBarRef = useRef<HTMLDivElement>(null);  
  const handleRef = useRef<HTMLDivElement>(null);  
  
	useEffect(() => {
		setProgress(value);
	}, [value])
  // 拖拽逻辑  
  const handleDrag = (e: any) => {  
		if (!progressBarRef.current) return
    const rect = (progressBarRef.current as any)?.getBoundingClientRect();  
    const percent = Math.max(0, Math.min(1, (e.clientX - rect.left) / rect.width));  
    setProgress(percent * 100);  
    if (onChange && typeof onChange === 'function') onChange(percent * 100);  
  }
  
  useEffect(() => {  
    const handleMouseDown = (e: any) => {
      document.addEventListener('mousemove', handleDrag);  
      document.addEventListener('mouseup', handleMouseUp);  
    };  
  
    const handleMouseUp = () => {  
      document.removeEventListener('mousemove', handleDrag);  
      document.removeEventListener('mouseup', handleMouseUp);  
    };  
  
    handleRef.current?.addEventListener('mousedown', handleMouseDown);  
		progressBarRef.current?.addEventListener('mousedown', handleDrag);  
    return () => {  
      handleRef.current?.removeEventListener('mousedown', handleMouseDown);  
			progressBarRef.current?.removeEventListener('mousedown', handleDrag); 
    };  
  }, []);  
  
  return (  
    <div  
      ref={progressBarRef}  
      className="progress-bar-container"  
      style={{ background: 'lightgray' }}  
    >  
      <div  
        ref={handleRef}  
        className="progress-bar"  
        style={{ width: `${progress}%`, background: 'rgb(51, 109, 244)' }}  
      />  
    </div>  
  );  
}
  
export default FlatProgressBar;