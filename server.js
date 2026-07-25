const express = require('express');
const cors = require('cors');

const app = express();
app.use(cors());
app.use(express.json());

// ==========================================
// 🌟 CONFIGURATION
// ==========================================
let users = {};
let conversations = {};

// ==========================================
// 🌐 PAGE PRINCIPALE
// ==========================================
app.get('/', (req, res) => {
    res.send('<!DOCTYPE html>\n' +
    '<html>\n' +
    '<head>\n' +
    '    <meta charset="UTF-8">\n' +
    '    <meta name="viewport" content="width=device-width, initial-scale=1.0">\n' +
    '    <title>Nexus Chat IA</title>\n' +
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
    '        .msg { margin-bottom: 12px; padding: 10px 14px; border-radius: 10px; max-width: 80%; }\n' +
    '        .msg.user { background: #e9ecef; align-self: flex-start; }\n' +
    '        .msg.admin { background: #dbeafe; color: #1e40af; align-self: flex-start; border-left: 3px solid #6366f1; }\n' +
    '        .msg.ia { background: #f3f4f6; align-self: flex-start; }\n' +
    '        .msg-wrapper { display: flex; flex-direction: column; }\n' +
    '        .msg-sender { font-size: 11px; color: #888; margin-bottom: 3px; }\n' +
    '        #input-area { padding: 15px 20px; border-top: 1px solid #ddd; display: flex; gap: 10px; }\n' +
    '        #input-area input { flex: 1; padding: 10px 15px; border: 1px solid #ddd; border-radius: 20px; outline: none; }\n' +
    '        #input-area button { padding: 10px 25px; background: #6366f1; color: white; border: none; border-radius: 20px; cursor: pointer; }\n' +
    '        #input-area button:hover { background: #4f52d9; }\n' +
    '        #auth-modal { position: fixed; inset: 0; background: rgba(0,0,0,0.5); display: flex; align-items: center; justify-content: center; z-index: 1000; }\n' +
    '        .auth-box { background: white; padding: 30px; border-radius: 12px; width: 340px; text-align: center; }\n' +
    '        .auth-box input { width: 100%; padding: 10px; margin-bottom: 10px; border: 1px solid #ddd; border-radius: 8px; }\n' +
    '        .auth-box button { width: 100%; padding: 10px; background: #6366f1; color: white; border: none; border-radius: 8px; cursor: pointer; }\n' +
    '        .auth-toggle { margin-top: 12px; color: #6366f1; cursor: pointer; font-size: 14px; }\n' +
    '        .toast { position: fixed; bottom: 20px; right: 20px; background: #10b981; color: white; padding: 12px 20px; border-radius: 8px; display: none; }\n' +
    '    </style>\n' +
    '</head>\n' +
    '<body>\n' +
    '    <div id="auth-modal">\n' +
    '        <div class="auth-box">\n' +
    '            <h2>✨ Nexus IA</h2>\n' +
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
    '            <span style="font-size:12px; color:#10b981;">● En ligne</span>\n' +
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
    '        if (!localStorage.getItem("nexus_chatId")) {\n' +
    '            localStorage.setItem("nexus_chatId", chatId);\n' +
    '        }\n' +
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
    '                const res = await fetch(endpoint, {\n' +
    '                    method: "POST",\n' +
    '                    headers: { "Content-Type": "application/json" },\n' +
    '                    body: JSON.stringify({ username, password })\n' +
    '                });\n' +
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
    '                    showToast(data.error, true);\n' +
    '                }\n' +
    '            } catch(e) {\n' +
    '                showToast("Erreur serveur", true);\n' +
    '            }\n' +
    '        }\n' +
    '        function logout() {\n' +
    '            localStorage.removeItem("nexus_user");\n' +
    '            location.reload();\n' +
    '        }\n' +
    '        function startRefresh() {\n' +
    '            if (refreshInterval) clearInterval(refreshInterval);\n' +
    '            refreshInterval = setInterval(() => {\n' +
    '                if (currentUser) {\n' +
    '                    loadMessages();\n' +
    '                    loadUsers();\n' +
    '                }\n' +
    '            }, 3000);\n' +
    '        }\n' +
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
    '                        div.textContent = "👤 " + q.username + " (" + (q.messages ? q.messages.length : 0) + ")";\n' +
    '                        div.onclick = () => { chatId = q.chatId; localStorage.setItem("nexus_chatId", chatId); loadMessages(); loadUsers(); };\n' +
    '                        list.appendChild(div);\n' +
    '                    });\n' +
    '                    if (data.questions.length === 0) {\n' +
    '                        list.innerHTML = "<div style=\\"color:#999; padding:10px;\\">Aucune conversation</div>";\n' +
    '                    }\n' +
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
    '                    data.messages.forEach(m => {\n' +
    '                        const wrapper = document.createElement("div");\n' +
    '                        wrapper.className = "msg-wrapper";\n' +
    '                        const sender = document.createElement("div");\n' +
    '                        sender.className = "msg-sender";\n' +
    '                        sender.textContent = m.sender;\n' +
    '                        const msg = document.createElement("div");\n' +
    '                        let cls = "msg";\n' +
    '                        if (m.sender === currentUser) cls += " user";\n' +
    '                        else if (m.sender === "Nexus IA" || m.sender === "Admin") cls += " admin";\n' +
    '                        else cls += " ia";\n' +
    '                        msg.className = cls;\n' +
    '                        msg.textContent = m.text;\n' +
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
    '                const res = await fetch("/message", {\n' +
    '                    method: "POST",\n' +
    '                    headers: { "Content-Type": "application/json" },\n' +
    '                    body: JSON.stringify({ chatId, username: currentUser, text })\n' +
    '                });\n' +
    '                if (res.ok) {\n' +
    '                    loadMessages();\n' +
    '                    loadUsers();\n' +
    '                }\n' +
    '            } catch(e) {\n' +
    '                showToast("Erreur", true);\n' +
    '            }\n' +
    '        }\n' +
    '        if (currentUser) {\n' +
    '            document.getElementById("auth-modal").style.display = "none";\n' +
    '            loadUsers();\n' +
    '            loadMessages();\n' +
    '            startRefresh();\n' +
    '        }\n' +
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
    '    <title>Admin - Nexus IA</title>\n' +
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
    '        #input-area { padding: 15px 20px; border-top: 1px solid #ddd; display: flex; gap: 10px; }\n' +
    '        #input-area textarea { flex: 1; padding: 10px; border: 1px solid #ddd; border-radius: 8px; resize: vertical; min-height: 60px; }\n' +
    '        #input-area button { padding: 10px 25px; background: #6366f1; color: white; border: none; border-radius: 8px; cursor: pointer; }\n' +
    '        .toast { position: fixed; bottom: 20px; right: 20px; background: #10b981; color: white; padding: 12px 20px; border-radius: 8px; display: none; z-index: 999; }\n' +
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
    '                        div.textContent = "👤 " + s.username + " (" + (s.messages ? s.messages.length : 0) + ")";\n' +
    '                        div.onclick = () => { selectedChatId = s.chatId; selectedUser = s.username; loadMessages(); loadUsers(); };\n' +
    '                        list.appendChild(div);\n' +
    '                    });\n' +
    '                    if (allSessions.length === 0) {\n' +
    '                        list.innerHTML = "<div style=\\"color:#999; padding:10px;\\">Aucune conversation</div>";\n' +
    '                    }\n' +
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
    '                    data.messages.forEach(m => {\n' +
    '                        const sender = document.createElement("div");\n' +
    '                        sender.className = "msg-sender";\n' +
    '                        sender.textContent = m.sender;\n' +
    '                        const msg = document.createElement("div");\n' +
    '                        let cls = "msg";\n' +
    '                        if (m.sender === selectedUser) cls += " user";\n' +
    '                        else if (m.sender === "Nexus IA" || m.sender === "Admin") cls += " admin";\n' +
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
    '            if (!text || !selectedChatId) {\n' +
    '                return showToast("Écris une réponse et sélectionne une conversation.", true);\n' +
    '            }\n' +
    '            try {\n' +
    '                const res = await fetch("/repondre-humain", {\n' +
    '                    method: "POST",\n' +
    '                    headers: { "Content-Type": "application/json" },\n' +
    '                    body: JSON.stringify({ chatId: selectedChatId, reponse: text, admin: "Nexus IA" })\n' +
    '                });\n' +
    '                if (res.ok) {\n' +
    '                    textarea.value = "";\n' +
    '                    showToast("✅ Réponse envoyée !");\n' +
    '                    loadMessages();\n' +
    '                    loadUsers();\n' +
    '                } else {\n' +
    '                    showToast("❌ Erreur", true);\n' +
    '                }\n' +
    '            } catch(e) {\n' +
    '                showToast("❌ Erreur: " + e.message, true);\n' +
    '            }\n' +
    '        }\n' +
    '        setInterval(() => {\n' +
    '            loadUsers();\n' +
    '            if (selectedChatId) loadMessages();\n' +
    '        }, 3000);\n' +
    '        loadUsers();\n' +
    '    <\/script>\n' +
    '</body>\n' +
    '</html>');
});

