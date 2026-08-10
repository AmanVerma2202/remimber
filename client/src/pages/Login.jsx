import { useState } from 'react';
import { useNavigate, Navigate } from 'react-router-dom';
import { motion } from 'framer-motion';
import { useAuth } from '../store/authStore';

export default function Login() {
  const { user, login, signup } = useAuth();
  const [mode, setMode] = useState('login'); // 'login' | 'signup'
  const [form, setForm] = useState({ name: '', email: '', password: '' });
  const [error, setError] = useState('');
  const [busy, setBusy] = useState(false);
  const navigate = useNavigate();

  if (user) return <Navigate to="/" replace />;

  const set = (k) => (e) => setForm((f) => ({ ...f, [k]: e.target.value }));

  const submit = async (e) => {
    e.preventDefault();
    setError('');
    setBusy(true);
    try {
      if (mode === 'signup') await signup(form.name, form.email, form.password);
      else await login(form.email, form.password);
      navigate('/');
    } catch (err) {
      setError(err.response?.data?.message || 'Something went wrong. Try again.');
    } finally {
      setBusy(false);
    }
  };

  return (
    <div className="flex h-full items-center justify-center p-4">
      <motion.div
        initial={{ opacity: 0, y: 16 }}
        animate={{ opacity: 1, y: 0 }}
        className="w-full max-w-sm rounded-2xl bg-panel p-8 shadow-lg"
      >
        {/* brand */}
        <div className="mb-6 flex items-center gap-3">
          <img src="/remimber-icon.svg" alt="remimber logo" className="h-14 w-14 drop-shadow" />
          <div>
            <h1 className="text-xl font-bold leading-tight">remimber</h1>
            <p className="text-xs text-muted">Write. Organize. Remember.</p>
          </div>
        </div>

        {/* login / signup tabs */}
        <div className="mb-5 grid grid-cols-2 rounded-lg bg-canvas p-1 text-sm">
          <button
            type="button"
            onClick={() => setMode('login')}
            className={`rounded-md py-1.5 ${mode === 'login' ? 'bg-accent font-medium text-white' : 'text-muted'}`}
          >
            Sign in
          </button>
          <button
            type="button"
            onClick={() => setMode('signup')}
            className={`rounded-md py-1.5 ${mode === 'signup' ? 'bg-accent font-medium text-white' : 'text-muted'}`}
          >
            Create account
          </button>
        </div>

        <form onSubmit={submit} className="space-y-3">
          {mode === 'signup' && (
            <input
              value={form.name}
              onChange={set('name')}
              placeholder="Your name"
              required
              className="w-full rounded-lg border border-panel bg-canvas px-3 py-2"
            />
          )}
          <input
            type="email"
            value={form.email}
            onChange={set('email')}
            placeholder="Email"
            required
            className="w-full rounded-lg border border-panel bg-canvas px-3 py-2"
          />
          <input
            type="password"
            value={form.password}
            onChange={set('password')}
            placeholder="Password (min 6 chars)"
            minLength={6}
            required
            className="w-full rounded-lg border border-panel bg-canvas px-3 py-2"
          />

          {error && <p className="rounded-lg bg-red-50 px-3 py-2 text-sm text-red-600">{error}</p>}

          <button
            type="submit"
            disabled={busy}
            className="w-full rounded-xl bg-accent py-2.5 font-medium text-white disabled:opacity-60"
          >
            {busy ? 'Please wait…' : mode === 'signup' ? 'Create account' : 'Sign in'}
          </button>
        </form>
      </motion.div>
    </div>
  );
}