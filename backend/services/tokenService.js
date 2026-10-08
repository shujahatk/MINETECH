const jwt = require('jsonwebtoken');

function getJwtSecret() {
  const secret = process.env.JWT_SECRET;
  if (!secret) {
    throw new Error('FATAL: JWT_SECRET environment variable is not defined.');
  }
  return secret;
}

const generateToken = (userId) => {
  const secret = getJwtSecret();
  return jwt.sign({ id: userId }, secret, {
    expiresIn: '7d',
  });
};

const verifyToken = (token) => {
  const secret = getJwtSecret();
  return jwt.verify(token, secret);
};

module.exports = { generateToken, verifyToken };
