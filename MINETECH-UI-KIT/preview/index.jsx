import React from 'react';
import ReactDOM from 'react-dom/client';
import { ThemeProvider } from '../themes/ThemeProvider';
import { GalleryApp } from './GalleryApp';
import '../styles/globals.css';

ReactDOM.createRoot(document.getElementById('root')).render(
  <React.StrictMode>
    <ThemeProvider defaultTheme="system">
      <GalleryApp />
    </ThemeProvider>
  </React.StrictMode>
);
