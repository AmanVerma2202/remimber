import User from '../models/User.js';
import { setAuthCookie, clearAuthCookie } from '../middleware/auth.js';

export const EMAIL_RX = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;

/** Sign up with an email + password; issues a JWT cookie straight away. */
export async function signup(req, res, next) {
  try {
    const { name, email, password } = req.body;

    if (!name || !email || !password)
      return res.status(400).json({ message: 'Name, email and password are required' });
    if (!EMAIL_RX.test(email)) return res.status(400).json({ message: 'Enter a valid email' });
    if (password.length < 6)
      return res.status(400).json({ message: 'Password must be at least 6 characters' });

    const existing = await User.findOne({ email });
    if (existing) return res.status(409).json({ message: 'An account with this email already exists' });

    const user = await User.create({ name, email, password });
    setAuthCookie(res, user);
    res.status(201).json({ user, message: 'Account created' });
  } catch (err) {
    next(err);
  }
}

/** Log in with an email + password. */
export async function login(req, res, next) {
  try {
    const { email, password } = req.body;
    if (!email || !password) return res.status(400).json({ message: 'Email and password are required' });

    // password is hidden by default, so explicitly select it for comparison
    const user = await User.findOne({ email }).select('+password');
    if (!user || !(await user.comparePassword(password)))
      return res.status(401).json({ message: 'Incorrect email or password' });

    setAuthCookie(res, user);
    res.json({ user, message: 'Logged in' });
  } catch (err) {
    next(err);
  }
}

/** Profile + theme preference for the logged-in user. */
export async function me(req, res, next) {
  try {
    const user = await User.findById(req.user.id);
    if (!user) return res.status(404).json({ message: 'User not found' });
    res.json({ user });
  } catch (err) {
    next(err);
  }
}

/** Persist theme preference (dark/light). */
export async function updateTheme(req, res, next) {
  try {
    const { theme } = req.body;
    if (!['light', 'dark'].includes(theme)) {
      return res.status(400).json({ message: 'theme must be light or dark' });
    }
    await User.findByIdAndUpdate(req.user.id, { theme });
    res.json({ message: 'Theme saved' });
  } catch (err) {
    next(err);
  }
}

/** Log out: clears the auth cookie. */
export function logout(_req, res) {
  clearAuthCookie(res);
  res.json({ message: 'Logged out' });
}