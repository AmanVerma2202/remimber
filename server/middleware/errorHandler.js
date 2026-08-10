/** 404 for unknown routes. */
export function notFound(req, _res, next) {
  next(Object.assign(new Error(`Not found - ${req.originalUrl}`), { statusCode: 404 }));
}

/** Central error handler: keeps controllers free of try/catch noise. */
export function errorHandler(err, _req, res, _next) {
  const status = err.statusCode || (err.name === 'ValidationError' ? 400 : 500);
  const message = err.message || 'Server error';
  if (status >= 500) console.error(err);
  res.status(status).json({ message });
}