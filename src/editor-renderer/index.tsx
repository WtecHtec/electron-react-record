import React from 'react';
import ReactDOM from 'react-dom/client';
import EditorApp from './editorapp';
import VideoPlayer from './VideoPlayer';
ReactDOM.createRoot(document.getElementById('root')!).render(
  <React.StrictMode>
    {/* <EditorApp /> */}
    <VideoPlayer />
  </React.StrictMode>,
);
