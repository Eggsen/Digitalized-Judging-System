/**
 * Global API Error Handling Middleware
 */
function errorHandler(err, req, res, next) {
    console.error(`[API Error] ${req.method} ${req.originalUrl}:`, err);

    const statusCode = err.statusCode || (res.statusCode !== 200 ? res.statusCode : 500);

    res.status(statusCode).json({
        success: false,
        message: err.message || 'Internal Server Error',
        ...(process.env.NODE_ENV === 'development' ? { stack: err.stack } : {})
    });
}

/**
 * 404 Route Not Found Middleware for API endpoints
 */
function notFoundHandler(req, res, next) {
    if (req.originalUrl.startsWith('/api/')) {
        return res.status(404).json({
            success: false,
            message: `API endpoint not found: ${req.method} ${req.originalUrl}`
        });
    }
    next();
}

module.exports = {
    errorHandler,
    notFoundHandler
};

