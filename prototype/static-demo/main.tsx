import { createRoot } from 'react-dom/client';
import { LiveGame } from './live-game';
import '../app/globals.css';
import '../app/outpost.css';
import './fonts.css';

createRoot(document.getElementById('root')!).render(<LiveGame />);
