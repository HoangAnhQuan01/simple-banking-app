const express = require('express');
const router = express.Router();
const { getMyAccount, transfer, getTransactions } = require('../controllers/accountController');
const authMiddleware = require('../middleware/authMiddleware');

router.get('/me', authMiddleware, getMyAccount);
router.post('/transfer', authMiddleware, transfer);
router.get('/transactions', authMiddleware, getTransactions);

module.exports = router;