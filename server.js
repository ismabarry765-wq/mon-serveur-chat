const express = require('express');
const cors = require('cors');
const fs = require('fs');
const path = require('path');
const crypto = require('crypto');

const app = express();
app.use(cors());
app.use(express.json({ limit: '10mb' }));

// ==========================================
// 📁 BASE DE DONNÉES
// ==========================================
const DB_FILE = path.join(__dirname, 'database.json');

// Structure de la base de données
let db = {
    users: {},
    conversations: {},
    stats: {
        totalMessages: 0,
        totalConversations: 0,
        totalUsers: 0,
        startTime: Date.now()
    },
    logs: []
};

// ==========================================
// 💾 SAUVEGARDE ET CHARGEMENT
// ==========================================
function sauvegarderDB() {
    try {
        fs.writeFileSync(DB_FILE, JSON.stringify(db, null, 2));
    } catch (e) {
        console.error('❌ Erreur sauvegarde:', e);
    }
}

function chargerDB() {
    try {
        if (fs.existsSync(DB_FILE)) {
            const data = fs.readFileSync(DB_FILE, 'utf8');
            db = JSON.parse(data);
            console.log('✅ Base de données chargée');
        }
    } catch (e) {
        console.error('❌ Erreur chargement:', e);
    }
}

// Sauvegarde automatique toutes les 5 secondes
setInterval(sauvegarderDB, 5000);

// ==========================================
// 🛠️ FONCTIONS UTILES
// ==========================================
function genererId(prefix) {
    return prefix + '_' + Date.now() + '_' + crypto.randomBytes(4).toString('hex');
}

function getTimestamp() {
    const now = new Date();
    return now.toLocaleString('fr-FR', {
        day: '2-digit',
        month: '2-digit',
        year: 'numeric',
        hour: '2-digit',
        minute: '2-digit',
        second: '2-digit'
    });
}

function getISO() {
    return new Date().toISOString();
}

function formaterTemps(timestamp) {
    const diff = Date.now() - new Date(timestamp).getTime();
    const secondes = Math.floor(diff / 1000);
    const minutes = Math.floor(secondes / 60);
    const heures = Math.floor(minutes / 60);
    const jours = Math.floor(heures / 24);

    if (secondes < 10) return 'À l\'instant';
    if (secondes < 60) return `Il y a ${secondes} secondes`;
    if (minutes < 60) return `Il y a ${minutes} minute${minutes > 1 ? 's' : ''}`;
    if (heures < 24) return `Il y a ${heures} heure${heures > 1 ? 's' : ''}`;
    return `Il y a ${jours} jour${jours > 1 ? 's' : ''}`;
}

// ==========================================
// 📝 LOGS
// ==========================================
function ajouterLog(type, message, details = {}) {
    const log = {
        id: genererId('log'),
        type,
        message,
        details,
        timestamp: getISO(),
        date: getTimestamp()
    };
    db.logs.unshift(log);
    if (db.logs.length > 1000) db.logs = db.logs.slice(0, 1000);
    console.log(`[${type}] ${message}`);
}

// ==========================================
// 🔐 SÉCURITÉ - Rate Limiting
// ==========================================
const rateLimit = new Map();

function checkRateLimit(ip) {
    const now = Date.now();
    const windowMs = 60000; // 1 minute
    const maxRequests = 100;

    if (!rateLimit.has(ip)) {
        rateLimit.set(ip, { count: 1, firstRequest: now });
        return true;
    }

    const data = rateLimit.get(ip);
    if (now - data.firstRequest > windowMs) {
        data.count = 1;
        data.firstRequest = now;
        return true;
    }

    if (data.count >= maxRequests) {
        return false;
    }

    data.count++;
    return true;
}

// ==========================================
// 🏥 ROUTE HEALTH
// ==========================================
app.get('/health', (req, res) => {
    const uptime = Math.floor((Date.now() - db.stats.startTime) / 1000);
    res.json({
        status: 'online',
        uptime: uptime,
        version: '4.0',
        users: Object.keys(db.users).length,
        conversations: Object.keys(db.conversations).length,
        messages: db.stats.totalMessages,
        timestamp: getTimestamp()
    });
});

// ==========================================
// 📊 ROUTE STATS
// ==========================================
app.get('/stats', (req, res) => {
    const online = Object.values(db.users).filter(u => u.online).length;
    res.json({
        messages: db.stats.totalMessages,
        conversations: db.stats.totalConversations,
        users: db.stats.totalUsers,
        online: online,
        offline: db.stats.totalUsers - online,
        uptime: Math.floor((Date.now() - db.stats.startTime) / 1000),
        memory: process.memoryUsage(),
        timestamp: getTimestamp()
    });
});

