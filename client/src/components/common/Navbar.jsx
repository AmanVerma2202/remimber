import { useNavigate } from 'react-router-dom';
import { useAuth } from '../../store/authStore';
import ThemeToggle from './ThemeToggle';

export default function Navbar() {
  const { user, logout } = useAuth();
  const navigate = useNavigate();

  const handleLogout = async () => {
    await logout();
    navigate('/login');
  };

  return (
    <header className="flex items-center justify-between border-b border-panel bg-panel/60 px-4 py-2">
      <div className="flex items-center gap-3">
        <img src="/remimber-icon.svg" alt="remimber logo" className="h-9 w-9" />
        <h1 className="text-lg font-bold">remimber</h1>
      </div>
      <div className="flex items-center gap-3">
        <ThemeToggle />
        {user && (
          <>
            <span className="hidden text-sm text-muted sm:inline">{user.name}</span>
            {user.avatar && (
              <img
                src={user.avatar}
                alt={user.name}
                className="h-8 w-8 rounded-full"
                referrerPolicy="no-referrer"
              />
            )}
            <button
              onClick={handleLogout}
              className="rounded-lg bg-accent px-3 py-1 text-sm text-white"
            >
              Logout
            </button>
          </>
        )}
      </div>
    </header>
  );
}