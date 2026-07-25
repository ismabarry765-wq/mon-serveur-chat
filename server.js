const express = require('express');
const cors = require('cors');
const fetch = require('node-fetch'); // Si tu es sur Node < 18. Sur Node 18+, fetch est inclus nativement.
const { Groq } = require('groq-sdk');

const app = express();
app.use(cors());
app.use(express.json());

// =========================================================================
// 🔑 CONFIGURATION DE LA CLÉ API GROQ
// =========================================================================
// Option A (Recommandée) : Utilise la variable d'environnement sur Render.
// Option B : Remplace 'TA_CLE_API_GROQ_ICI' directement par ta vraie clé (ex: 'gsk_...').
const GROQ_API_KEY = process.env.GROQ_API_KEY || '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'; // <--- METS TA CLÉ API ICI SI TU NE L'AS PAS MISE SUR RENDER !

const groq = new Groq({ apiKey: GROQ_API_KEY });

// =========================================================================
// 🔔 CONFIGURATION NOTIFICATIONS PUSH (NTFY.SH)
// =========================================================================
// Choisis un nom unique et secret pour ton canal de notification.
// Abonne-toi à ce même canal sur l'application mobile "ntfy" (Android/iOS).
const NTFY_TOPIC = "nexus-ia-notifs-pannel-mobile";

function envoyerNotificationMobile(titre, message) {
    fetch(`https://ntfy.sh/${NTFY_TOPIC}`, {
        method: 'POST',
        headers: { 'Title': titre },
        body: message
    }).catch(err => console.error("Erreur d'envoi notification:", err));
}

// =========================================================================
// 🧠 MÉMOIRE TEMPORAIRE (Bases de données / Timers)
// =========================================================================
const pendingTimers = {}; // Stocke les décomptes de 5 secondes
const statusChats = {};   // Stocke le statut ("Nexus IA réfléchit...", "libre", etc.)
let discussions = {};     // Stocke l'historique des discussions (ChatId -> { username, messages: [] })

// Helper pour récupérer ou créer une discussion
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
// 🌐 ROUTES API
// =========================================================================

// 1. L'UTILISATEUR ENVOIE UN MESSAGE DEPUIS LE SITE WEB
app.post('/envoyer-question', async (req, res) => {
    const { username, message, chatId } = req.body;

    if (!chatId || !message) {
        return res.status(400).json({ error: "Données manquantes (chatId ou message)." });
    }

    const chat = obtenirDiscussion(chatId, username);
    chat.messages.push({ sender: username, text: message, timestamp: new Date() });

    // Réponse rapide au navigateur client
    res.json({ status: "ok", message: "Message reçu par le serveur" });

    // Alerte immédiate sur ton téléphone pour te dire de te connecter
    envoyerNotificationMobile(
        `📩 Message de ${username}`,
        `${message}\n(Tu as 5s pour répondre sur Termux !)`
    );

    // Annuler l'ancien chrono s'il y en avait un en cours pour ce chat
    if (pendingTimers[chatId]) {
        clearTimeout(pendingTimers[chatId]);
    }

    // Proposer d'attendre 5 secondes avant de déclencher Groq
    pendingTimers[chatId] = setTimeout(async () => {
        try {
            console.log(`🤖 5 secondes écoulées pour ${username}. Groq prend le relais...`);

            // Mettre à jour le statut pour le Web
            statusChats[chatId] = "Nexus IA réfléchit...";

            // Appel à l'API Groq
            const completion = await groq.chat.completions.create({
                messages: [
                    { 
                        role: "system", 
                        content: "Tu es Nexus IA, un assistant intelligent, poli et rapide. Réponds clairement à l'utilisateur." 
                    },
                    ...chat.messages.map(m => ({
                        role: (m.sender === username) ? "user" : "assistant",
                        content: m.text
                    }))
                ],
                model: "llama-3.3-70b-versatile"
            });

            const reponseIA = completion.choices[0]?.message?.content || "Désolé, je n'ai pas pu générer de réponse.";

            // Sauvegarder la réponse de Groq
            chat.messages.push({ sender: "Nexus IA (Groq)", text: reponseIA, timestamp: new Date() });
            statusChats[chatId] = "libre";

            // Notification d'information
            envoyerNotificationMobile(`🤖 Groq a répondu à ${username}`, reponseIA);

            delete pendingTimers[chatId];
        } catch (error) {
            console.error("Erreur lors de la génération Groq:", error);
            statusChats[chatId] = "libre";
        }
    }, 5000); // 5000 millisecondes = 5 secondes
});

