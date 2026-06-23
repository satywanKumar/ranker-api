/**
 * Fallback handler for unregistered routes (404)
 */
export const notFound = (req, res, next) => {
  const error = new Error(`Not Found - ${req.originalUrl}`);
  res.status(404);
  next(error);
};

/**
 * Express error handler middleware
 */
export const errorHandler = (err, req, res, next) => {
  const statusCode = res.statusCode === 200 ? 500 : res.statusCode;
  res.status(statusCode);
  
  // Custom checks
  let message = err.message;
  if (err.name === 'CastError') {
    res.status(400);
    message = 'Resource not found / Invalid ID format';
  } else if (err.code === 11000) {
    res.status(400);
    message = 'Duplicate field value entered';
  } else if (err.name === 'ValidationError') {
    res.status(400);
    message = Object.values(err.errors).map((val) => val.message).join(', ');
  }

  res.json({
    message,
    stack: process.env.NODE_ENV === 'production' ? null : err.stack,
  });
};
