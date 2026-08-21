import { StrictMode } from 'react';
import { createRoot } from 'react-dom/client';
import App from './App';
import { Boundary } from './components/boundary';
import { ToastHost } from './components/toast';
import { I18nProvider } from './lib/i18n';
import './index.css';

createRoot(document.getElementById('root')!).render(
  <StrictMode>
    <I18nProvider>
      <ToastHost>
        <Boundary>
          <App />
        </Boundary>
      </ToastHost>
    </I18nProvider>
  </StrictMode>,
);