// ==========================================
// 👤 AUTHENTIFICATION
// ==========================================
app.post('/api/register', (req, res) => {
    const ip = req.ip || req.connection.remoteAddress;
    if (!checkRateLimit(ip)) {
        return res.status(429).json({ success: false, error: 'Trop de requêtes' });
    }

    const { username, password } = req.body;
    if (!username || !password) {
        return res.status(400).json({ success: false, error: 'Champs manquants' });
    }
    if (username.length < 2 || username.length > 20) {
        return res.status(400).json({ success: false, error: 'Pseudo invalide (2-20 caractères)' });
    }
    if (password.length < 4) {
        return res.status(400).json({ success: false, error: 'Mot de passe trop court' });
    }
    if (db.users[username]) {
        return res.status(400).json({ success: false, error: 'Ce pseudo est déjà pris' });
    }

    db.users[username] = {
        username,
        password,
        createdAt: getISO(),
        lastSeen: getISO(),
        online: false
    };
    db.stats.totalUsers = Object.keys(db.users).length;

    ajouterLog('AUTH', `Nouvel utilisateur: ${username}`);
    sauvegarderDB();

    res.json({ success: true, message: 'Compte créé avec succès !' });
});

app.post('/api/login', (req, res) => {
    const ip = req.ip || req.connection.remoteAddress;
    if (!checkRateLimit(ip)) {
        return res.status(429).json({ success: false, error: 'Trop de requêtes' });
    }

    const { username, password } = req.body;
    if (!username || !password) {
        return res.status(400).json({ success: false, error: 'Champs manquants' });
    }
    if (!db.users[username] || db.users[username].password !== password) {
        return res.status(401).json({ success: false, error: 'Identifiants incorrects' });
    }

    db.users[username].lastSeen = getISO();
    db.users[username].online = true;

    ajouterLog('AUTH', `Connexion: ${username}`);
    sauvegarderDB();

    res.json({ success: true, message: `Bienvenue ${username} !` });
});

app.post('/api/delete-account', (req, res) => {
    const { username, password } = req.body;
    if (!username || !password) {
        return res.status(400).json({ success: false, error: 'Champs manquants' });
    }
    if (!db.users[username] || db.users[username].password !== password) {
        return res.status(401).json({ success: false, error: 'Mot de passe incorrect' });
    }

    delete db.users[username];
    Object.keys(db.conversations).forEach(key => {
        if (db.conversations[key].username === username) {
            delete db.conversations[key];
        }
    });

    db.stats.totalUsers = Object.keys(db.users).length;

    ajouterLog('AUTH', `Suppression compte: ${username}`);
    sauvegarderDB();

    res.json({ success: true, message: 'Compte supprimé' });
});

// ==========================================
// 💬 CONVERSATIONS
// ==========================================
app.get('/recuperer-questions', (req, res) => {
    const questions = Object.keys(db.conversations).map(chatId => {
        const conv = db.conversations[chatId];
        return {
            chatId,
            username: conv.username,
            messages: conv.messages || [],
            messageCount: (conv.messages || []).length,
            lastMessage: conv.messages && conv.messages.length > 0 ? conv.messages[conv.messages.length - 1] : null,
            createdAt: conv.createdAt,
            updatedAt: conv.updatedAt
        };
    });
    res.json({ questions });
});

app.get('/get-history', (req, res) => {
    const { chatId, username } = req.query;
    if (!chatId || !username) {
        return res.status(400).json({ success: false, error: 'Paramètres manquants' });
    }

    const chat = db.conversations[chatId];
    if (!chat || chat.username !== username) {
        return res.json({ messages: [] });
    }

    res.json({ messages: chat.messages || [] });
});

app.get('/conversations', (req, res) => {
    const { username } = req.query;
    let result = Object.keys(db.conversations).map(chatId => {
        const conv = db.conversations[chatId];
        return {
            chatId,
            username: conv.username,
            messageCount: (conv.messages || []).length,
            lastMessage: conv.messages && conv.messages.length > 0 ? conv.messages[conv.messages.length - 1] : null,
            createdAt: conv.createdAt,
            updatedAt: conv.updatedAt
        };
    });

    if (username) {
        result = result.filter(c => c.username === username);
    }

    res.json({ conversations: result });
});

