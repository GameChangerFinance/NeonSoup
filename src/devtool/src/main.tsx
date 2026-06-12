import React from 'react';
import ReactDOM from 'react-dom/client';
import 'bootstrap/dist/css/bootstrap.min.css';
import 'bootstrap/dist/js/bootstrap.bundle.min.js';
import './styles/theme.css';
import './styles/app.css';
import App from './App';
import { AppStateProvider } from './state/appState';
import { StateRecoveryBoundary } from './components/common/StateRecoveryBoundary';

ReactDOM.createRoot(document.getElementById('root') as HTMLElement).render(
  <React.StrictMode>
    <StateRecoveryBoundary>
      <AppStateProvider>
        <App />
      </AppStateProvider>
    </StateRecoveryBoundary>
  </React.StrictMode>,
);
