import jwt from 'jsonwebtoken';
import User from '../models/User.js';

/** Sign a JWT for the given user and set it as an httpOnly cookie. */
export function setAuthCookie(res, user) {
  const token = jwt.sign({ id: user.id }, process.env.JWT_SECRET, {
    expiresIn: '7d',
  });
  res.cookie('token', token, {
    httpOnly: true,
    secure: process.env.NODE_ENV === 'production', // https only in prod
    sameSite: 'lax',
    maxAge: 7 * 24 * 60 * 60 * 1000, // 7 days
  });
}

/** Clear the auth cookie (logout). */
export function clearAuthCookie(res) {
  res.clearCookie('token');
}

/** Protect routes: read JWT from cookie, attach req.user. */
export async function authRequired(req, res, next) {
  const token = req.cookies?.token;
  if (!token) return res.status(401).json({ message: 'Not authenticated' });

  try {
    const payload = jwt.verify(token, process.env.JWT_SECRET);
    const user = await User.findById(payload.id);
    if (!user) return res.status(401).json({ message: 'User no longer exists' });

    req.user = user;
    next();
  } catch {
    return res.status(401).json({ message: 'Invalid or expired token' });
  }
}