app.post('/message', (req, res) => {
    const ip = req.ip || req.connection.remoteAddress;
    if (!checkRateLimit(ip)) {
        return res.status(429).json({ success: false, error: 'Trop de requêtes' });
    }

    const { chatId, username, text } = req.body;
    if (!chatId || !username || !text) {
        return res.status(400).json({ success: false, error: 'Données manquantes' });
    }
    if (text.length > 5000) {
        return res.status(400).json({ success: false, error: 'Message trop long (5000 max)' });
    }
    if (!db.users[username]) {
        return res.status(401).json({ success: false, error: 'Utilisateur inconnu' });
    }

    if (!db.conversations[chatId]) {
        db.conversations[chatId] = {
            username,
            messages: [],
            createdAt: getISO(),
            updatedAt: getISO()
        };
        db.stats.totalConversations = Object.keys(db.conversations).length;
    }

    const msgId = genererId('msg');
    const timestamp = getTimestamp();

    const message = {
        id: msgId,
        sender: username,
        text: text,
        timestamp: timestamp,
        iso: getISO(),
        read: false,
        deleted: false,
        edited: false,
        isAdmin: false,
        isIA: false
    };

    db.conversations[chatId].messages.push(message);
    db.conversations[chatId].updatedAt = getISO();
    db.stats.totalMessages++;

    ajouterLog('MESSAGE', `${username}: ${text.substring(0, 50)}...`, { chatId, messageId: msgId });
    sauvegarderDB();

    // Réponse IA
    const iaMsg = {
        id: genererId('msg'),
        sender: 'Groq IA',
        text: 'Nexus IA réfléchit...',
        timestamp: getTimestamp(),
        iso: getISO(),
        read: false,
        deleted: false,
        edited: false,
        isAdmin: false,
        isIA: true
    };
    db.conversations[chatId].messages.push(iaMsg);
    db.stats.totalMessages++;
    sauvegarderDB();

    res.json({
        success: true,
        reply: 'Nexus IA réfléchit...',
        messageId: msgId
    });
});

app.post('/repondre-humain', (req, res) => {
    const ip = req.ip || req.connection.remoteAddress;
    if (!checkRateLimit(ip)) {
        return res.status(429).json({ success: false, error: 'Trop de requêtes' });
    }

    const { chatId, reponse, admin } = req.body;
    if (!chatId || !reponse) {
        return res.status(400).json({ success: false, error: 'Données manquantes' });
    }
    if (reponse.length > 5000) {
        return res.status(400).json({ success: false, error: 'Message trop long (5000 max)' });
    }
    if (!db.conversations[chatId]) {
        return res.status(404).json({ success: false, error: 'Conversation introuvable' });
    }

    // Supprimer le message "Nexus IA réfléchit..."
    db.conversations[chatId].messages = db.conversations[chatId].messages.filter(
        m => !(m.sender === 'Groq IA' && m.text === 'Nexus IA réfléchit...')
    );

    const msgId = genererId('msg');
    const message = {
        id: msgId,
        sender: admin || 'Nexus IA',
        text: reponse,
        timestamp: getTimestamp(),
        iso: getISO(),
        read: false,
        deleted: false,
        edited: false,
        isAdmin: true,
        isIA: false
    };

    db.conversations[chatId].messages.push(message);
    db.conversations[chatId].updatedAt = getISO();
    db.stats.totalMessages++;

    ajouterLog('ADMIN', `Admin répond à ${db.conversations[chatId].username}: ${reponse.substring(0, 50)}...`);
    sauvegarderDB();

    res.json({ success: true, messageId: msgId });
});

// ==========================================
// ✏️ MODIFIER UN MESSAGE
// ==========================================
app.put('/message/edit', (req, res) => {
    const { chatId, messageId, newText } = req.body;
    if (!chatId || !messageId || !newText) {
        return res.status(400).json({ success: false, error: 'Données manquantes' });
    }

    const chat = db.conversations[chatId];
    if (!chat) {
        return res.status(404).json({ success: false, error: 'Conversation introuvable' });
    }

    const msgIndex = chat.messages.findIndex(m => m.id === messageId);
    if (msgIndex === -1) {
        return res.status(404).json({ success: false, error: 'Message introuvable' });
    }

    chat.messages[msgIndex].text = newText;
    chat.messages[msgIndex].edited = true;
    chat.messages[msgIndex].editedAt = getTimestamp();
    chat.updatedAt = getISO();

    ajouterLog('EDIT', `Message ${messageId} modifié`);
    sauvegarderDB();

    res.json({ success: true, message: 'Message modifié' });
});

// ==========================================
// 🗑️ SUPPRIMER UN MESSAGE
// ==========================================
app.delete('/message/delete', (req, res) => {
    const { chatId, messageId } = req.body;
    if (!chatId || !messageId) {
        return res.status(400).json({ success: false, error: 'Données manquantes' });
    }

    const chat = db.conversations[chatId];
    if (!chat) {
        return res.status(404).json({ success: false, error: 'Conversation introuvable' });
    }

    const msgIndex = chat.messages.findIndex(m => m.id === messageId);
    if (msgIndex === -1) {
        return res.status(404).json({ success: false, error: 'Message introuvable' });
    }

    chat.messages.splice(msgIndex, 1);
    chat.updatedAt = getISO();

    ajouterLog('DELETE', `Message ${messageId} supprimé`);
    sauvegarderDB();

    res.json({ success: true, message: 'Message supprimé' });
});

