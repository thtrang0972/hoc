import {createRoot} from 'react-dom/client';
import App from './App.tsx';
import './index.css';

// Xử lý an toàn cho unhandled promise rejections (ngăn crash "Uncaught (in promise) undefined")
if (typeof window !== 'undefined') {
  window.addEventListener('unhandledrejection', (event) => {
    if (!event.reason) {
      console.warn('Đã bắt và xử lý unhandled promise rejection undefined an toàn.');
      event.preventDefault();
    }
  });
}

createRoot(document.getElementById('root')!).render(<App />);
