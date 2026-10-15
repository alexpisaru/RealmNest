// Dev only: the EffectCraft character pipeline preview (docs/charpipe/REPORT.md), at /charpipe.html.
import '@fontsource-variable/inter';
import '@fontsource-variable/jetbrains-mono';
import { StrictMode } from 'react';
import { createRoot } from 'react-dom/client';
import '../../styles.css';
import './charpipe.css';
import { CharPipePreview } from './CharPipePreview';

createRoot(document.getElementById('root')!).render(
  <StrictMode>
    <CharPipePreview />
  </StrictMode>,
);
