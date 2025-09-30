const express = require("express");
const app = express();
const path = require("path");
const fs = require("fs");
const utils = require("./utils");
const crypto = require("crypto");

app.use(express.json());

const TEMP_KEYS = {};
const STATUS = {};
const SESSION_COOKIES = {};
const SESSION_DURATION = 24 * 60 * 60 * 1000;

function createSession(email) {
    const token = crypto.randomBytes(32).toString('hex');
    const expires = Date.now() + SESSION_DURATION;

    SESSION_COOKIES[email] = { token, expires };
    return token;
}

function validateSession(req) {
    const cookies = req.headers.cookie?.split('; ').find(c => c.startsWith('session='));
    const sessionToken = cookies ? cookies.split('=')[1] : null;
    const email = req.headers.cookie?.split('; ').find(c => c.startsWith('email=')).split('=')[1];

    if (!sessionToken) return false;

    const sessionData = SESSION_COOKIES[email];
    if (!sessionData || sessionData.expires < Date.now()) {
        if (sessionData) delete SESSION_COOKIES[email];
        return false;
    }

    if (sessionData == sessionToken) {
        return true;
    }

    return false;
}

function getTempKey(email) {
  const data = TEMP_KEYS[email];
  if (!data) return null;
  if (data.expires < Date.now()) {
    delete TEMP_KEYS[email];
    return null;
  }
  return data.key;
}

function getStatus(email) {
  const data = STATUS[email];
  if (!data) return null;
  if (data.expires < Date.now()) {
    delete STATUS[email];
    return null;
  }
  return data.status;
}

app.get('/', (req, res) => {
    const filePath = path.join(__dirname, 'public', 'index.html');

    fs.readFile(filePath, 'utf8', (err, html) => {
        res.send(html);
    });
});

