const express = require('express');
const router = express.Router();

const { post } = require('../controllers/searchController');

router.post('/', post);

module.exports = router;