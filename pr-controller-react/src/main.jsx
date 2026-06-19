import React from 'react';
import { createRoot } from 'react-dom/client';
import './theme.css';
import App from './App.jsx';

// Restore the saved theme before first paint (ThemeSwitcher persists it). The DS
// ships locked to stone·dark; colors.css keys all six themes off <html data-theme>.
try {
  const saved = localStorage.getItem('pr-controller-theme');
  if (saved) document.documentElement.dataset.theme = saved;
} catch {}

createRoot(document.getElementById('root')).render(
  <React.StrictMode>
    <App />
  </React.StrictMode>
);
