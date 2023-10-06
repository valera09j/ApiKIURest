const express = require('express');
const router = express.Router();

const { post } = require('../controllers/RoundTripController');

router.post('/', post);

module.exports = router;