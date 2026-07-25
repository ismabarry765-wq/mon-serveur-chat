const express = require('express');
const cors = require('cors');
const path = require('path');
const { Groq } = require('groq-sdk');

const app = express();
app.use(cors());
app.use(express.json());

let GROQ_KEY = process.env.GROQ_API_KEY || "";
let groq = GROQ_KEY ? new Groq({ apiKey: GROQ_KEY }) : null;

let users = {};          
let conversations = {};  
let adminActive = false; 
let lastAdminPing = 0;   

setInterval(() => {
    if (Date.now() - lastAdminPing > 6000) {
        adminActive = false;
    }
}, 3000);

// ==========================================
// 🌐 APPLICATION STYLE CHATGPT SUR /
// ==========================================
app.get('/', (req, res) => {
    res.send(`
    <!DOCTYPE html>
    <html lang="fr">
    <head>
        <meta charset="UTF-8">
        <meta name="viewport" content="width=device-width, initial-scale=1.0">
        <title>Nexus Chat IA</title>
        <style>
            * { box-sizing: border-box; margin: 0; padding: 0; font-family: -apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, sans-serif; }
            body { background-color: #ffffff; color: #0d0d0d; display: flex; height: 100vh; overflow: hidden; }

            /* AUTH MODAL */
            #auth-modal { position: fixed; inset: 0; background: rgba(0,0,0,0.5); display: flex; align-items: center; justify-content: center; z-index: 1000; }
            .auth-box { background: #ffffff; padding: 30px; border-radius: 12px; width: 340px; box-shadow: 0 4px 20px rgba(0,0,0,0.15); text-align: center; }
            .auth-box h2 { margin-bottom: 20px; font-size: 1.3rem; }
            .auth-box input { width: 100%; padding: 10px 14px; margin-bottom: 12px; border: 1px solid #d1d5db; border-radius: 8px; outline: none; }
            .auth-box button { width: 100%; padding: 10px; background: #0d0d0d; color: white; border: none; border-radius: 8px; font-weight: 600; cursor: pointer; }
            .auth-toggle { margin-top: 15px; font-size: 0.85rem; color: #2563eb; cursor: pointer; }

            /* NOTIFICATION TOAST */
            #toast { position: fixed; top: 15px; right: 15px; background: #10b981; color: white; padding: 12px 20px; border-radius: 8px; font-weight: bold; font-size: 0.9rem; display: none; z-index: 1001; }

            /* SIDEBAR STYLE CHATGPT */
            #sidebar { width: 260px; background-color: #f9fafb; border-right: 1px solid #e5e7eb; display: flex; flex-direction: column; transition: margin-left 0.3s ease; }
            #sidebar.closed { margin-left: -260px; }
            .sidebar-header { padding: 15px; border-bottom: 1px solid #e5e7eb; display: flex; justify-content: space-between; align-items: center; }
            .btn-new-chat { width: 100%; padding: 10px; background: #ffffff; border: 1px solid #d1d5db; border-radius: 8px; font-weight: 600; cursor: pointer; text-align: left; }
            .chat-list { flex: 1; overflow-y: auto; padding: 10px; }
            .chat-item { padding: 10px; border-radius: 8px; cursor: pointer; font-size: 0.9rem; margin-bottom: 5px; }
            .chat-item:hover { background: #e5e7eb; }

            /* MAIN CHAT */
            #main-content { flex: 1; display: flex; flex-direction: column; height: 100vh; }
            header { padding: 12px 20px; border-bottom: 1px solid #e5e7eb; display: flex; align-items: center; justify-content: space-between; background: #ffffff; }
            .toggle-btn { background: none; border: none; font-size: 1.3rem; cursor: pointer; padding: 5px; }
            #chat-container { flex: 1; overflow-y: auto; padding: 20px; display: flex; flex-direction: column; gap: 16px; max-width: 768px; width: 100%; margin: 0 auto; }
            .message { padding: 12px 16px; border-radius: 12px; max-width: 85%; line-height: 1.5; font-size: 0.95rem; }
            .user { align-self: flex-end; background: #f3f3f3; color: #0d0d0d; border-bottom-right-radius: 2px; }
            .ai { align-self: flex-start; background: #ffffff; color: #0d0d0d; border: 1px solid #e5e7eb; border-bottom-left-radius: 2px; box-shadow: 0 1px 2px rgba(0,0,0,0.05); }
            .admin { align-self: flex-start; background: #eff6ff; color: #1e40af; border: 1px solid #bfdbfe; }

            #input-container { padding: 15px 20px; background: #ffffff; border-top: 1px solid #e5e7eb; max-width: 768px; width: 100%; margin: 0 auto; }
            .input-box { display: flex; gap: 10px; border: 1px solid #d1d5db; border-radius: 24px; padding: 6px 12px 6px 18px; }
            input[type="text"] { flex: 1; border: none; outline: none; font-size: 1rem; }
            button.btn-send { background: #0d0d0d; color: white; border: none; padding: 8px 16px; border-radius: 18px; font-weight: 600; cursor: pointer; }
        </style>
    </head>
    <body>

        <div id="toast">Notification</div>

        <div id="auth-modal">
            <div class="auth-box">
                <h2 id="auth-title">Connexion</h2>
                <input type="text" id="auth-username" placeholder="Pseudo">
                <input type="password" id="auth-password" placeholder="Mot de passe">
                <button onclick="handleAuth()" id="auth-btn">Se connecter</button>
                <div class="auth-toggle" onclick="toggleAuthMode()" id="auth-toggle-btn">Pas encore de compte ? S'inscrire</div>
            </div>
        </div>

        <div id="sidebar">
            <div class="sidebar-header">
                <strong>✨ Nexus IA</strong>
                <button class="toggle-btn" onclick="toggleSidebar()">✕</button>
            </div>
            <div style="padding: 10px;">
                <button class="btn-new-chat" onclick="newChat()">+ Nouveau chat</button>
            </div>
            <div class="chat-list" id="recent-chats">
                <div class="chat-item">💬 Discussion actuelle</div>
            </div>
        </div>

        <div id="main-content">
            <header>
                <button class="toggle-btn" onclick="toggleSidebar()">☰</button>
                <span id="user-display" style="font-size: 0.9rem; font-weight: bold; color: #4b5563;">Non connecté</span>
            </header>

            <div id="chat-container"></div>

            <div id="input-container">
                <div class="input-box">
                    <input type="text" id="user-input" placeholder="Envoyer un message à Nexus..." onkeydown="if(event.key==='Enter') sendMsg()">
                    <button class="btn-send" onclick="sendMsg()">Envoyer</button>
                </div>
            </div>
        </div>

        <script>
            let isSignUp = false;
            let currentUser = null;
            let chatId = "session_" + Math.floor(Math.random() * 10000);

            function showToast(text, isError = false) {
                const toast = document.getElementById('toast');
                toast.innerText = text;
                toast.style.background = isError ? '#ef4444' : '#10b981';
                toast.style.display = 'block';
                setTimeout(() => { toast.style.display = 'none'; }, 3000);
            }

            function toggleSidebar() {
                document.getElementById('sidebar').classList.toggle('closed');
            }

            function toggleAuthMode() {
                isSignUp = !isSignUp;
                document.getElementById('auth-title').innerText = isSignUp ? "Inscription" : "Connexion";
                document.getElementById('auth-btn').innerText = isSignUp ? "S'inscrire" : "Se connecter";
                document.getElementById('auth-toggle-btn').innerText = isSignUp ? "Déjà un compte ? Se connecter" : "Pas encore de compte ? S'inscrire";
            }

            async function handleAuth() {
                const username = document.getElementById('auth-username').value.trim();
                const password = document.getElementById('auth-password').value.trim();
                if (!username || !password) return showToast("Remplis tous les champs !", true);

                const endpoint = isSignUp ? '/api/register' : '/api/login';
                try {
                    const res = await fetch(endpoint, {
                        method: 'POST',
                        headers: { 'Content-Type': 'application/json' },
                        body: JSON.stringify({ username, password })
                    });
                    const data = await res.json();

                    if (res.ok) {
                        currentUser = username;
                        document.getElementById('user-display').innerText = "👤 " + currentUser;
                        document.getElementById('auth-modal').style.display = 'none';
                        showToast(data.message);
                    } else {
                        showToast(data.error, true);
                    }
                } catch (e) {
                    showToast("Erreur serveur", true);
                }
            }

            async function sendMsg() {
                if (!currentUser) return showToast("Connecte-toi d'abord !", true);
                const input = document.getElementById('user-input');
                const text = input.value.trim();
                if (!text) return;

                appendMsg('user', text);
                input.value = '';

                try {
                    const res = await fetch('/message', {
                        method: 'POST',
                        headers: { 'Content-Type': 'application/json' },
                        body: JSON.stringify({ chatId, username: currentUser, text })
                    });
                    const data = await res.json();
                    if (data.reply) {
                        appendMsg('ai', data.reply);
                    } else if (data.adminPresent) {
                        showToast("Message envoyé à l'Admin !");
                    }
                } catch(e) {
                    appendMsg('ai', "Erreur de connexion.");
                }
            }

            function appendMsg(type, text) {
                const box = document.getElementById('chat-container');
                const div = document.createElement('div');
                div.className = 'message ' + type;
                div.innerText = text;
                box.appendChild(div);
                box.scrollTop = box.scrollHeight;
            }

            function newChat() {
                chatId = "session_" + Math.floor(Math.random() * 10000);
                document.getElementById('chat-container').innerHTML = '';
                showToast("Nouvelle discussion créée !");
            }
        </script>
    </body>
    </html>
    `);
});

