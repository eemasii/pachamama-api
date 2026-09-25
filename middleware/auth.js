export const requireAdmin = (req, res, next) => {
  const token = req.headers['x-admin-token'];
  const expectedToken = (process.env.ADMIN_TOKEN || '').trim();

  if (!token || !expectedToken || token.trim() !== expectedToken) {
    return res.status(401).json({
      success: false,
      message: 'Acceso no autorizado: Token inválido o desactualizado.',
    });
  }

  next();
};
