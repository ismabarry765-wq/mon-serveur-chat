const express = require('express');
const cors = require('cors');
const path = require('path');
const { Groq } = require('groq-sdk');

const app = express();
app.use(cors());
app.use(express.json());
app.use(express.static(__dirname));

let GROQ_KEY = process.env.GROQ_API_KEY || "";
let groq = GROQ_KEY ? new Groq({ apiKey: GROQ_KEY }) : null;

let users = {};          // { pseudo: password }
let conversations = {};  // { chatId: { username, messages: [] } }
let adminActive = false;
let lastAdminPing = 0;

setInterval(() => {
    if (Date.now() - lastAdminPing > 6000) {
        adminActive = false;
    }
}, 3000);

// ==========================================
// 🌐 APP WEB UTILISATEUR (Directement dans le JS)
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
            body { background-color: #ffffff; color: #0d0d0d; display: flex; flex-direction: column; height: 100vh; }
            header { background: #f9fafb; padding: 15px 20px; border-bottom: 1px solid #e5e7eb; display: flex; justify-content: space-between; align-items: center; }
            h1 { font-size: 1.1rem; font-weight: 600; color: #111827; }
            #chat-container { flex: 1; overflow-y: auto; padding: 20px; display: flex; flex-direction: column; gap: 16px; max-width: 768px; width: 100%; margin: 0 auto; }
            .message { padding: 12px 16px; border-radius: 12px; max-width: 85%; line-height: 1.5; font-size: 0.95rem; }
            .user { align-self: flex-end; background: #f3f3f3; color: #0d0d0d; border-bottom-right-radius: 2px; }
            .ai { align-self: flex-start; background: #ffffff; color: #0d0d0d; border: 1px solid #e5e7eb; border-bottom-left-radius: 2px; box-shadow: 0 1px 2px rgba(0,0,0,0.05); }
            .admin { align-self: flex-start; background: #eff6ff; color: #1e40af; border: 1px solid #bfdbfe; }
            #input-container { padding: 15px 20px; background: #ffffff; border-top: 1px solid #e5e7eb; max-width: 768px; width: 100%; margin: 0 auto; }
            .input-box { display: flex; gap: 10px; border: 1px solid #d1d5db; border-radius: 24px; padding: 6px 12px 6px 18px; background: #ffffff; }
            input { flex: 1; border: none; outline: none; font-size: 1rem; background: transparent; }
            button { background: #0d0d0d; color: white; border: none; padding: 8px 16px; border-radius: 18px; font-weight: 600; cursor: pointer; }
        </style>
    </head>
    <body>
        <header>
            <h1>✨ Assistant Nexus IA</h1>
            <span style="font-size: 0.85rem; color: #10b981; font-weight: bold;">● En Ligne</span>
        </header>
        <div id="chat-container"></div>
        <div id="input-container">
            <div class="input-box">
                <input type="text" id="user-input" placeholder="Envoyer un message..." onkeydown="if(event.key==='Enter') sendMsg()">
                <button onclick="sendMsg()">Envoyer</button>
            </div>
        </div>
        <script>
            const chatId = "session_" + Math.floor(Math.random() * 10000);
            const username = "Visiteur_" + chatId.slice(-4);

            async function sendMsg() {
                const input = document.getElementById('user-input');
                const text = input.value.trim();
                if (!text) return;

                appendMsg('user', text);
                input.value = '';

                try {
                    const res = await fetch('/message', {
                        method: 'POST',
                        headers: { 'Content-Type': 'application/json' },
                        body: JSON.stringify({ chatId, username, text })
                    });
                    const data = await res.json();
                    if (data.reply) {
                        appendMsg(data.isHuman ? 'admin' : 'ai', data.reply);
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
        </script>
    </body>
    </html>
    `);
});

// Route pour la page spéciale de Groq
app.get('/groq', (req, res) => {
    res.sendFile(path.join(__dirname, 'groq.html'));
});

// --- API AUTHENTIFICATION ---
app.post('/api/register', (req, res) => {
    const { username, password } = req.body;
    if (!username || !password) return res.status(400).json({ error: "Champs incomplets" });
    if (users[username]) return res.status(400).json({ error: "Ce pseudo existe déjà !" });
    users[username] = password;
    res.json({ success: true, message: "Compte créé !" });
});

app.post('/api/login', (req, res) => {
    const { username, password } = req.body;
    if (!users[username] || users[username] !== password) {
        return res.status(401).json({ error: "Identifiants incorrects" });
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
    let thought = null;

    if (!adminActive && groq) {
        try {
            const completion = await groq.chat.completions.create({
                messages: [{ role: "user", content: text || "Bonjour" }],
                model: "llama-3.3-70b-versatile",
            });

            reply = completion.choices[0]?.message?.content || "Pas de réponse";
            thought = "Analyse du prompt utilisateur, génération de la réponse la plus pertinente via Llama 3.3...";

            conversations[chatId].messages.push({ sender: "Groq IA", text: reply, thought: thought });
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
