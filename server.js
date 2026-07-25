// Charger les variables d'environnement depuis le fichier .env (sur PC)
require('dotenv').config();

const express = require('express');
const cors = require('cors');
const fetch = require('node-fetch'); // Requis si Node < 18 (natif sur Node 18+)
const { Groq } = require('groq-sdk');

const app = express();
app.use(cors());

// Augmentation de la limite pour recevoir les fichiers audio (Base64)
app.use(express.json({ limit: '25mb' }));
app.use(express.urlencoded({ limit: '25mb', extended: true }));

// =========================================================================
// 🔑 CONFIGURATION GROQ
// =========================================================================
const GROQ_API_KEY = process.env.GROQ_API_KEY;

if (!GROQ_API_KEY) {
    console.warn("⚠️ ATTENTION : La variable GROQ_API_KEY n'est pas configurée dans le fichier .env ou sur Render !");
}

const groq = new Groq({ apiKey: GROQ_API_KEY || "CLE_TEMPORAIRE" });

// =========================================================================
// 🔔 CONFIGURATION NOTIFICATIONS PUSH (ntfy.sh)
// =========================================================================
const NTFY_TOPIC = "nexus-ia-notifs-pannel-mobile";

function envoyerNotificationMobile(titre, message) {
    fetch(`https://ntfy.sh/${NTFY_TOPIC}`, {
        method: 'POST',
        headers: { 'Title': titre },
        body: message
    }).catch(err => console.error("Erreur notification push:", err));
}

// =========================================================================
// 🧠 MÉMOIRE TEMPORAIRE (Timers, Statuts & Discussions)
// =========================================================================
const pendingTimers = {}; // Stocke les décomptes de 5s
const statusChats = {};   // Stocke l'état du chat ("Nexus IA réfléchit...", "libre")
let discussions = {};     // Stocke les discussions en mémoire

function obtenirDiscussion(chatId, username) {
    if (!discussions[chatId]) {
        discussions[chatId] = {
            id: chatId,
            username: username || "Utilisateur",
            messages: []
        };
    }
    return discussions[chatId];
}

// =========================================================================
// 🌐 ROUTES API PRINCIPALES
// =========================================================================

// 1. RÉCEPTION D'UN MESSAGE OU D'UN VOCAL DEPUIS LE WEB
app.post('/envoyer-question', async (req, res) => {
    const { username, message, audio, chatId } = req.body;

    if (!chatId) {
        return res.status(400).json({ error: "chatId requis." });
    }

    const chat = obtenirDiscussion(chatId, username);
    const estAudio = !!audio;

    const nouveauMsg = {
        id: Date.now().toString(),
        sender: username,
        text: estAudio ? "[🎙️ Message Vocal]" : message,
        audioUrl: estAudio ? audio : null,
        isAudio: estAudio,
        timestamp: new Date()
    };

    chat.messages.push(nouveauMsg);
    res.json({ status: "ok", message: "Message bien reçu par le serveur" });

    // Notification sur le téléphone portable
    envoyerNotificationMobile(
        `📩 ${estAudio ? 'Vocal' : 'Message'} de ${username}`,
        estAudio ? "Nouveau vocal disponible 🎙️" : message
    );

    // Si c'est un vocal, on ne déclenche pas le texte Groq
    if (estAudio) return;

    // Annuler l'ancien chrono s'il y en avait un
    if (pendingTimers[chatId]) {
        clearTimeout(pendingTimers[chatId]);
    }

    // Chrono de 5 secondes avant la réponse automatique Groq
    pendingTimers[chatId] = setTimeout(async () => {
        try {
            console.log(`🤖 5s écoulées pour ${username}. Groq prend le relais...`);

            statusChats[chatId] = "Nexus IA réfléchit...";

            const completion = await groq.chat.completions.create({
                messages: [
                    { 
                        role: "system", 
                        content: "Tu es Nexus IA, un assistant intelligent, poli et réactif." 
                    },
                    ...chat.messages
                        .filter(m => !m.isAudio)
                        .map(m => ({
                            role: (m.sender === username) ? "user" : "assistant",
                            content: m.text
                        }))
                ],
                model: "llama-3.3-70b-versatile"
            });

            const reponseIA = completion.choices[0]?.message?.content || "Désolé, je n'ai pas pu générer de réponse.";

            chat.messages.push({
                id: Date.now().toString(),
                sender: "Nexus IA (Groq)",
                text: reponseIA,
                timestamp: new Date()
            });

            statusChats[chatId] = "libre";

            envoyerNotificationMobile(`🤖 Groq a répondu à ${username}`, reponseIA);
            delete pendingTimers[chatId];

        } catch (error) {
            console.error("Erreur Groq:", error);
            statusChats[chatId] = "libre";
        }
    }, 5000);
});

