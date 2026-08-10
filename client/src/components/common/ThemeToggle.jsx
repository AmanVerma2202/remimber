import { useTheme } from '../../store/themeStore';

/** Animated sun/moon toggle that flips the dark class and persists choice. */
export default function ThemeToggle() {
  const theme = useTheme((s) => s.theme);
  const toggle = useTheme((s) => s.toggle);

  return (
    <button
      onClick={toggle}
      aria-label="Toggle theme"
      title="Toggle theme"
      className="rounded-lg p-2 text-muted transition hover:bg-panel"
    >
      {theme === 'dark' ? '☀️' : '🌙'}
    </button>
  );
}