import tkinter as tk
from tkinter import scrolledtext, messagebox
import requests
import threading
import time

try:
    import speech_recognition as sr
    HAS_SR = True
except ImportError:
    HAS_SR = False

SERVER_URL = "https://mon-serveur-chat.onrender.com"

conversations = {}
utilisateur_actif = None

def ecouter_visiteurs():
    global utilisateur_actif
    while True:
        try:
            res = requests.get(f"{SERVER_URL}/recuperer-questions", timeout=5)
            if res.status_code == 200:
                questions = res.json().get("questions", [])
                for item in questions:
                    u = item.get("username")
                    cid = item.get("chatId")
                    msg = item.get("message")

                    if u not in conversations:
                        conversations[u] = {"chatId": cid, "messages": []}
                        liste_users.insert(tk.END, u)
                    
                    conversations[u]["chatId"] = cid
                    conversations[u]["messages"].append((f"👤 [{u}]", msg))

                    if utilisateur_actif == u:
                        afficher_messages_utilisateur(u)
                    else:
                        lbl_status.config(text=f"💬 Nouveau message de {u} !", fg="#f38ba8")
        except Exception:
            pass
        time.sleep(1)

def selectionner_utilisateur(event):
    global utilisateur_actif
    selection = liste_users.curselection()
    if selection:
        user = liste_users.get(selection[0])
        utilisateur_actif = user
        lbl_status.config(text=f"Discussion avec : {user}", fg="#a6e3a1")
        afficher_messages_utilisateur(user)

def afficher_messages_utilisateur(user):
    zone_chat.config(state=tk.NORMAL)
    zone_chat.delete("1.0", tk.END)
    for auteur, text in conversations[user]["messages"]:
        tag = "user_tag" if "👤" in auteur else "nexus_tag"
        zone_chat.insert(tk.END, f"\n{auteur} :\n", tag)
        zone_chat.insert(tk.END, f" {text}\n", "msg_tag")
    zone_chat.config(state=tk.DISABLED)
    zone_chat.yview(tk.END)

# --- Fonction de Correction Groq ---
def corriger_avec_groq(texte, api_key):
    try:
        headers = {
            "Authorization": f"Bearer {api_key}",
            "Content-Type": "application/json"
        }
        data = {
            "model": "llama-3.1-8b-instant",
            "messages": [
                {"role": "system", "content": "Tu es un correcteur d'orthographe strict en français. Corrige le texte fourni. Réponds EXCLUSIVEMENT avec le texte corrigé, sans aucun commentaire, intro ou guillemets."},
                {"role": "user", "content": texte}
            ]
        }
        r = requests.post("https://api.groq.com/openai/v1/chat/completions", json=data, headers=headers, timeout=5)
        if r.status_code == 200:
            res_text = r.json()["choices"][0]["message"]["content"].strip()
            # Nettoyer d'éventuels guillemets ajoutés par le modèle
            if res_text.startswith('"') and res_text.endswith('"'):
                res_text = res_text[1:-1]
            return res_text
        else:
            print(f"Erreur API Groq Code {r.status_code}: {r.text}")
    except Exception as e:
        print("Erreur de connexion Groq:", e)
    return texte

def valider_et_envoyer():
    global utilisateur_actif
    texte = entree.get().strip()
    api_key = entree_groq.get().strip()

    if not texte or not utilisateur_actif:
        if not utilisateur_actif:
            messagebox.showwarning("Attention", "Sélectionne un utilisateur dans la liste de gauche.")
        return

    if api_key:
        lbl_status.config(text="🔍 Verification Groq...", fg="#f9e2af")
        fenetre.update()
        texte_corrige = corriger_avec_groq(texte, api_key)
        lbl_status.config(text=f"Discussion avec : {utilisateur_actif}", fg="#a6e3a1")

        if texte_corrige.lower() != texte.lower():
            proposer_correction(texte, texte_corrige)
            return

    envoyer_final(texte)

def proposer_correction(original, corrige):
    popup = tk.Toplevel(fenetre)
    popup.title("Correction Groq proposée")
    popup.geometry("420x220")
    popup.configure(bg="#1e1e2e")
    popup.transient(fenetre)
    popup.grab_set()

    tk.Label(popup, text="Groq suggère une correction :", bg="#1e1e2e", fg="#cdd6f4", font=("Segoe UI", 10, "bold")).pack(pady=10)
    
    frame_txt = tk.Frame(popup, bg="#181825", padding=8)
    frame_txt.pack(fill=tk.X, padx=15, pady=5)
    tk.Label(frame_txt, text=f"{corrige}", bg="#181825", fg="#a6e3a1", font=("Segoe UI", 10, "italic"), wraplength=360).pack()

    cadre_btn = tk.Frame(popup, bg="#1e1e2e")
    cadre_btn.pack(pady=15)

    def oui():
        popup.destroy()
        envoyer_final(corrige)

    def non():
        popup.destroy()
        envoyer_final(original)

    tk.Button(cadre_btn, text="Oui (Envoyer la correction)", command=oui, bg="#a6e3a1", fg="#11111b", font=("Segoe UI", 9, "bold"), bd=0, padx=10, pady=5).pack(side=tk.LEFT, padx=10)
    tk.Button(cadre_btn, text="Non (Garder l'original)", command=non, bg="#f38ba8", fg="#11111b", font=("Segoe UI", 9, "bold"), bd=0, padx=10, pady=5).pack(side=tk.RIGHT, padx=10)