// 2. RÉPONSE MANUELLE (TERMUX) OU COMMANDE /ia
app.post('/repondre-humain', async (req, res) => {
    const { username, chatId, reponse, admin, forceIa } = req.body;

    const targetChatId = chatId || Object.keys(discussions).find(id => discussions[id].username === username);

    if (!targetChatId || !discussions[targetChatId]) {
        return res.status(404).json({ error: "Discussion introuvable." });
    }

    // Interruption du timer automatique : l'admin est intervenu !
    if (pendingTimers[targetChatId]) {
        clearTimeout(pendingTimers[targetChatId]);
        delete pendingTimers[targetChatId];
        console.log(`🛑 Interruption : Admin connecté pour ${targetChatId}. Timer annulé.`);
    }

    const chat = discussions[targetChatId];

    // Commande /ia forcée depuis Termux
    if (forceIa) {
        statusChats[targetChatId] = "Nexus IA réfléchit...";
        try {
            const completion = await groq.chat.completions.create({
                messages: [
                    { role: "system", content: "Tu es Nexus IA. Réponds à l'utilisateur." },
                    ...chat.messages.filter(m => !m.isAudio).map(m => ({
                        role: (m.sender === chat.username) ? "user" : "assistant",
                        content: m.text
                    }))
                ],
                model: "llama-3.3-70b-versatile"
            });

            const reponseIA = completion.choices[0]?.message?.content || "Erreur IA.";
            chat.messages.push({
                id: Date.now().toString(),
                sender: "Nexus IA (Groq)",
                text: reponseIA,
                timestamp: new Date()
            });

            statusChats[targetChatId] = "libre";
            return res.json({ status: "success", mode: "force_ia", reponse: reponseIA });
        } catch (err) {
            statusChats[targetChatId] = "libre";
            return res.status(500).json({ error: "Erreur lors du traitement Groq" });
        }
    }

    // Réponse humaine classique
    chat.messages.push({
        id: Date.now().toString(),
        sender: admin || "Nexus ia",
        text: reponse,
        timestamp: new Date()
    });

    statusChats[targetChatId] = "libre";
    res.json({ status: "success", mode: "humain" });
});

// 3. RECUPERER LES QUESTIONS / VOCAUX POUR L'APPLICATION ET TERMUX
app.get('/recuperer-questions', (req, res) => {
    const questions = [];
    for (const cid in discussions) {
        const d = discussions[cid];
        const lastMsg = d.messages[d.messages.length - 1];
        if (lastMsg) {
            questions.push({
                chatId: cid,
                username: d.username,
                message: lastMsg.text,
                audio: lastMsg.isAudio ? lastMsg.audioUrl : null,
                msgId: lastMsg.id
            });
        }
    }
    res.json({ questions });
});

// 4. RECUPERER L'HISTORIQUE DE CHAT PAR PSEUDO
app.get('/chats/:username', (req, res) => {
    const username = req.params.username;
    const match = Object.values(discussions).filter(d => d.username.toLowerCase() === username.toLowerCase());
    res.json({ chats: match });
});

// 5. STATUT DU CHAT ("Nexus IA réfléchit...")
app.get('/statut-chat/:chatId', (req, res) => {
    res.json({ status: statusChats[req.params.chatId] || "libre" });
});

// =========================================================================
// 🗑️ ROUTES DE SUPPRESSION
// =========================================================================

// Supprimer tout un chat
app.delete('/supprimer-chat/:chatId', (req, res) => {
    const cid = req.params.chatId;
    if (discussions[cid]) {
        delete discussions[cid];
        delete statusChats[cid];
        if (pendingTimers[cid]) clearTimeout(pendingTimers[cid]);
        return res.json({ status: "success", message: "Chat supprimé." });
    }
    res.status(404).json({ error: "Chat introuvable." });
});

// Supprimer un message / vocal précis
app.post('/supprimer-message', (req, res) => {
    const { chatId, msgId } = req.body;
    if (discussions[chatId]) {
        discussions[chatId].messages = discussions[chatId].messages.filter(m => m.id !== msgId);
        return res.json({ status: "success", message: "Message supprimé." });
    }
    res.status(404).json({ error: "Chat introuvable." });
});

// =========================================================================
// 🚀 DÉMARRAGE DU SERVEUR SUR PC
// =========================================================================
const PORT = process.env.PORT || 3000;
app.listen(PORT, () => {
    console.log(`=================================================`);
    console.log(`🚀 SERVEUR NEXUS IA EN ÉCOUTE SUR LE PORT : ${PORT}`);
    console.log(`📍 URL locale : http://localhost:${PORT}`);
    console.log(`🔔 Notifications Push : ntfy.sh/${NTFY_TOPIC}`);
    console.log(`=================================================`);
});
