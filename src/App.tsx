import { BrowserRouter, Routes, Route } from 'react-router-dom';
import { LandingPage } from './pages/LandingPage';
import { MeasurementWorkspace } from './pages/MeasurementWorkspace';
import './index.css';

function App() {
  return (
    <BrowserRouter>
      <Routes>
        <Route path="/" element={<LandingPage />} />
        <Route path="/measure" element={<MeasurementWorkspace />} />
      </Routes>
    </BrowserRouter>
  );
}

export default App;
