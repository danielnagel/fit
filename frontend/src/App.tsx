import { BrowserRouter, Navigate, Route, Routes, useLocation } from 'react-router-dom';
import { AuthProvider, useAuth } from './AuthContext';
import Login from './Login';
import Nav from './Nav';
import Exercises from './Exercises';
import Plans from './Plans';
import Training from './Training';
import History from './History';
import TrainingMethods from './TrainingMethods';

type LoginRedirectState = { from?: string } | null;

// After (re-)login go back to the original URL, e.g. a running session -- its state lives on the
// server, reloading the page is enough to resume it.
function AfterLogin() {
  const from = (useLocation().state as LoginRedirectState)?.from;
  return <Navigate to={from && from !== '/login' ? from : '/training'} replace />;
}

function ToLogin() {
  const location = useLocation();
  return <Navigate to="/login" replace state={{ from: `${location.pathname}${location.search}` }} />;
}

function AppRoutes() {
  const { state, logout } = useAuth();

  if (state.status === 'loading') return null;

  if (state.status === 'anonymous') {
    return (
      <Routes>
        <Route path="/login" element={<Login />} />
        <Route path="*" element={<ToLogin />} />
      </Routes>
    );
  }

  return (
    <>
      <Nav username={state.user.username} onLogout={logout} />
      <main className="mx-auto max-w-5xl px-4 pb-24 pt-6 sm:px-6 sm:pb-12">
        <Routes>
          <Route path="/login" element={<AfterLogin />} />
          <Route path="/training" element={<Training />} />
          <Route path="/plans" element={<Plans />} />
          <Route path="/training-methods" element={<TrainingMethods />} />
          <Route path="/exercises" element={<Exercises />} />
          <Route path="/history" element={<History />} />
          <Route path="*" element={<Navigate to="/training" replace />} />
        </Routes>
      </main>
    </>
  );
}

export default function App() {
  return (
    <BrowserRouter>
      <AuthProvider>
        <AppRoutes />
      </AuthProvider>
    </BrowserRouter>
  );
}
