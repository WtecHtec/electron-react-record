import { useEffect, useRef } from 'react';

import './markapp.css';

// 初始化画笔状态  
let isDrawing = false;  
let lastX = 0;  
let lastY = 0;  
const pixelRatio = devicePixelRatio

function MarkApp() {
	const canvasRef =  useRef<HTMLCanvasElement>(null)
	useEffect(() => {
		if (!canvasRef.current) return
		const canvas = canvasRef.current
		const context = canvas.getContext('2d')
		if (!context) return
		// 设置实际大小
		canvas.width = canvas.clientWidth * pixelRatio
		canvas.height = canvas.clientHeight * pixelRatio
		// context.scale(pixelRatio, pixelRatio);
		// 绘制函数  
		function draw(e: any, currentX = lastX, currentY = lastY) { 
			context?.beginPath();  
			context?.moveTo(lastX * pixelRatio, lastY * pixelRatio);  
			context?.lineTo(currentX * pixelRatio, currentY * pixelRatio);  
			// 设置画笔样式  
			context!.lineCap = 'round';
			context!.lineWidth = 8;  
			context!.strokeStyle = '#ff0000';
			context?.stroke();
			[lastX, lastY] = [currentX, currentY];  
		}
		// 监听鼠标按下事件  
		canvasRef.current.addEventListener('mousedown', (e) => {
			console.log('mousedown---', e)
			// 当鼠标按下时，开始绘制  
			e.preventDefault();  
			// 获取鼠标相对于canvas的位置  
			// const rect = canvasRef.current?.getBoundingClientRect();  
			// lastX = e.clientX - rect!.left;  
			// lastY = e.clientY - rect!.top;  
			[lastX, lastY] = [e.clientX, e.clientY]
			// 开始绘制
			isDrawing = true;
			draw(e);
		});
		// 监听鼠标移动事件  
		canvasRef.current.addEventListener('mousemove', (e) => {
			// 如果正在绘制，则绘制线条  
			if (!isDrawing) return;   // 阻止默认事件（例如，防止页面滚动）  
			e.preventDefault();  
			// 获取鼠标相对于canvas的位置  
			// const rect = canvasRef.current?.getBoundingClientRect();  
			// const x = e.clientX - rect!.left;  
			// const y = e.clientY - rect!.top;  
			draw(e, e.clientX, e.clientY); 
		});
		// 监听鼠标释放或离开canvas事件  
		canvasRef.current.addEventListener('mouseup', () => isDrawing = false);  
		canvasRef.current.addEventListener('mouseout', () => isDrawing = false); 
	}, [])
  return (
    // eslint-disable-next-line jsx-a11y/click-events-have-key-events, jsx-a11y/no-static-element-interactions
    <div className="mark-container">
      <canvas className="mark-canvas" ref={canvasRef}></canvas>
    </div>
  );
}

export default MarkApp;
