import './index.css'; // 引入CSS样式  

const GlobalLoading = ({ isLoading = false, message = 'Loading...' }) => {
	if (!isLoading) {
		return null; // 如果不需要加载，就不渲染任何内容  
	}

	return (<div className="loading-container global-loading">
		<div className="loading-spinner">
			{/* 这里可以放置你的加载动画图标，比如一个旋转的圆圈 */}
			<div className="loading-spinner-item"></div>
			<div className="loading-spinner-item"></div>
			<div className="loading-spinner-item"></div>
			<div className="loading-spinner-item"></div>
			<div className="loading-spinner-item"></div>
			<div className="loading-spinner-item"></div>
			<div className="loading-spinner-item"></div>
			<div className="loading-spinner-item"></div>
		</div>
		<p className="loading-text">{message}</p>
	</div>
	);
};

export default GlobalLoading;