// ==========================================
// 🔐 API
// ==========================================
app.post('/api/register', (req, res) => {
    const { username, password } = req.body;
    if (!username || !password) return res.status(400).json({ error: "Champs manquants" });
    if (users[username]) return res.status(400).json({ error: "Pseudo déjà pris !" });
    users[username] = password;
    res.json({ message: "Compte créé !" });
});

app.post('/api/login', (req, res) => {
    const { username, password } = req.body;
    if (!username || !password) return res.status(400).json({ error: "Champs manquants" });
    if (!users[username] || users[username] !== password) {
        return res.status(401).json({ error: "Identifiants incorrects" });
    }
    res.json({ message: "Bienvenue " + username + " !" });
});

app.post('/api/delete-account', (req, res) => {
    const { username, password } = req.body;
    if (!username || !password) return res.status(400).json({ error: "Champs manquants" });
    if (!users[username] || users[username] !== password) {
        return res.status(401).json({ error: "Mot de passe incorrect" });
    }
    delete users[username];
    Object.keys(conversations).forEach(key => {
        if (conversations[key].username === username) delete conversations[key];
    });
    res.json({ message: "Compte supprimé" });
});

// ==========================================
// 💬 CONVERSATION
// ==========================================
app.post('/message', (req, res) => {
    const { chatId, username, text } = req.body;
    if (!chatId || !username || !text) return res.status(400).json({ error: "Données manquantes" });
    
    if (!conversations[chatId]) {
        conversations[chatId] = { username, messages: [] };
    }
    
    conversations[chatId].messages.push({ sender: username, text });
    conversations[chatId].messages.push({ sender: "Groq IA", text: "Nexus IA réfléchit..." });
    
    res.json({ reply: "Nexus IA réfléchit..." });
});

