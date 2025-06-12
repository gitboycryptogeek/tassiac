const { isViewOnlyAdmin } = require('./auth');

const checkAdminWritePermission = (action) => {
  return (req, res, next) => {
    if (!req.user || !req.user.isAdmin) {
      return res.status(403).json({
        success: false,
        message: 'Admin access required',
        error: { code: 'ADMIN_ACCESS_REQUIRED' }
      });
    }

    if (isViewOnlyAdmin(req.user)) {
      return res.status(403).json({
        success: false,
        message: `Forbidden: View-only admins cannot ${action}`,
        error: { code: 'VIEW_ONLY_ADMIN_RESTRICTION' }
      });
    }

    next();
  };
};

module.exports = { checkAdminWritePermission };