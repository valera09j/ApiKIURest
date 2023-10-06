const express = require('express');
const router = express.Router();

const { post } = require('../controllers/CreateReservationOneWayController');

router.post('/', post);

module.exports = router;