import { BrowserRouter, Route, Routes } from 'react-router-dom';
import ClinicalFrontendRoot from './clinical/ClinicalFrontendRoot';
import LegacyTelemedicineApp from './LegacyTelemedicineApp';
import AutomatedBpMonitorScreen from './devices/automated-bp-monitor/AutomatedBpMonitorScreen';
import VideoCorePlayground from './VideoCorePlayground';

export default function App() {
  return (
    <BrowserRouter>
      <Routes>
        <Route path="/" element={<VideoCorePlayground />} />
        <Route path="/legacy/*" element={<LegacyTelemedicineApp />} />
        <Route path="/vdev2/devices/automated-bp-monitor/*" element={<AutomatedBpMonitorScreen />} />
        <Route path="/clinical/*" element={<ClinicalFrontendRoot />} />
        <Route path="*" element={<VideoCorePlayground />} />
      </Routes>
    </BrowserRouter>
  );
}
