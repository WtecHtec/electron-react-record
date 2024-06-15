import { createRoot } from 'react-dom/client';
import { MemoryRouter as Router, Routes, Route } from 'react-router-dom';
// import './App.css';
import DownMask from './downmask';

export default function App() {
  return (
    <Router>
      <Routes>
        <Route path="/" element={<DownMask />} />
      </Routes>
    </Router>
  );
}

// import App from './App';

const container = document.getElementById('root') as HTMLElement;
const root = createRoot(container);
root.render(<App />);
