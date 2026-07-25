import tkinter as tk
from tkinter import ttk, messagebox, scrolledtext
import requests
import threading
import time
from datetime import datetime

# =========================================================================
# ⚙️ CONFIGURATION (Remplace par l'URL exacte de ton serveur Render)
# =========================================================================
SERVER_URL = "https://mon-serveur-chat.onrender.com"  
ADMIN_NAME = "Nexus ia"

# =========================================================================
# 🎨 THÈME ET COULEURS
# =========================================================================
BG_MAIN = "#0f172a"
BG_SIDEBAR = "#1e293b"
ACCENT_COLOR = "#6366f1"
TEXT_COLOR = "#f1f5f9"
COLOR_USER = "#38bdf8"
COLOR_IA = "#fbbf24"
COLOR_ADMIN = "#a855f7"

class NexusAdminPanel(tk.Tk):
    def __init__(self):
        super().__init__()
        self.title("NEXUS IA - PANNEAU D'ADMINISTRATION")
        self.geometry("1100x750")
        self.configure(bg=BG_MAIN)

        self.chat_actuel = None
        self.questions_cache = []
        self.server_online = False

        self.creer_interface()
        self.demarrer_threads()

    def creer_interface(self):
        # Header
        self.header_frame = tk.Frame(self, bg=BG_SIDEBAR, height=50)
        self.header_frame.pack(side=tk.TOP, fill=tk.X)

        self.lbl_status = tk.Label(
            self.header_frame, text="● SERVEUR : VERIFICATION...", 
            fg="#f59e0b", bg=BG_SIDEBAR, font=("Arial", 10, "bold")
        )
        self.lbl_status.pack(side=tk.LEFT, padx=20)

        self.lbl_stats = tk.Label(
            self.header_frame, text="Discussions actives : 0", 
            fg=TEXT_COLOR, bg=BG_SIDEBAR, font=("Arial", 10)
        )
        self.lbl_stats.pack(side=tk.RIGHT, padx=20)

        # Conteneur principal
        self.main_container = tk.PanedWindow(self, orient=tk.HORIZONTAL, bg=BG_MAIN, bd=0, sashwidth=4)
        self.main_container.pack(fill=tk.BOTH, expand=True)

        # Sidebar
        self.sidebar = tk.Frame(self.main_container, bg=BG_SIDEBAR, width=280)
        self.main_container.add(self.sidebar)

        tk.Label(
            self.sidebar, text="CONVERSATIONS", 
            fg=ACCENT_COLOR, bg=BG_SIDEBAR, font=("Arial", 11, "bold"), pady=12
        ).pack()

        self.listbox_chats = tk.Listbox(
            self.sidebar, bg=BG_SIDEBAR, fg=TEXT_COLOR, font=("Arial", 10),
            selectbackground=ACCENT_COLOR, bd=0, highlightthickness=0
        )
        self.listbox_chats.pack(fill=tk.BOTH, expand=True, padx=8, pady=5)
        self.listbox_chats.bind("<<ListboxSelect>>", self.sur_selection_chat)

        # Zone Chat
        self.chat_frame = tk.Frame(self.main_container, bg=BG_MAIN)
        self.main_container.add(self.chat_frame)

        self.chat_header = tk.Frame(self.chat_frame, bg=BG_MAIN)
        self.chat_header.pack(fill=tk.X, padx=15, pady=10)

        self.lbl_chat_user = tk.Label(
            self.chat_header, text="Sélectionnez une discussion à gauche...", 
            fg=TEXT_COLOR, bg=BG_MAIN, font=("Arial", 13, "bold")
        )
        self.lbl_chat_user.pack(side=tk.LEFT)

        btn_delete = tk.Button(
            self.chat_header, text="Supprimer le Chat", 
            bg="#ef4444", fg="white", bd=0, padx=10, pady=5,
            command=self.supprimer_chat_actuel
        )
        btn_delete.pack(side=tk.RIGHT)

        self.chat_display = scrolledtext.ScrolledText(
            self.chat_frame, bg="#0f172a", fg=TEXT_COLOR, font=("Segoe UI", 11),
            state='disabled', wrap=tk.WORD, bd=0, padx=15, pady=15
        )
        self.chat_display.pack(fill=tk.BOTH, expand=True, padx=15)

        self.input_container = tk.Frame(self.chat_frame, bg=BG_MAIN, pady=10)
        self.input_container.pack(fill=tk.X, padx=15)

        self.entry_msg = tk.Entry(
            self.input_container, bg="#1e293b", fg=TEXT_COLOR, 
            font=("Arial", 11), bd=0, insertbackground="white"
        )
        self.entry_msg.pack(side=tk.LEFT, fill=tk.X, expand=True, padx=(0, 10), ipady=8)
        self.entry_msg.bind("<Return>", lambda e: self.envoyer_reponse())

        self.btn_send = tk.Button(
            self.input_container, text="RÉPONDRE", bg=ACCENT_COLOR, fg="white", 
            font=("Arial", 10, "bold"), bd=0, padx=15, pady=8, command=self.envoyer_reponse
        )
        self.btn_send.pack(side=tk.LEFT, padx=3)

        self.btn_force_ia = tk.Button(
            self.input_container, text="🤖 /IA", bg=COLOR_IA, fg="black", 
            font=("Arial", 10, "bold"), bd=0, padx=15, pady=8, command=self.forcer_ia
        )
        self.btn_force_ia.pack(side=tk.LEFT, padx=3)

        # Logs
        self.log_frame = tk.Frame(self, bg="#000", height=90)
        self.log_frame.pack(side=tk.BOTTOM, fill=tk.X)
        
        self.txt_logs = tk.Text(
            self.log_frame, bg="#000", fg="#4ade80", 
            font=("Consolas", 8), height=4, state='disabled'
        )
        self.txt_logs.pack(fill=tk.BOTH, expand=True)

    def ajouter_log(self, text):
        timestamp = datetime.now().strftime("%H:%M:%S")
        self.txt_logs.config(state='normal')
        self.txt_logs.insert(tk.END, f"[{timestamp}] {text}\n")
        self.txt_logs.config(state='disabled')
        self.txt_logs.see(tk.END)

    def recuperer_donnees_serveur(self):
        while True:
            try:
                res = requests.get(f"{SERVER_URL}/recuperer-questions", timeout=4)
                if res.status_code == 200:
                    self.server_online = True
                    self.questions_cache = res.json().get("questions", [])
                    self.mettre_a_jour_interface(True)
                else:
                    self.server_online = False
                    self.mettre_a_jour_interface(False)
            except Exception:
                self.server_online = False
                self.mettre_a_jour_interface(False)
            time.sleep(2)

    def mettre_a_jour_interface(self, en_ligne):
        if en_ligne:
            self.lbl_status.config(text="● SERVEUR : EN LIGNE", fg="#10b981")
            self.lbl_stats.config(text=f"Discussions actives : {len(self.questions_cache)}")
        else:
            self.lbl_status.config(text="● SERVEUR : DECONNECTE", fg="#ef4444")

        selection_courante = self.listbox_chats.curselection()
        self.listbox_chats.delete(0, tk.END)
        for q in self.questions_cache:
            prefix = "🎙️ " if q.get("audio") else "✉️ "
            self.listbox_chats.insert(tk.END, f"{prefix} {q['username']}")
        
        if selection_courante:
            try:
                self.listbox_chats.selection_set(selection_courante)
            except Exception:
                pass

    def sur_selection_chat(self, event):
        selection = self.listbox_chats.curselection()
        if not selection: 
            return
        
        chat_data = self.questions_cache[selection[0]]
        self.chat_actuel = chat_data["chatId"]
        self.lbl_chat_user.config(text=f"Conversation avec : {chat_data['username']}")
        self.charger_historique(chat_data['username'])

    def charger_historique(self, username):
        try:
            res = requests.get(f"{SERVER_URL}/chats/{username}", timeout=3)
            if res.status_code == 200:
                chats = res.json().get("chats", [])
                self.chat_display.config(state='normal')
                self.chat_display.delete("1.0", tk.END)

                for chat in chats:
                    for m in chat.get("messages", []):
                        sender = m.get("sender", "Inconnu")
                        text = m.get("text", "")
                        
                        tag = "user"
                        if sender == ADMIN_NAME:
                            tag = "admin"
                        elif "Groq" in sender or "IA" in sender:
                            tag = "ia"

                        self.chat_display.insert(tk.END, f"{sender} : ", tag)
                        self.chat_display.insert(tk.END, f"{text}\n\n")
                
                self.chat_display.tag_config("admin", foreground=COLOR_ADMIN, font=("Arial", 11, "bold"))
                self.chat_display.tag_config("ia", foreground=COLOR_IA, font=("Arial", 11, "bold"))
                self.chat_display.tag_config("user", foreground=COLOR_USER, font=("Arial", 11, "bold"))

                self.chat_display.config(state='disabled')
                self.chat_display.see(tk.END)
        except Exception as e:
            self.ajouter_log(f"Erreur chargement : {e}")

    def envoyer_reponse(self):
        msg = self.entry_msg.get().strip()
        if not msg or not self.chat_actuel: 
            return

        try:
            requests.post(f"{SERVER_URL}/repondre-humain", json={
                "chatId": self.chat_actuel,
                "reponse": msg,
                "admin": ADMIN_NAME
            }, timeout=4)
            
            self.ajouter_log(f"Message envoyé")
            self.entry_msg.delete(0, tk.END)
            
            if ":" in self.lbl_chat_user.cget("text"):
                username = self.lbl_chat_user.cget("text").split(": ")[1]
                self.charger_historique(username)
        except Exception as e:
            messagebox.showerror("Erreur", f"Erreur d'envoi : {e}")

    def forcer_ia(self):
        if not self.chat_actuel: 
            return
        try:
            self.ajouter_log("Demande de reponse IA...")
            requests.post(f"{SERVER_URL}/repondre-humain", json={
                "chatId": self.chat_actuel,
                "forceIa": True
            }, timeout=4)
        except Exception as e:
            self.ajouter_log(f"Erreur IA : {e}")

    def supprimer_chat_actuel(self):
        if not self.chat_actuel: 
            return
        if messagebox.askyesno("Confirmation", "Supprimer cette conversation ?"):
            try:
                requests.delete(f"{SERVER_URL}/supprimer-chat/{self.chat_actuel}", timeout=4)
                self.chat_actuel = None
                self.lbl_chat_user.config(text="Sélectionnez une discussion à gauche...")
                self.chat_display.config(state='normal')
                self.chat_display.delete("1.0", tk.END)
                self.chat_display.config(state='disabled')
                self.ajouter_log("Discussion supprimée.")
            except Exception as e:
                self.ajouter_log(f"Erreur suppression : {e}")

    def demarrer_threads(self):
        t = threading.Thread(target=self.recuperer_donnees_serveur, daemon=True)
        t.start()
        self.ajouter_log("Panneau initialisé.")

if __name__ == "__main__":
    app = NexusAdminPanel()
    app.mainloop()