// 2. L'ADMIN RÉPOND DEPUIS TERMUX (OU MANUELLEMENT / VIA /ia)
app.post('/repondre-humain', async (req, res) => {
    const { username, chatId, reponse, admin, forceIa } = req.body;

    const targetChatId = chatId || Object.keys(discussions).find(id => discussions[id].username === username);

    if (!targetChatId || !discussions[targetChatId]) {
        return res.status(404).json({ error: "Discussion introuvable." });
    }

    // ANNULATION DU CHRONO : L'humain est intervenu !
    if (pendingTimers[targetChatId]) {
        clearTimeout(pendingTimers[targetChatId]);
        delete pendingTimers[targetChatId];
        console.log(`🛑 Timer Groq annulé : L'admin (${admin}) est intervenu.`);
    }

    const chat = discussions[targetChatId];

    // Si tu as tapé la commande '/ia' dans Termux
    if (forceIa) {
        statusChats[targetChatId] = "Nexus IA réfléchit...";
        try {
            const completion = await groq.chat.completions.create({
                messages: [
                    { role: "system", content: "Tu es Nexus IA. Réponds de façon précise." },
                    ...chat.messages.map(m => ({
                        role: (m.sender === chat.username) ? "user" : "assistant",
                        content: m.text
                    }))
                ],
                model: "llama-3.3-70b-versatile"
            });

            const reponseIA = completion.choices[0]?.message?.content || "Erreur IA.";
            chat.messages.push({ sender: "Nexus IA (Groq)", text: reponseIA, timestamp: new Date() });
            statusChats[targetChatId] = "libre";
            return res.json({ status: "success", mode: "force_ia", reponse: reponseIA });
        } catch (err) {
            statusChats[targetChatId] = "libre";
            return res.status(500).json({ error: "Erreur Groq forcée" });
        }
    }

    // Réponse humaine normale tapée dans le panneau
    chat.messages.push({ sender: admin || "Nexus ia", text: reponse, timestamp: new Date() });
    statusChats[targetChatId] = "libre";

    res.json({ status: "success", mode: "humain" });
});

// 3. RÉCUPÉRATION DES QUESTIONS NON RÉPONDUES (Pour l'interface mobile ai_gui.py)
app.get('/recuperer-questions', (req, res) => {
    const questions = [];
    for (const cid in discussions) {
        const d = discussions[cid];
        const lastMsg = d.messages[d.messages.length - 1];
        if (lastMsg && lastMsg.sender !== "Nexus ia" && !lastMsg.sender.includes("Groq")) {
            questions.push({
                chatId: cid,
                username: d.username,
                message: lastMsg.text
            });
        }
    }
    res.json({ questions });
});

// 4. HISTORIQUE D'UN CHAT SPÉCIFIQUE
app.get('/chats/:username', (req, res) => {
    const username = req.params.username;
    const match = Object.values(discussions).filter(d => d.username.toLowerCase() === username.toLowerCase());
    res.json({ chats: match });
});

// 5. STATUT DU CHAT EN TEMPS RÉEL (Pour afficher "Nexus IA réfléchit..." sur le web)
app.get('/statut-chat/:chatId', (req, res) => {
    const statut = statusChats[req.params.chatId] || "libre";
    res.json({ status: statut });
});

// =========================================================================
// 🚀 DÉMARRAGE DU SERVEUR
// =========================================================================
const PORT = process.env.PORT || 3000;
app.listen(PORT, () => {
    console.log(`=============================================`);
    console.log(`🚀 Serveur Nexus IA démarré sur le port ${PORT}`);
    console.log(`🔔 Notifications Push configurées sur : ntfy.sh/${NTFY_TOPIC}`);
    console.log(`=============================================`);
});
