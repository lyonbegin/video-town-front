import { BrowserRouter, Route, Routes } from 'react-router-dom';
import ClinicalFrontendRoot from './clinical/ClinicalFrontendRoot';
import LegacyTelemedicineApp from './LegacyTelemedicineApp';
import AutomatedBpMonitorScreen from './devices/automated-bp-monitor/AutomatedBpMonitorScreen';

export default function App() {
  return (
    <BrowserRouter>
      <Routes>
        <Route path="/vdev2/devices/automated-bp-monitor/*" element={<AutomatedBpMonitorScreen />} />
        <Route path="/clinical/*" element={<ClinicalFrontendRoot />} />
        <Route path="*" element={<LegacyTelemedicineApp />} />
      </Routes>
    </BrowserRouter>
  );
}
