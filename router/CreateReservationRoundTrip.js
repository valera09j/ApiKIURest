const express = require('express');
const router = express.Router();

const { post } = require('../controllers/CreateReservationRoundTripController');

router.post('/', post);

module.exports = router;