// ==========================================
// 🗑️ SUPPRIMER UNE CONVERSATION
// ==========================================
app.delete('/conversation/delete', (req, res) => {
    const { chatId } = req.body;
    if (!chatId) {
        return res.status(400).json({ success: false, error: 'ChatId manquant' });
    }

    if (!db.conversations[chatId]) {
        return res.status(404).json({ success: false, error: 'Conversation introuvable' });
    }

    delete db.conversations[chatId];
    db.stats.totalConversations = Object.keys(db.conversations).length;

    ajouterLog('DELETE', `Conversation ${chatId} supprimée`);
    sauvegarderDB();

    res.json({ success: true, message: 'Conversation supprimée' });
});

// ==========================================
// 🧹 EFFACER TOUT
// ==========================================
app.delete('/admin/clear', (req, res) => {
    const { adminKey } = req.body;
    if (adminKey !== 'ADMIN_123') {
        return res.status(401).json({ success: false, error: 'Clé admin invalide' });
    }

    db.conversations = {};
    db.stats.totalMessages = 0;
    db.stats.totalConversations = 0;

    ajouterLog('ADMIN', 'Toutes les données effacées');
    sauvegarderDB();

    res.json({ success: true, message: 'Toutes les données effacées' });
});

// ==========================================
// 🔍 RECHERCHE
// ==========================================
app.get('/search', (req, res) => {
    const { q, type } = req.query;
    if (!q) {
        return res.status(400).json({ success: false, error: 'Requête de recherche manquante' });
    }

    const results = {
        users: [],
        messages: [],
        conversations: []
    };

    // Rechercher dans les utilisateurs
    if (!type || type === 'users') {
        Object.keys(db.users).forEach(username => {
            if (username.toLowerCase().includes(q.toLowerCase())) {
                results.users.push({ username, lastSeen: db.users[username].lastSeen });
            }
        });
    }

    // Rechercher dans les messages
    if (!type || type === 'messages') {
        Object.keys(db.conversations).forEach(chatId => {
            const chat = db.conversations[chatId];
            chat.messages.forEach(msg => {
                if (msg.text.toLowerCase().includes(q.toLowerCase())) {
                    results.messages.push({
                        chatId,
                        username: chat.username,
                        message: msg
                    });
                }
            });
        });
    }

    res.json({ success: true, results });
});

// ==========================================
// 📋 LOGS
// ==========================================
app.get('/logs', (req, res) => {
    const { limit = 50 } = req.query;
    res.json({
        logs: db.logs.slice(0, parseInt(limit))
    });
});