def envoyer_final(texte):
    global utilisateur_actif
    cid = conversations[utilisateur_actif]["chatId"]
    conversations[utilisateur_actif]["messages"].append((f"🌐 [Nexus AI -> {utilisateur_actif}]", texte))
    afficher_messages_utilisateur(utilisateur_actif)
    entree.delete(0, tk.END)

    try:
        payload = {"username": utilisateur_actif, "chatId": cid, "reponse": texte}
        requests.post(f"{SERVER_URL}/repondre-humain", json=payload, timeout=5)
    except Exception as e:
        print("Erreur d'envoi :", e)

# --- Saisie Vocale ---
def ecouter_voix():
    if not HAS_SR:
        messagebox.showerror("Erreur", "SpeechRecognition n'est pas installé.")
        return

    def thread_voix():
        r = sr.Recognizer()
        r.energy_threshold = 300
        r.dynamic_energy_threshold = True

        lbl_status.config(text="🎙️ Écoute en cours... Parle maintenant !", fg="#f9e2af")
        try:
            with sr.Microphone() as source:
                r.adjust_for_ambient_noise(source, duration=0.8)
                audio = r.listen(source, timeout=6, phrase_time_limit=10)
                
            lbl_status.config(text="⏳ Traitement de la voix...", fg="#f9e2af")
            texte = r.recognize_google(audio, language="fr-FR")
            
            entree.insert(tk.END, " " + texte if entree.get() else texte)
            lbl_status.config(text=f"Discussion avec : {utilisateur_actif}", fg="#a6e3a1")
        except sr.WaitTimeoutError:
            lbl_status.config(text="⚠️ Aucun son détecté.", fg="#f38ba8")
        except sr.UnknownValueError:
            lbl_status.config(text="❌ Paroles non comprises.", fg="#f38ba8")
        except Exception as e:
            lbl_status.config(text="❌ Erreur micro.", fg="#f38ba8")
            print("Erreur Micro:", e)

    threading.Thread(target=thread_voix, daemon=True).start()

# --- Interface GUI ---
fenetre = tk.Tk()
fenetre.title("⚡ Panneau de Contrôle Multi-Users - Nexus AI")
fenetre.geometry("750x620")
fenetre.configure(bg="#1e1e2e")

# Barre Supérieure (Clé API Groq)
cadre_haut = tk.Frame(fenetre, bg="#181825")
cadre_haut.pack(fill=tk.X, padx=5, pady=5)

tk.Label(cadre_haut, text="🔑 Clé API Groq :", bg="#181825", fg="#cdd6f4", font=("Segoe UI", 9, "bold")).pack(side=tk.LEFT, padx=5)
entree_groq = tk.Entry(cadre_haut, bg="#313244", fg="#cdd6f4", show="*", font=("Segoe UI", 9), bd=0)
entree_groq.pack(side=tk.LEFT, fill=tk.X, expand=True, ipady=4, padx=5)

# Barre Latérale Utilisateurs
cadre_gauche = tk.Frame(fenetre, bg="#181825", width=200)
cadre_gauche.pack(side=tk.LEFT, fill=tk.Y, padx=5, pady=5)

tk.Label(cadre_gauche, text="Utilisateurs", bg="#181825", fg="#cdd6f4", font=("Segoe UI", 11, "bold")).pack(pady=10)
liste_users = tk.Listbox(cadre_gauche, bg="#313244", fg="#cdd6f4", selectbackground="#6366f1", bd=0, font=("Segoe UI", 10))
liste_users.pack(fill=tk.BOTH, expand=True, padx=5, pady=5)
liste_users.bind("<<ListboxSelect>>", selectionner_utilisateur)

# Zone Droite Chat
cadre_droite = tk.Frame(fenetre, bg="#1e1e2e")
cadre_droite.pack(side=tk.RIGHT, fill=tk.BOTH, expand=True, padx=5, pady=5)

lbl_status = tk.Label(cadre_droite, text="Sélectionne un utilisateur à gauche", bg="#1e1e2e", fg="#6c7086", font=("Segoe UI", 10, "bold"))
lbl_status.pack(pady=5)

zone_chat = scrolledtext.ScrolledText(cadre_droite, wrap=tk.WORD, bg="#181825", fg="#cdd6f4", font=("Segoe UI", 10), bd=0)
zone_chat.pack(padx=5, pady=5, fill=tk.BOTH, expand=True)

zone_chat.tag_config("user_tag", foreground="#89b4fa", font=("Segoe UI", 10, "bold"))
zone_chat.tag_config("nexus_tag", foreground="#a6e3a1", font=("Segoe UI", 10, "bold"))
zone_chat.tag_config("msg_tag", foreground="#cdd6f4")
zone_chat.config(state=tk.DISABLED)

# Saisie + Dictée Vocale
cadre_saisie = tk.Frame(cadre_droite, bg="#1e1e2e")
cadre_saisie.pack(fill=tk.X, pady=5)

entree = tk.Entry(cadre_saisie, bg="#313244", fg="#cdd6f4", font=("Segoe UI", 11), bd=0)
entree.pack(side=tk.LEFT, fill=tk.X, expand=True, ipady=8, padx=(0, 5))
entree.bind("<Return>", lambda e: valider_et_envoyer())

btn_mic = tk.Button(cadre_saisie, text="🎙️", command=ecouter_voix, bg="#313244", fg="white", font=("Segoe UI", 11), bd=0, padx=8)
btn_mic.pack(side=tk.LEFT, ipady=4, padx=(0, 5))

btn = tk.Button(cadre_saisie, text="Envoyer ➔", command=valider_et_envoyer, bg="#6366f1", fg="white", font=("Segoe UI", 10, "bold"), bd=0, padx=15)
btn.pack(side=tk.RIGHT, ipady=6)

threading.Thread(target=ecouter_visiteurs, daemon=True).start()
fenetre.mainloop()
