const express = require("express");
const app = express();
const path = require("path");
const fs = require("fs");
const fernet = require("./fernetutils");
const crypto = require("crypto");

app.use(express.json());

const TEMP_KEYS = {};
const USERS = {
    'tr': { password: '5e18117912e1393d5be317a7ccd19f17e7f02f742be4667c00eac8f67549f879' },
    'ok': { password: '5e18117912e1393d5be317a7ccd19f17e7f02f742be4667c00eac8f67549f879' }
};

app.get('/', (req, res) => {
    res.send('Authenticator API is running!');
});

app.get('/login', (req, res) => {
    const filePath = path.join(__dirname, 'public', 'login.html');

    fs.readFile(filePath, 'utf8', (err, html) => {
        res.send(html);
    });
});

app.get('/register', (req, res) => {
    const filePath = path.join(__dirname, 'public', 'register.html');

    fs.readFile(filePath, 'utf8', (err, html) => {
        res.send(html);
    });
});

app.post('/auth/getKey', (req, res) => {
    const { email } = req.body;

    if (!email || !USERS[email]) return res.status(400).json({ error: 'Email not found in database.' });

    let key = crypto.randomBytes(32).toString('base64');
    TEMP_KEYS[email] = key;
    key = Buffer.from(key+'-'+Buffer.from(email).toString('base64')).toString('base64')

    res.json({ key:  key });
});

app.post('/auth/authenticate', (req, res) => {
    let { email, password } = req.body;

    try {
        password = fernet.decryptFernet(password, TEMP_KEYS[email]);
        console.log('Decrypted password:', password);
    } catch (err) {
        console.error('Decryption failed:', err);
        return res.status(400).json({ error: 'Invalid encrypted password' });
    }

    if (password == USERS[email].password) {
        console.log('Authentication success');
        return res.json({ message: 'Authentication successful' });
    } else {
        console.log('Authentication failed');
        return res.status(401).json({ error: 'Invalid credentials' });
    }
});

// Useless as of now
app.post('/auth/register', (req, res) => {
    const { email, password } = req.body;

    if (!email || !password) return res.status(400).json({ error: 'Email and password required' });

    USERS[email] = {password : password}

    res.status(201).json({ message: 'User registered', email });
});

app.listen(3000, () => {
    console.log(`Server running on port ${3000}`);
});