// ==========================================
// 🏠 PAGE PRINCIPALE
// ==========================================
app.get('/', (req, res) => {
    res.send('<!DOCTYPE html>\n' +
    '<html>\n' +
    '<head>\n' +
    '    <meta charset="UTF-8">\n' +
    '    <meta name="viewport" content="width=device-width, initial-scale=1.0">\n' +
    '    <title>Nexus Chat IA v4.0</title>\n' +
    '    <style>\n' +
    '        * { box-sizing: border-box; margin: 0; padding: 0; font-family: Arial, sans-serif; }\n' +
    '        body { display: flex; height: 100vh; background: #f5f5f5; }\n' +
    '        #sidebar { width: 260px; background: white; border-right: 1px solid #ddd; display: flex; flex-direction: column; }\n' +
    '        #sidebar h2 { padding: 15px; border-bottom: 1px solid #ddd; font-size: 16px; }\n' +
    '        #user-list { flex: 1; overflow-y: auto; padding: 10px; }\n' +
    '        .user-item { padding: 10px; cursor: pointer; border-radius: 8px; margin-bottom: 5px; }\n' +
    '        .user-item:hover { background: #f0f0f0; }\n' +
    '        .user-item.active { background: #e3e3e3; }\n' +
    '        #main { flex: 1; display: flex; flex-direction: column; background: white; }\n' +
    '        #header { padding: 15px 20px; border-bottom: 1px solid #ddd; display: flex; justify-content: space-between; }\n' +
    '        #header h3 { font-size: 16px; }\n' +
    '        #messages { flex: 1; overflow-y: auto; padding: 20px; }\n' +
    '        .msg-wrapper { margin-bottom: 12px; }\n' +
    '        .msg-sender { font-size: 11px; color: #888; margin-bottom: 3px; }\n' +
    '        .msg { padding: 10px 14px; border-radius: 10px; max-width: 80%; display: inline-block; }\n' +
    '        .msg.user { background: #e9ecef; }\n' +
    '        .msg.admin { background: #dbeafe; border-left: 3px solid #6366f1; }\n' +
    '        .msg.ia { background: #f3f4f6; font-style: italic; }\n' +
    '        .msg .time { font-size: 10px; color: #999; margin-left: 8px; }\n' +
    '        #input-area { padding: 15px 20px; border-top: 1px solid #ddd; display: flex; gap: 10px; }\n' +
    '        #input-area input { flex: 1; padding: 10px 15px; border: 1px solid #ddd; border-radius: 20px; outline: none; }\n' +
    '        #input-area button { padding: 10px 25px; background: #6366f1; color: white; border: none; border-radius: 20px; cursor: pointer; }\n' +
    '        #auth-modal { position: fixed; inset: 0; background: rgba(0,0,0,0.5); display: flex; align-items: center; justify-content: center; z-index: 1000; }\n' +
    '        .auth-box { background: white; padding: 30px; border-radius: 12px; width: 340px; text-align: center; }\n' +
    '        .auth-box input { width: 100%; padding: 10px; margin-bottom: 10px; border: 1px solid #ddd; border-radius: 8px; }\n' +
    '        .auth-box button { width: 100%; padding: 10px; background: #6366f1; color: white; border: none; border-radius: 8px; cursor: pointer; }\n' +
    '        .auth-toggle { margin-top: 12px; color: #6366f1; cursor: pointer; font-size: 14px; }\n' +
    '        .toast { position: fixed; bottom: 20px; right: 20px; background: #10b981; color: white; padding: 12px 20px; border-radius: 8px; display: none; z-index: 999; }\n' +
    '        .status { font-size: 12px; padding: 4px 12px; border-radius: 12px; }\n' +
    '        .status.online { color: #10b981; }\n' +
    '        .status.offline { color: #ef4444; }\n' +
    '    </style>\n' +
    '</head>\n' +
    '<body>\n' +
    '    <div id="auth-modal">\n' +
    '        <div class="auth-box">\n' +
    '            <h2>✨ Nexus IA v4.0</h2>\n' +
    '            <p style="color: #666; margin-bottom: 15px;">Par Ismaël</p>\n' +
    '            <input type="text" id="auth-user" placeholder="Pseudo">\n' +
    '            <input type="password" id="auth-pass" placeholder="Mot de passe">\n' +
    '            <button onclick="handleAuth()">Se connecter</button>\n' +
    '            <div class="auth-toggle" onclick="toggleAuth()">Pas encore de compte ? S\'inscrire</div>\n' +
    '        </div>\n' +
    '    </div>\n' +
    '    <div id="sidebar">\n' +
    '        <h2>💬 Conversations</h2>\n' +
    '        <div id="user-list"></div>\n' +
    '    </div>\n' +
    '    <div id="main">\n' +
    '        <div id="header">\n' +
    '            <h3>💬 Discussion</h3>\n' +
    '            <span id="status" class="status online">● En ligne</span>\n' +
    '        </div>\n' +
    '        <div id="messages"></div>\n' +
    '        <div id="input-area">\n' +
    '            <input id="msg-input" placeholder="Écrire un message..." onkeydown="if(event.key===\'Enter\') sendMsg()">\n' +
    '            <button onclick="sendMsg()">Envoyer</button>\n' +
    '        </div>\n' +
    '    </div>\n' +
    '    <div class="toast" id="toast"></div>\n' +
    '    <script>\n' +
    '        let currentUser = localStorage.getItem("nexus_user") || null;\n' +
    '        let chatId = localStorage.getItem("nexus_chatId") || "chat_" + Date.now();\n' +
    '        let isSignUp = false;\n' +
    '        let refreshInterval = null;\n' +
    '        if (!localStorage.getItem("nexus_chatId")) localStorage.setItem("nexus_chatId", chatId);\n' +
    '        function showToast(msg, error = false) {\n' +
    '            const t = document.getElementById("toast");\n' +
    '            t.textContent = msg;\n' +
    '            t.style.background = error ? "#ef4444" : "#10b981";\n' +
    '            t.style.display = "block";\n' +
    '            setTimeout(() => t.style.display = "none", 3000);\n' +
    '        }\n' +
    '        function toggleAuth() {\n' +
    '            isSignUp = !isSignUp;\n' +
    '            document.getElementById("auth-title").textContent = isSignUp ? "✨ Créer un compte" : "✨ Connexion";\n' +
    '            document.getElementById("auth-btn").textContent = isSignUp ? "S\'inscrire" : "Se connecter";\n' +
    '            document.getElementById("auth-toggle").textContent = isSignUp ? "Déjà un compte ? Se connecter" : "Pas encore de compte ? S\'inscrire";\n' +
    '        }\n' +
    '        async function handleAuth() {\n' +
    '            const username = document.getElementById("auth-user").value.trim();\n' +
    '            const password = document.getElementById("auth-pass").value.trim();\n' +
    '            if (!username || !password) return showToast("Remplis tous les champs !", true);\n' +
    '            const endpoint = isSignUp ? "/api/register" : "/api/login";\n' +
    '            try {\n' +
    '                const res = await fetch(endpoint, { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ username, password }) });\n' +
    '                const data = await res.json();\n' +
    '                if (res.ok) {\n' +
    '                    currentUser = username;\n' +
    '                    localStorage.setItem("nexus_user", currentUser);\n' +
    '                    document.getElementById("auth-modal").style.display = "none";\n' +
    '                    showToast("Bienvenue " + username + " !");\n' +
    '                    loadUsers();\n' +
    '                    loadMessages();\n' +
    '                    startRefresh();\n' +
    '                } else {\n' +
    '                    showToast(data.error || "Erreur", true);\n' +
    '                }\n' +
    '            } catch(e) { showToast("Erreur serveur", true); }\n' +
    '        }\n' +
    '        function logout() { localStorage.removeItem("nexus_user"); location.reload(); }\n' +
    '        function startRefresh() { if (refreshInterval) clearInterval(refreshInterval); refreshInterval = setInterval(() => { if (currentUser) { loadMessages(); loadUsers(); } }, 3000); }\n' +
    '        async function loadUsers() {\n' +
    '            try {\n' +
    '                const res = await fetch("/recuperer-questions");\n' +
    '                if (res.ok) {\n' +
    '                    const data = await res.json();\n' +
    '                    const list = document.getElementById("user-list");\n' +
    '                    list.innerHTML = "";\n' +
    '                    data.questions.forEach(q => {\n' +
    '                        const div = document.createElement("div");\n' +
    '                        div.className = "user-item" + (q.chatId === chatId ? " active" : "");\n' +
    '                        const count = q.messages ? q.messages.length : 0;\n' +
    '                        div.textContent = "👤 " + q.username + " (" + count + ")";\n' +
    '                        div.onclick = () => { chatId = q.chatId; localStorage.setItem("nexus_chatId", chatId); loadMessages(); loadUsers(); };\n' +
    '                        list.appendChild(div);\n' +
    '                    });\n' +
    '                    if (data.questions.length === 0) list.innerHTML = "<div style=\\"color:#999; padding:10px;\\">Aucune conversation</div>";\n' +
    '                }\n' +
    '            } catch(e) {}\n' +
    '        }\n' +
    '        async function loadMessages() {\n' +
    '            if (!currentUser) return;\n' +
    '            try {\n' +
    '                const res = await fetch("/get-history?chatId=" + chatId + "&username=" + currentUser);\n' +
    '                if (res.ok) {\n' +
    '                    const data = await res.json();\n' +
    '                    const container = document.getElementById("messages");\n' +
    '                    container.innerHTML = "";\n' +
    '                    (data.messages || []).forEach(m => {\n' +
    '                        const wrapper = document.createElement("div");\n' +
    '                        wrapper.className = "msg-wrapper";\n' +
    '                        const sender = document.createElement("div");\n' +
    '                        sender.className = "msg-sender";\n' +
    '                        sender.textContent = m.sender + " " + (m.timestamp || "");\n' +
    '                        const msg = document.createElement("div");\n' +
    '                        let cls = "msg";\n' +
    '                        if (m.sender === currentUser) cls += " user";\n' +
    '                        else if (m.isAdmin) cls += " admin";\n' +
    '                        else cls += " ia";\n' +
    '                        msg.className = cls;\n' +
    '                        msg.textContent = m.text;\n' +
    '                        if (m.edited) {\n' +
    '                            const edit = document.createElement("span");\n' +
    '                            edit.style.cssText = "font-size:10px; color:#999; margin-left:8px;";\n' +
    '                            edit.textContent = "(modifié)";\n' +
    '                            msg.appendChild(edit);\n' +
    '                        }\n' +
    '                        wrapper.appendChild(sender);\n' +
    '                        wrapper.appendChild(msg);\n' +
    '                        container.appendChild(wrapper);\n' +
    '                    });\n' +
    '                    container.scrollTop = container.scrollHeight;\n' +
    '                }\n' +
    '            } catch(e) {}\n' +
    '        }\n' +
    '        async function sendMsg() {\n' +
    '            if (!currentUser) return showToast("Connecte-toi d\'abord !", true);\n' +
    '            const input = document.getElementById("msg-input");\n' +
    '            const text = input.value.trim();\n' +
    '            if (!text) return;\n' +
    '            input.value = "";\n' +
    '            try {\n' +
    '                const res = await fetch("/message", { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ chatId, username: currentUser, text }) });\n' +
    '                if (res.ok) { loadMessages(); loadUsers(); }\n' +
    '            } catch(e) { showToast("Erreur", true); }\n' +
    '        }\n' +
    '        if (currentUser) { document.getElementById("auth-modal").style.display = "none"; loadUsers(); loadMessages(); startRefresh(); }\n' +
    '    <\/script>\n' +
    '</body>\n' +
    '</html>');
});

