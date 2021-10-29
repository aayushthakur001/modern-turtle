const express = require('express');
const router = express.Router();

const { isLoggedIn, isAdmin } = require('./guards/user');
const userRoutes = require('./routes/user.routes');

router.get('/my', isLoggedIn, userRoutes.user);
router.get('/my/admin', isLoggedIn, isAdmin, userRoutes.user);
router.get('/is-authenticated', userRoutes.isAuthenticated);
router.delete('/my', isLoggedIn, userRoutes.deleteUser);
router.put('/my/prefs', isLoggedIn, userRoutes.updateUserPreferences);
router.post('/my/survey', isLoggedIn, userRoutes.addSurvey);
router.post('/favorite/:projectId', isLoggedIn, userRoutes.addProjectToFavorites);
router.delete('/favorite/:projectId', isLoggedIn, userRoutes.removeProjectFromFavorites);
module.exports = router;
