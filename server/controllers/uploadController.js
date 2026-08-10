import path from 'path';
import fs from 'fs/promises';
import { mkdirSync } from 'fs';
import { fileURLToPath } from 'url';
import multer from 'multer';
import crypto from 'crypto';
import Note from '../models/Note.js';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const uploadDir = path.join(__dirname, '..', 'uploads');

// ensure the upload directory exists on fresh deploys (it's gitignored)
mkdirSync(uploadDir, { recursive: true });

// Multer stores files locally (free) — served statically at /uploads.
// Use Cloudinary/S3 instead if you outgrow a single-node setup.
const storage = multer.diskStorage({
  destination: (_req, _file, cb) => cb(null, uploadDir),
  filename: (_req, file, cb) => {
    const ext = path.extname(file.originalname).toLowerCase();
    cb(null, `${Date.now()}-${crypto.randomUUID()}${ext}`);
  },
});

const upload = multer({
  storage,
  limits: { fileSize: 20 * 1024 * 1024 }, // 20MB
  fileFilter: (_req, file, cb) => {
    // accept any image type plus PDFs
    const ok = /^image\//.test(file.mimetype) || file.mimetype === 'application/pdf';
    cb(ok ? null : new Error('Only images and PDFs are allowed'), ok);
  },
});

/** Absolute public url for a stored file, e.g. https://host/uploads/123.png.
 *  Absolute (not relative) so images keep working when the SPA is hosted
 *  on a different origin than the API (Vercel <-> Render). */
const publicUrl = (req, filename) => `${req.protocol}://${req.get('host')}/uploads/${filename}`;

/** Upload an image, returns a usable URL to embed in a note. */
export const uploadImage = [
  // field name must match what the client sends ('image')
  upload.single('image'),
  (req, res, next) => {
    try {
      if (!req.file) throw Object.assign(new Error('No image file uploaded'), { statusCode: 400 });
      res.status(201).json({ url: publicUrl(req, req.file.filename) });
    } catch (err) {
      next(err);
    }
  },
];

/**
 * Rasterize an uploaded PDF: one image element per page, placed down the
 * canvas. Uses pdf.js + a Node canvas implementation.
 */
import { getDocument } from 'pdfjs-dist/legacy/build/pdf.mjs';
import { createCanvas } from '@napi-rs/canvas';

export const importPdf = [
  upload.single('pdf'),
  async (req, res, next) => {
    let pdfPath = null;
    try {
      if (!req.file) throw Object.assign(new Error('No PDF uploaded'), { statusCode: 400 });
      pdfPath = req.file.path;

      const pdf = await getDocument(pdfPath).promise;
      const elements = [];
      let y = 0;

      for (let i = 1; i <= pdf.numPages; i++) {
        const page = await pdf.getPage(i);
        const viewport = page.getViewport({ scale: 1.0 });
        const canvas = createCanvas(viewport.width, viewport.height);
        await page.render({ canvasContext: canvas.getContext('2d'), viewport }).promise;

        // JPEG keeps the page images far smaller than PNG (faster import + faster open)
        const imageName = `${crypto.randomUUID()}-p${i}.jpg`;
        await fs.writeFile(path.join(uploadDir, imageName), canvas.toBuffer('image/jpeg', { quality: 0.75 }));

        elements.push({
          id: crypto.randomUUID(),
          type: 'image',
          x: 0,
          y,
          width: viewport.width,
          height: viewport.height,
          style: { backgroundColor: '#ffffff' },
          content: publicUrl(req, imageName),
        });
        y += viewport.height + 20;
      }

      // create the note right here so the route responds exactly once
      const title = req.body.title || req.file.originalname.replace(/\.pdf$/i, '') || 'Imported PDF';
      const note = await Note.create({ userId: req.user.id, title, elements });
      res.status(201).json({ note, title, elements });
    } catch (err) {
      next(err);
    } finally {
      // the per-page images are kept; the original PDF is deleted
      if (pdfPath) fs.unlink(pdfPath).catch(() => {});
    }
  },
];