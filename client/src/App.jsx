import { Suspense, lazy, useEffect } from 'react';
import { Routes, Route } from 'react-router-dom';
import { useAuth } from './store/authStore';
import { useTheme } from './store/themeStore';
import Navbar from './components/common/Navbar';
import ProtectedRoute from './components/common/ProtectedRoute';
import Login from './pages/Login';
import Dashboard from './pages/Dashboard';

// the editor pulls in fabric + jspdf (~1.5MB), so load it only when opened
const Editor = lazy(() => import('./pages/Editor'));
const SharedEditor = lazy(() => import('./pages/SharedEditor'));

export default function App() {
  const { user, fetchMe } = useAuth();
  const initTheme = useTheme((s) => s.init);

  // restore session + theme on first load
  useEffect(() => {
    fetchMe().then(initTheme);
  }, []);

  return (
    <div className="flex h-full flex-col">
      <Navbar />
      <main className="flex-1 overflow-auto">
        <Routes>
          <Route path="/login" element={<Login />} />
          <Route
            path="/"
            element={
              <ProtectedRoute user={user}>
                <Dashboard />
              </ProtectedRoute>
            }
          />
          <Route
            path="/notes/:id"
            element={
              <ProtectedRoute user={user}>
                <Suspense fallback={<div className="p-8 text-center text-muted">Opening note…</div>}>
                  <Editor />
                </Suspense>
              </ProtectedRoute>
            }
          />
          <Route
            path="/s/:code"
            element={
              <ProtectedRoute user={user}>
                <Suspense fallback={<div className="p-8 text-center text-muted">Opening shared note…</div>}>
                  <SharedEditor />
                </Suspense>
              </ProtectedRoute>
            }
          />
        </Routes>
      </main>
    </div>
  );
}