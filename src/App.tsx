import { useEffect } from 'react';
import {
  BrowserRouter,
  Route,
  Routes,
} from 'react-router-dom';
import VideoCorePlayground from './VideoCorePlayground';

function SdkPlaygroundRedirect() {
  useEffect(() => {
    window.location.replace('/sdk-playground.html');
  }, []);

  return (
    <main className="app-shell">
      <div className="dashboard-head">
        <div>
          <div className="section-kicker">VIDEO CORE</div>
          <h1>SDK Playground로 이동 중…</h1>
        </div>
      </div>
    </main>
  );
}

export default function App() {
  return (
    <BrowserRouter>
      <Routes>
        <Route path="/" element={<SdkPlaygroundRedirect />} />
        <Route path="/advanced" element={<VideoCorePlayground />} />
        <Route path="*" element={<VideoCorePlayground />} />
      </Routes>
    </BrowserRouter>
  );
}