app.get('/blackjack', (req, res) => {
    if (!validateSession(req)) return res.status(303).redirect("/login");

    const filePath = path.join(__dirname, 'public', 'blackjack.html');

    fs.readFile(filePath, 'utf8', (err, html) => {
        res.send(html);
    });
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

app.get('/resetPassword', (req, res) => {
    const email = req.query.mail;
    const filePath = path.join(__dirname, 'public', 'reset.html');

    fs.readFile(filePath, 'utf8', (err, html) => {
        html = html.replace("emailvaluehere", ((email == undefined) ? "" : email));
        return res.send(html);
    });
});

app.get('/auth/reset', (req, res) => {
    const email = req.query.mail;
    const secureId = req.query.secureId;
    const filePath = path.join(__dirname, 'public', 'authreset.html');

    if (!secureId || !email) return res.status(303).redirect("/resetPassword");

    if (utils.checkSecureId(secureId, email)) {
        fs.readFile(filePath, 'utf8', (err, html) => {
            html = html.replace("emailvaluehere", ((email == undefined) ? "" : email)).replace("secureidhere", secureId);
            return res.send(html);
        });
    } else return res.status(400).send({ error : "Invalid secure identification." });
});

app.post('/auth/getKey', async (req, res) => {
    const { email, status, secureId } = req.body;

    if (!email) return res.status(400).json({ error : 'Please enter an email!' });
    if (!status || (status != 'l' && status != 'r' && status != 'p1' && status != 'p2')) return res.status(400).json({ error : 'A valid status code was not provided.' });

    STATUS[email] = { status, expires: Date.now() + 3600000 };

    if (status == 'l') {
        if (!utils.getAccount(email)) return res.status(400).json({ error : "This e-mail is not registered!" });
        let key = crypto.randomBytes(32).toString('base64');
        TEMP_KEYS[email] = { key, expires: Date.now() + 3600000};
        key = Buffer.from(key+'-'+Buffer.from(email).toString('base64')).toString('base64');
        res.status(200).json({ key:  key });
    } else if (status == 'p1') {
        if (!utils.getAccount(email)) return res.status(400).json({ error : "This e-mail is not registered!" });
        const key = await utils.getSecureId(email);
        TEMP_KEYS[email] = { key, expires: Date.now() + 3600000};
        await utils.sendVerification("http://localhost:3000/auth/reset?secureId="+key+"&mail="+email, email);
        res.status(200).send({ message : "Please check your email inbox/spam folder to reset password." });
    } else if (status == 'p2') {
        if (!utils.getAccount(email)) return res.status(400).json({ error : "This e-mail is not registered!" });
        if (!secureId || !(utils.checkSecureId(secureId, email))) return res.status(400).json({ error : 'Invalid secure identification.' });
        let key = crypto.randomBytes(32).toString('base64');
        TEMP_KEYS[email] = { key, expires: Date.now() + 3600000 };
        key = Buffer.from(key+'-'+Buffer.from(email).toString('base64')).toString('base64');
        res.status(200).json({ key:  key });
    } else {
        const key = crypto.randomBytes(32).toString('base64').replace(/[^a-zA-Z0-9]/g, '');
        TEMP_KEYS[key] = { email, expires: Date.now() + 3600000 };
        await utils.sendVerification("http://localhost:3000/auth/verify?verificationCode="+key, email);
        res.status(200).send({ message : "Please check your email inbox/spam folder to verify." });
    }
});

app.post('/auth/getCookie', async (req, res) => {
    const { email, key } = req.body;

    if (!email || !key) return res.status(400).json({ error: 'Email and key required' });

    if (Buffer.from(getTempKey(email)+'-'+Buffer.from(email).toString('base64')).toString('base64') == key) {
        let counter = 0;
        while (!SESSION_COOKIES[email] && counter < 300) {
            await new Promise(resolve => setTimeout(resolve, 100));
            counter++;
        }
        
        if (SESSION_COOKIES[email]) {
            return res.status(200).json({ sessionToken: SESSION_COOKIES[email].token });
        } else {
            return res.status(408).json({ error: 'Timeout waiting for authentication' });
        }
    } else {
        res.status(400).json({ error: 'Invalid key' });
    }
    
});

app.post('/auth/authenticate', async (req, res) => {
    let { email, password } = req.body;

    try {
        const key = getTempKey(email);
        if (!key) return res.status(400).json({ error: 'Temporary key expired or invalid.' });
        password = utils.decryptFernet(password, key);
    } catch (err) {
        return res.status(400).json({ error : 'Invalid encrypted password' });
    }

    const match = await utils.checkLogin(email, password);

    try{
        password = await utils.hashPassword(password);
    } catch (err) {
        return res.status(500).json({ error : 'Error hashing on server side.' });
    }

    const status = getStatus(email);
    if (!status) return res.status(400).json({ error: 'Status expired or invalid.' });

    if (status == 'l') {
        if (match) {
            createSession(email);
            return res.json({ message : 'Login successful!' });
        } else {
            delete TEMP_KEYS[email];
            return res.status(401).json({ error : 'Invalid credentials.' });
        }
    } else if (status == 'p2') {
        utils.updatePassword(email, password);
        delete TEMP_KEYS[email];
        return res.status(200).json({ message : "Password successfully changed!" });
    }
});

app.get('/auth/verify', (req, res) => {
    const verificationCode = req.query.verificationCode;
    const filePath = path.join(__dirname, 'public', 'verify.html');

    if (req.query.deleteAccount) {
        utils.deleteAccount(verificationCode);
        return res.status(304).redirect("/");
    }

    const data = TEMP_KEYS[verificationCode];
    if (!data || data.expires < Date.now()) return res.status(303).send("Invalid, expired, or missing verification code.");

    utils.createAccount(data.email, crypto.randomBytes(32).toString('base64').replace(/[^a-zA-Z0-9]/g, ''));

    fs.readFile(filePath, 'utf8', (err, html) => {
        html = html.replace("email", data.email);
        res.send(html);

        delete TEMP_KEYS[verificationCode];
    });
});

app.listen(3000, () => {
    console.log(`Server running on port ${3000}`);
});

setInterval(() => {
  const now = Date.now();
  for (const email in TEMP_KEYS) {
    if (TEMP_KEYS[email].expires < now) {
      delete TEMP_KEYS[email];
    }
  }
  for (const token in SESSION_COOKIES) {
    if (SESSION_COOKIES[token].expires < now) {
      delete SESSION_COOKIES[token];
    }
  }
}, 60 * 1000);