// --- API AUTHENTIFICATION ---
app.post('/api/register', (req, res) => {
    const { username, password } = req.body;
    if (!username || !password) return res.status(400).json({ error: "Champs manquants" });
    if (users[username]) return res.status(400).json({ error: "Ce pseudo est déjà pris !" });
    users[username] = password;
    res.json({ success: true, message: "Compte créé !" });
});

app.post('/api/login', (req, res) => {
    const { username, password } = req.body;
    if (!users[username] || users[username] !== password) {
        return res.status(401).json({ error: "Pseudo ou mot de passe incorrect." });
    }
    res.json({ success: true, message: "Connexion réussie !" });
});

app.post('/api/admin/ping', (req, res) => {
    adminActive = true;
    lastAdminPing = Date.now();
    res.json({ success: true, adminActive });
});

app.post('/set-api-key', (req, res) => {
    const { apiKey } = req.body;
    if (apiKey) {
        GROQ_KEY = apiKey;
        groq = new Groq({ apiKey: GROQ_KEY });
    }
    res.json({ success: true });
});

// --- MESSAGERIE ---
app.post('/message', async (req, res) => {
    const { chatId, username, text } = req.body;
    if (!chatId) return res.status(400).send("chatId requis");

    if (!conversations[chatId]) {
        conversations[chatId] = { username: username || "Visiteur", messages: [] };
    }

    conversations[chatId].messages.push({ sender: username || "Visiteur", text: text || "" });

    let reply = null;

    // Si le panneau Python n'est pas ouvert, Groq répond automatiquement
    if (!adminActive && groq) {
        try {
            const completion = await groq.chat.completions.create({
                messages: [{ role: "user", content: text || "Bonjour" }],
                model: "llama-3.3-70b-versatile",
            });

            reply = completion.choices[0]?.message?.content || "Pas de réponse";
            conversations[chatId].messages.push({ sender: "Groq IA", text: reply });
        } catch (e) {
            console.error("Erreur Groq:", e.message);
        }
    }

    res.json({ success: true, reply, adminPresent: adminActive });
});

