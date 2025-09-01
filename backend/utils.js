const fernet = require('fernet');
const crypto = require('crypto');
const nodemailer = require('nodemailer');
const Database = require('better-sqlite3');
const bcrypt = require('bcrypt');
require('dotenv').config()

const db = new Database("users.db");

const TEMP_SECURE_IDS = {};

db.prepare(`
  CREATE TABLE IF NOT EXISTS users (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    email TEXT UNIQUE NOT NULL,
    passwordHash TEXT NOT NULL
  )
`).run();

function createAccount(email, passwordHash) {
  const stmt = db.prepare("INSERT INTO users (email, passwordHash) VALUES (?, ?)");
  try {
    stmt.run(email, passwordHash);
    return true;
  } catch (err) {
    return "Error inserting user:" + err.message;
  }
}

function updatePassword(email, newHash) {
  const stmt = db.prepare("UPDATE users SET passwordHash = ? WHERE email = ?");
  stmt.run(newHash, email);
}

function deleteAccount(email) {
  const stmt = db.prepare("DELETE FROM users WHERE email = ?");
  stmt.run(email);
}

function getAccount(email) {
  const stmt = db.prepare("SELECT * FROM users WHERE email = ?");
  const user = stmt.get(email);
  if (user) return true;
  else return false;
}

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

async function hashPassword(password) {
  return await bcrypt.hash(password, 11);
}

async function checkLogin(email, password) {
  const stmt = db.prepare("SELECT * FROM users WHERE email = ?");
  const user = stmt.get(email);

  if (!user) return false;

  const match = await bcrypt.compare(password, user.passwordHash);
  if (match) return true;
    else {
      return false;
    }
}

async function getSecureId(email) {
  const token = crypto.randomBytes(32).toString('hex');
  TEMP_SECURE_IDS[token] = { email : email, expires: Date.now() + 3600000 };
  return token;
}

function checkSecureId(secureId, email) {
    const data = TEMP_SECURE_IDS[secureId];
    if (!data || data.expires < Date.now()) return false;
    if (data.email == email) return true;
    return false;
}

function hashEmail(email) {
  const hash = crypto.createHash('sha256');
  hash.update(email);
  return hash.digest('hex');
}

async function sendVerification(verificationURL, recipient) {

  const transporter = nodemailer.createTransport({
    service: 'gmail',
    auth: {
      user: process.env.EMAIL,
      pass: process.env.PASSWORD,
    },
  });

  const mailOptions = {
    from: '"no-reply@3272010.xyz" <no-reply@3272010.xyz>',
    to: recipient,
    subject: 'Sysset Authenticator Verification',
    text: 'Please click the link below to verify your email. If this was not you then you can safely ignore this message.\n\n'+verificationURL,
  };

  const sent = (await transporter.sendMail(mailOptions)).response;

  return(sent.search(/250 2.0.0 OK/));

}

module.exports = { decryptFernet, hashEmail, hashPassword, checkLogin, sendVerification, createAccount, updatePassword, deleteAccount, getAccount, checkSecureId, getSecureId };

setInterval(() => {
  const now = Date.now();
  for (const token in TEMP_SECURE_IDS) {
    if (TEMP_SECURE_IDS[token].expires < now) {
      delete TEMP_SECURE_IDS[token];
    }
  }
}, 60000);
