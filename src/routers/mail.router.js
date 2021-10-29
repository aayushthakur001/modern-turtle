const express = require('express');
const router = express.Router();
const { isLoggedIn } = require('./guards/user');
const mailRoutes = require('./routes/mail.routes');

router.post('/import-enquiry', isLoggedIn, mailRoutes.sendImportEnquiry);

module.exports = router;
