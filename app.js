/**
 * Config .env
 */
require('dotenv').config();

/**
 * Require components and librarys
 */
const express = require('express');
const cors = require('cors');

/**
 * Initial Express
 */
const app = express();

/**
 * Cors
 */
app.use(cors());
app.use(express.json())

/**
 * Port
 */
const port  = process.env.PORT || 3000;

/**
 * Routes
 */
app.use('/api',require("./router"));
/**
 * Server Listen in port
 */
app.listen(port, () => {
    console.log(`tu app esta lista por el puesto http://localhost:${port}`)
});