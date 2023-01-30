import React from 'react';
import { createRoot } from 'react-dom/client';
import { App } from './App';
import '@arcgis/core/assets/esri/themes/dark/main.css';
import '@esri/calcite-components/dist/calcite/calcite.css';
import '@esri/calcite-components/dist/components/calcite-block';
import '@esri/calcite-components/dist/components/calcite-label';
import '@esri/calcite-components/dist/components/calcite-panel';
import '@esri/calcite-components/dist/components/calcite-shell';
import '@esri/calcite-components/dist/components/calcite-shell-panel';

import { MapStateProvider } from '../src/hooks/MapStateContext';
import { TestsRouter } from './TestsRouter';

// Create a root element for the application
const root = createRoot(document.querySelector('#root')!);

// Render the application
root.render(
  <MapStateProvider>
    <TestsRouter />
  </MapStateProvider>
);