app.post('/repondre-humain', (req, res) => {
    const { chatId, reponse, admin } = req.body;
    if (!chatId || !reponse) return res.status(400).json({ error: "Données manquantes" });
    if (!conversations[chatId]) return res.status(404).json({ error: "Conversation introuvable" });
    
    conversations[chatId].messages = conversations[chatId].messages.filter(
        m => !(m.sender === "Groq IA" && m.text === "Nexus IA réfléchit...")
    );
    
    conversations[chatId].messages.push({ sender: admin || "Nexus IA", text: reponse, isAdmin: true });
    res.json({ success: true });
});

app.get('/recuperer-questions', (req, res) => {
    const questions = Object.keys(conversations).map(chatId => ({
        chatId,
        username: conversations[chatId].username,
        messages: conversations[chatId].messages,
        messageCount: conversations[chatId].messages.length
    }));
    res.json({ questions });
});

app.get('/get-history', (req, res) => {
    const { chatId, username } = req.query;
    if (!chatId || !username) return res.status(400).json({ error: "Paramètres manquants" });
    const chat = conversations[chatId];
    if (!chat || chat.username !== username) return res.json({ messages: [] });
    res.json({ messages: chat.messages });
});

// ==========================================
// 🚀 DÉMARRAGE
// ==========================================
const PORT = process.env.PORT || 3000;
app.listen(PORT, () => {
    console.log('🚀 Nexus IA démarré sur le port', PORT);
});