// ==========================================
// 🚀 DASHBOARD ADMIN
// ==========================================
app.get('/groq', (req, res) => {
    res.send('<!DOCTYPE html>\n' +
    '<html>\n' +
    '<head>\n' +
    '    <meta charset="UTF-8">\n' +
    '    <meta name="viewport" content="width=device-width, initial-scale=1.0">\n' +
    '    <title>Admin Dashboard - Nexus IA</title>\n' +
    '    <style>\n' +
    '        * { box-sizing: border-box; margin: 0; padding: 0; font-family: Arial, sans-serif; }\n' +
    '        body { display: flex; height: 100vh; background: #f5f5f5; }\n' +
    '        #sidebar { width: 280px; background: white; border-right: 1px solid #ddd; display: flex; flex-direction: column; }\n' +
    '        #sidebar h2 { padding: 15px; border-bottom: 1px solid #ddd; font-size: 16px; }\n' +
    '        #user-list { flex: 1; overflow-y: auto; padding: 10px; }\n' +
    '        .user-item { padding: 10px; cursor: pointer; border-radius: 8px; margin-bottom: 5px; }\n' +
    '        .user-item:hover { background: #f0f0f0; }\n' +
    '        .user-item.active { background: #e3e3e3; }\n' +
    '        #main { flex: 1; display: flex; flex-direction: column; background: white; }\n' +
    '        #header { padding: 15px 20px; border-bottom: 1px solid #ddd; }\n' +
    '        #header h3 { font-size: 16px; }\n' +
    '        #messages { flex: 1; overflow-y: auto; padding: 20px; }\n' +
    '        .msg { padding: 10px 14px; border-radius: 10px; margin-bottom: 8px; max-width: 80%; }\n' +
    '        .msg.user { background: #e9ecef; }\n' +
    '        .msg.admin { background: #dbeafe; border-left: 3px solid #6366f1; }\n' +
    '        .msg.ia { background: #f3f4f6; }\n' +
    '        .msg-sender { font-size: 11px; color: #888; }\n' +
    '        .msg .time { font-size: 10px; color: #999; margin-left: 8px; }\n' +
    '        #input-area { padding: 15px 20px; border-top: 1px solid #ddd; display: flex; gap: 10px; }\n' +
    '        #input-area textarea { flex: 1; padding: 10px; border: 1px solid #ddd; border-radius: 8px; resize: vertical; min-height: 60px; }\n' +
    '        #input-area button { padding: 10px 25px; background: #6366f1; color: white; border: none; border-radius: 8px; cursor: pointer; }\n' +
    '        .toast { position: fixed; bottom: 20px; right: 20px; background: #10b981; color: white; padding: 12px 20px; border-radius: 8px; display: none; z-index: 999; }\n' +
    '        .stats { display: grid; grid-template-columns: repeat(4, 1fr); gap: 10px; padding: 10px; background: #f8f9fa; border-radius: 8px; margin-bottom: 15px; }\n' +
    '        .stat-item { text-align: center; }\n' +
    '        .stat-value { font-size: 20px; font-weight: bold; color: #6366f1; }\n' +
    '        .stat-label { font-size: 11px; color: #888; }\n' +
    '    </style>\n' +
    '</head>\n' +
    '<body>\n' +
    '    <div id="sidebar">\n' +
    '        <h2>👑 Admin - Conversations</h2>\n' +
    '        <div id="user-list"></div>\n' +
    '    </div>\n' +
    '    <div id="main">\n' +
    '        <div id="header">\n' +
    '            <h3 id="chat-title">Sélectionnez une conversation</h3>\n' +
    '            <span id="status" style="font-size:12px; color:#10b981;">● En ligne</span>\n' +
    '        </div>\n' +
    '        <div id="messages"></div>\n' +
    '        <div id="input-area">\n' +
    '            <textarea id="admin-input" placeholder="Écris ta réponse ici..."></textarea>\n' +
    '            <button onclick="sendReply()">📤 Envoyer</button>\n' +
    '        </div>\n' +
    '    </div>\n' +
    '    <div class="toast" id="toast"></div>\n' +
    '    <script>\n' +
    '        let allSessions = [];\n' +
    '        let selectedChatId = null;\n' +
    '        let selectedUser = null;\n' +
    '        function showToast(msg, error = false) {\n' +
    '            const t = document.getElementById("toast");\n' +
    '            t.textContent = msg;\n' +
    '            t.style.background = error ? "#ef4444" : "#10b981";\n' +
    '            t.style.display = "block";\n' +
    '            setTimeout(() => t.style.display = "none", 3000);\n' +
    '        }\n' +
    '        async function loadUsers() {\n' +
    '            try {\n' +
    '                const res = await fetch("/recuperer-questions");\n' +
    '                if (res.ok) {\n' +
    '                    const data = await res.json();\n' +
    '                    allSessions = data.questions || [];\n' +
    '                    const list = document.getElementById("user-list");\n' +
    '                    list.innerHTML = "";\n' +
    '                    allSessions.forEach(s => {\n' +
    '                        const div = document.createElement("div");\n' +
    '                        div.className = "user-item" + (s.chatId === selectedChatId ? " active" : "");\n' +
    '                        const count = s.messages ? s.messages.length : 0;\n' +
    '                        div.textContent = "👤 " + s.username + " (" + count + ")";\n' +
    '                        div.onclick = () => { selectedChatId = s.chatId; selectedUser = s.username; loadMessages(); loadUsers(); };\n' +
    '                        list.appendChild(div);\n' +
    '                    });\n' +
    '                    if (allSessions.length === 0) list.innerHTML = "<div style=\\"color:#999; padding:10px;\\">Aucune conversation</div>";\n' +
    '                }\n' +
    '            } catch(e) {}\n' +
    '        }\n' +
    '        async function loadMessages() {\n' +
    '            if (!selectedUser) {\n' +
    '                document.getElementById("messages").innerHTML = "<div style=\\"color:#999; padding:20px;\\">Sélectionnez une conversation</div>";\n' +
    '                return;\n' +
    '            }\n' +
    '            try {\n' +
    '                const res = await fetch("/get-history?chatId=" + selectedChatId + "&username=" + selectedUser);\n' +
    '                if (res.ok) {\n' +
    '                    const data = await res.json();\n' +
    '                    const container = document.getElementById("messages");\n' +
    '                    container.innerHTML = "";\n' +
    '                    (data.messages || []).forEach(m => {\n' +
    '                        const sender = document.createElement("div");\n' +
    '                        sender.className = "msg-sender";\n' +
    '                        sender.textContent = m.sender + " " + (m.timestamp || "");\n' +
    '                        const msg = document.createElement("div");\n' +
    '                        let cls = "msg";\n' +
    '                        if (m.sender === selectedUser) cls += " user";\n' +
    '                        else if (m.isAdmin) cls += " admin";\n' +
    '                        else cls += " ia";\n' +
    '                        msg.className = cls;\n' +
    '                        msg.textContent = m.text;\n' +
    '                        container.appendChild(sender);\n' +
    '                        container.appendChild(msg);\n' +
    '                    });\n' +
    '                    container.scrollTop = container.scrollHeight;\n' +
    '                    document.getElementById("chat-title").textContent = "💬 " + selectedUser;\n' +
    '                }\n' +
    '            } catch(e) {}\n' +
    '        }\n' +
    '        async function sendReply() {\n' +
    '            const textarea = document.getElementById("admin-input");\n' +
    '            const text = textarea.value.trim();\n' +
    '            if (!text || !selectedChatId) return showToast("Écris une réponse et sélectionne une conversation.", true);\n' +
    '            try {\n' +
    '                const res = await fetch("/repondre-humain", { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ chatId: selectedChatId, reponse: text, admin: "Nexus IA" }) });\n' +
    '                if (res.ok) { textarea.value = ""; showToast("✅ Réponse envoyée !"); loadMessages(); loadUsers(); }\n' +
    '                else { showToast("❌ Erreur", true); }\n' +
    '            } catch(e) { showToast("❌ Erreur: " + e.message, true); }\n' +
    '        }\n' +
    '        setInterval(() => { loadUsers(); if (selectedChatId) loadMessages(); }, 3000);\n' +
    '        loadUsers();\n' +
    '    <\/script>\n' +
    '</body>\n' +
    '</html>');
});

// ==========================================
// 🚀 DÉMARRAGE
// ==========================================
// Charger la base de données au démarrage
chargerDB();

const PORT = process.env.PORT || 3000;
app.listen(PORT, () => {
    console.log('\n' +
    '╔═══════════════════════════════════════════════════════╗\n' +
    '║     ✨ NEXUS IA v4.0 - PROFESSIONNEL ✨              ║\n' +
    '╠═══════════════════════════════════════════════════════╣\n' +
    '║   🚀 Créé avec ❤️ par Ismaël                         ║\n' +
    '║   🌐 Serveur : http://localhost:' + PORT + '          ║\n' +
    '║   📊 Dashboard : /groq                               ║\n' +
    '║   🏥 Health : /health                               ║\n' +
    '║   📁 DB: database.json                              ║\n' +
    '║   👤 Utilisateurs: ' + Object.keys(db.users).length + '   ║\n' +
    '║   💬 Conversations: ' + Object.keys(db.conversations).length + '   ║\n' +
    '╚═══════════════════════════════════════════════════════╝\n');
});