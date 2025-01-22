export function notFoundHandler(req, res) {
  console.log('404 Not Found:', req.method, req.url);
  res.status(404).render('404');
}

export function errorHandler(err, req, res, next) {
  console.error('Error:', err);
  
  // Log detailed error in development
  if (process.env.NODE_ENV !== 'production') {
    console.error(err.stack);
  }

  res.status(500).render('error', { 
    error: process.env.NODE_ENV === 'production' 
      ? 'Something went wrong!' 
      : err.message
  });
}
