const express = require('express');
const router = express.Router();
const { addDevice } = require('../controllers/deviceController');
const authMiddleware = require('../middleware/authMiddleware');

router.post('/add', authMiddleware, addDevice);
// अन्य डिवाइस रूट्स यहाँ आएंगे

module.exports = router;
