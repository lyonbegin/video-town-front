import {
  BrowserRouter,
  Route,
  Routes,
} from 'react-router-dom';
import VideoCorePlayground from './VideoCorePlayground';

export default function App() {
  return (
    <BrowserRouter>
      <Routes>
        <Route
          path="*"
          element={<VideoCorePlayground />}
        />
      </Routes>
    </BrowserRouter>
  );
}
