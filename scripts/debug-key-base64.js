const fs = require('fs');
const dotenv = require('dotenv');
const env = dotenv.parse(fs.readFileSync('.env'));
const key = env.GOOGLE_PRIVATE_KEY;
console.log('--- DEBUG KEY BASE64 ---');
console.log(Buffer.from(key).toString('base64'));
