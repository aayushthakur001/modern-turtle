const express = require('express');
const router = express.Router();

const { isLoggedIn } = require('./guards/user');
const netlifyRoutes = require('./routes/netlify.routes');

router.get('/sites', isLoggedIn, netlifyRoutes.getNetlifySites);

module.exports = router;
