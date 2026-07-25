const express = require('express');
const cors = require('cors');
const { Groq } = require('groq-sdk');

const app = express();
app.use(cors());
app.use(express.json());

let GROQ_KEY = process.env.GROQ_API_KEY || "";
let groq = GROQ_KEY ? new Groq({ apiKey: GROQ_KEY }) : null;

// Base de données temporaire en mémoire
let conversations = {};

// 1. Définir ou mettre à jour la clé API depuis le Panneau Admin
app.post('/set-api-key', (req, res) => {
    const { apiKey } = req.body;
    if (!apiKey) return res.status(400).json({ error: "Clé manquante" });
    
    GROQ_KEY = apiKey;
    groq = new Groq({ apiKey: GROQ_KEY });
    console.log("🔑 Nouvelle clé API Groq enregistrée !");
    return res.json({ success: true, message: "Clé API mise à jour !" });
});

// 2. Récupérer les conversations pour le Panneau Admin
app.get('/recuperer-questions', (req, res) => {
    const questions = Object.keys(conversations).map(chatId => ({
        chatId: chatId,
        username: conversations[chatId].username,
        audio: conversations[chatId].messages.some(m => m.audio)
    }));
    res.json({ questions });
});

// 3. Obtenir l'historique d'un chat
app.get('/chats/:username', (req, res) => {
    const user = req.params.username;
    const userChats = Object.values(conversations).filter(c => c.username === user);
    res.json({ chats: userChats });
});

// 4. Recevoir un message utilisateur / vocal
app.post('/message', async (req, res) => {
    const { chatId, username, text, audio } = req.body;
    if (!chatId) return res.status(400).send("chatId requis");

    if (!conversations[chatId]) {
        conversations[chatId] = { username: username || "Utilisateur", messages: [] };
    }

    const msgObj = { sender: username || "Utilisateur", text: text || "[Vocal reçu]", audio: !!audio };
    conversations[chatId].messages.push(msgObj);

    // Réponse automatique par IA si Groq est configuré
    if (groq) {
        try {
            const completion = await groq.chat.completions.create({
                messages: [{ role: "user", content: text || "Bonjour" }],
                model: "llama-3.3-70b-versatile",
            });
            const reply = completion.choices[0]?.message?.content || "Pas de réponse.";
            conversations[chatId].messages.push({ sender: "Groq IA", text: reply });
        } catch (e) {
            console.error("Erreur Groq:", e.message);
        }
    }

    res.json({ success: true });
});

// 5. Réponse Admin Humain ou Forcer IA
app.post('/repondre-humain', async (req, res) => {
    const { chatId, reponse, admin, forceIa } = req.body;
    if (!conversations[chatId]) return res.status(404).send("Chat non trouvé");

    if (forceIa && groq) {
        const lastMsg = conversations[chatId].messages.slice().reverse().find(m => m.sender !== "Groq IA");
        const prompt = lastMsg ? lastMsg.text : "Bonjour";
        const completion = await groq.chat.completions.create({
            messages: [{ role: "user", content: prompt }],
            model: "llama-3.3-70b-versatile",
        });
        const reply = completion.choices[0]?.message?.content || "Erreur IA";
        conversations[chatId].messages.push({ sender: "Groq IA", text: reply });
    } else if (reponse) {
        conversations[chatId].messages.push({ sender: admin || "Admin", text: reponse });
    }

    res.json({ success: true });
});

// 6. Supprimer un chat
app.delete('/supprimer-chat/:chatId', (req, res) => {
    delete conversations[req.params.chatId];
    res.json({ success: true });
});

const PORT = process.env.PORT || 3000;
app.listen(PORT, () => console.log(`🚀 Serveur actif sur le port ${PORT}`));