app.get('/recuperer-questions', (req, res) => {
    const questions = Object.keys(conversations).map(chatId => ({
        chatId: chatId,
        username: conversations[chatId].username,
        messages: conversations[chatId].messages
    }));
    res.json({ questions, adminActive });
});

app.get('/chats/:username', (req, res) => {
    const user = req.params.username;
    const userChats = Object.values(conversations).filter(c => c.username === user);
    res.json({ chats: userChats });
});

app.post('/repondre-humain', async (req, res) => {
    const { chatId, reponse, admin, forceIa } = req.body;
    if (!conversations[chatId]) return res.status(404).send("Chat introuvable");

    if (forceIa && groq) {
        const lastMsg = conversations[chatId].messages.slice().reverse().find(m => m.sender !== "Groq IA");
        const prompt = lastMsg ? lastMsg.text : "Bonjour";
        try {
            const completion = await groq.chat.completions.create({
                messages: [{ role: "user", content: prompt }],
                model: "llama-3.3-70b-versatile",
            });
            const reply = completion.choices[0]?.message?.content || "Erreur IA";
            conversations[chatId].messages.push({ sender: "Groq IA", text: reply });
        } catch (e) { console.error(e.message); }
    } else if (reponse) {
        conversations[chatId].messages.push({ sender: admin || "Admin", text: reponse });
    }

    res.json({ success: true });
});

const PORT = process.env.PORT || 3000;
app.listen(PORT, () => console.log(`🚀 Serveur actif sur le port ${PORT}`));
