export const requireAdmin = (req, res, next) => {
  const adminToken = req.headers['x-admin-token'];
  
  if (!adminToken || adminToken !== process.env.ADMIN_SECRET_TOKEN) {
    return res.status(401).json({
      success: false,
      message: 'Acceso no autorizado: Token de administración no válido o ausente.'
    });
  }

  next();
};