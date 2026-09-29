import { BrowserRouter, Navigate, Route, Routes } from 'react-router-dom';
import Nav from './Nav';
import Exercises from './Exercises';
import Plans from './Plans';
import Training from './Training';
import History from './History';
import TrainingMethods from './TrainingMethods';

export default function App() {
  return (
    <BrowserRouter>
      <Nav />
      <main className="mx-auto max-w-5xl px-4 pb-24 pt-6 sm:px-6 sm:pb-12">
        <Routes>
          <Route path="/training" element={<Training />} />
          <Route path="/plans" element={<Plans />} />
          <Route path="/training-methods" element={<TrainingMethods />} />
          <Route path="/exercises" element={<Exercises />} />
          <Route path="/history" element={<History />} />
          <Route path="*" element={<Navigate to="/training" replace />} />
        </Routes>
      </main>
    </BrowserRouter>
  );
}
