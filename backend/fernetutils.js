const fernet = require('fernet');

function decryptFernet(tokenStr, key) {
  try {
    const token = new fernet.Token({
      secret : new fernet.Secret(key),
      token: tokenStr,
      ttl: 0
    });
    return token.decode();
  } catch (err) {
    console.error('Decryption failed:', err.message);
    return null;
  }
}

module.exports = { decryptFernet };
