import 'dotenv/config';
import express from 'express';
import cors from 'cors';
import cookieParser from 'cookie-parser';
import path from 'path';
import { existsSync } from 'fs';
import { fileURLToPath } from 'url';

import connectDB from './config/db.js';
import authRoutes from './routes/authRoutes.js';
import noteRoutes from './routes/noteRoutes.js';
import uploadRoutes from './routes/uploadRoutes.js';
import { attachRealtime } from './realtime.js';
import { errorHandler, notFound } from './middleware/errorHandler.js';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const DIST = path.join(__dirname, '..', 'client', 'dist');

const app = express();

// ---------- global middleware ---------
app.set('trust proxy', true); // Render/Vercel terminate TLS before Express

app.use(
  cors({
<<<<<<< HEAD
    origin: process.env.CLIENT_URL || 'https://akaremimber.vercel.app/',
=======
    // Normalize trailing slashes and accept a comma-separated list so the
    // CLIENT_URL value never breaks preflight (e.g. "...vercel.app/" vs "...vercel.app").
    origin: (origin, cb) => {
      const allowed = (process.env.CLIENT_URL || 'http://localhost:5173')
        .split(',')
        .map((u) => u.trim().replace(/\/+$/, ''));
      const ok = !origin || allowed.includes(origin.replace(/\/+$/, ''));
      cb(null, ok);
    },
>>>>>>> 4d7b618 (resolve error occurs while deployment)
    credentials: true, // allow the httpOnly auth cookie
  })
);
app.use(express.json({ limit: '10mb' }));
app.use(cookieParser());

// serve locally uploaded files (images / pdfs) for free, no cloud needed
app.use('/uploads', express.static(path.join(__dirname, 'uploads')));

// ---------- routes ----------
app.get('/api/health', (_req, res) => res.json({ ok: true }));
app.use('/auth', authRoutes);
app.use('/api/notes', noteRoutes);
app.use('/api', uploadRoutes);


<<<<<<< HEAD


=======
>>>>>>> 4d7b618 (resolve error occurs while deployment)


app.use(notFound);
app.use(errorHandler);

// ---------- start ----------
const PORT = process.env.PORT;
connectDB().then(() => {
  const server = app.listen(PORT,"0.0.0.0" ,() => console.log(`API running on http://localhost:${PORT}`));
  attachRealtime(server); // WebSocket relay for live collaboration
});


