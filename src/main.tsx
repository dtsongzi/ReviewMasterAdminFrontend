import { createRoot } from 'react-dom/client';
import './styles.css';
import { App } from './App.tsx';

const root = document.getElementById('root');
if (!root) throw new Error('挂载点 #root 未找到');

createRoot(root).render(<App />);
