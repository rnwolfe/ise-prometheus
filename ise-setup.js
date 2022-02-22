require('dotenv').config({
  path: require('path').resolve(__dirname) + '/.env'
});

const ISE = require('node-ise');

const ise = new ISE(
  process.env.ISE_HOST,
  process.env.ISE_USER,
  process.env.ISE_PASS
);
module.exports = ise;
