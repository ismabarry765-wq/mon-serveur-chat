import tkinter as tk
from tkinter import ttk, messagebox, scrolledtext
import requests
import threading
import time
import os
import webbrowser

# --- CONFIGURATION ---
SERVER_URL = "https://mon-serveur-chat.onrender.com"
ADMIN_NAME = "Nexus IA"

class NexusAdminGroq(tk.Tk):
    def __init__(self):
        super().__init__()
        self.title("Nexus Admin - Centre de Contrôle Groq")
        self.geometry("1100x750")
        self.configure(bg="#ffffff")

        self.chat_actuel = None
        self.questions_cache = []

        self.creer_interface()
        self.demarrer_threads()

    def creer_interface(self):
        # Header / Clé API Groq
        top_bar = tk.Frame(self, bg="#f9fafb", height=50, padx=15, highlightbackground="#e5e7eb", highlightthickness=1)
        top_bar.pack(side=tk.TOP, fill=tk.X)

        self.status_dot = tk.Label(top_bar, text="●", fg="#ef4444", bg="#f9fafb", font=("Arial", 12))
        self.status_dot.pack(side=tk.LEFT)
        
        self.lbl_status = tk.Label(top_bar, text="Hors-ligne", fg="#6b7280", bg="#f9fafb", font=("Segoe UI", 9, "bold"))
        self.lbl_status.pack(side=tk.LEFT, padx=(4, 15))

        tk.Label(top_bar, text="Clé Groq:", fg="#10a37f", bg="#f9fafb", font=("Segoe UI", 9, "bold")).pack(side=tk.LEFT, padx=(10, 2))
        self.ent_groq_key = tk.Entry(top_bar, show="*", bg="#ffffff", fg="#0d0d0d", bd=1, relief="solid", width=25)
        self.ent_groq_key.pack(side=tk.LEFT, padx=5, ipady=3)
        
        btn_save = tk.Button(top_bar, text="Activer Groq", bg="#0d0d0d", fg="white", font=("Segoe UI", 8, "bold"), bd=0, padx=12, command=self.envoyer_cle_groq)
        btn_save.pack(side=tk.LEFT, padx=5)

        # Sidebar Conversations
        self.sidebar = tk.Frame(self, bg="#f9fafb", width=250, highlightbackground="#e5e7eb", highlightthickness=1)
        self.sidebar.pack(side=tk.LEFT, fill=tk.Y)

        tk.Label(self.sidebar, text="Conversations Web", fg="#6b7280", bg="#f9fafb", font=("Segoe UI", 10, "bold"), pady=12, anchor="w", padx=15).pack(fill=tk.X)
        
        self.chat_list = tk.Listbox(self.sidebar, bg="#f9fafb", fg="#0d0d0d", font=("Segoe UI", 10), bd=0, highlightthickness=0, selectbackground="#e5e7eb", selectforeground="#0d0d0d")
        self.chat_list.pack(fill=tk.BOTH, expand=True, padx=8, pady=5)
        self.chat_list.bind("<<ListboxSelect>>", self.on_chat_selected)

        # Zone Chat Principal
        self.chat_area = tk.Frame(self, bg="#ffffff")
        self.chat_area.pack(side=tk.LEFT, fill=tk.BOTH, expand=True)

        self.chat_info = tk.Frame(self.chat_area, bg="#ffffff", pady=10, padx=20, highlightbackground="#e5e7eb", highlightthickness=1)
        self.chat_info.pack(fill=tk.X)
        self.lbl_current_user = tk.Label(self.chat_info, text="Sélectionnez un utilisateur", fg="#0d0d0d", bg="#ffffff", font=("Segoe UI", 12, "bold"))
        self.lbl_current_user.pack(side=tk.LEFT)

        btn_vocal = tk.Button(self.chat_info, text="🎙️ Lancer App Vocal (HTML)", bg="#f59e0b", fg="white", font=("Segoe UI", 9, "bold"), bd=0, padx=10, command=self.ouvrir_app_vocal)
        btn_vocal.pack(side=tk.RIGHT)

        self.txt_display = scrolledtext.ScrolledText(self.chat_area, bg="#ffffff", fg="#0d0d0d", font=("Segoe UI", 10), state='disabled', wrap=tk.WORD, bd=0, padx=20, pady=20)
        self.txt_display.pack(fill=tk.BOTH, expand=True)

        # Zone d'envoi
        input_wrapper = tk.Frame(self.chat_area, bg="#ffffff", pady=15, padx=20)
        input_wrapper.pack(fill=tk.X)

        self.input_box = tk.Frame(input_wrapper, bg="#ffffff", highlightbackground="#e5e7eb", highlightthickness=1, pady=5, padx=10)
        self.input_box.pack(fill=tk.X)

        self.ent_msg = tk.Entry(self.input_box, bg="#ffffff", fg="#0d0d0d", font=("Segoe UI", 11), bd=0)
        self.ent_msg.pack(side=tk.LEFT, fill=tk.X, expand=True, padx=5)
        self.ent_msg.bind("<Return>", lambda e: self.send_message())

        tk.Button(self.input_box, text="Répondre", bg="#0d0d0d", fg="white", font=("Segoe UI", 9, "bold"), bd=0, padx=12, pady=4, command=self.send_message).pack(side=tk.LEFT, padx=2)
        tk.Button(self.input_box, text="🤖 Relancer IA", bg="#10a37f", fg="white", font=("Segoe UI", 9, "bold"), bd=0, padx=10, pady=4, command=self.force_ia).pack(side=tk.LEFT, padx=2)

    def ouvrir_app_vocal(self):
        """ Ouvre le fichier index.html dans le navigateur web """
        dossier_actuel = os.path.dirname(os.path.abspath(__file__))
        chemin_html = os.path.join(dossier_actuel, "index.html")

        if os.path.exists(chemin_html):
            webbrowser.open(f"file://{chemin_html}")
        else:
            messagebox.showerror("Erreur", f"Le fichier index.html est introuvable dans :\n{dossier_actuel}")

    def envoyer_cle_groq(self):
        key = self.ent_groq_key.get().strip()
        if not key: return
        try:
            res = requests.post(f"{SERVER_URL}/set-api-key", json={"apiKey": key}, timeout=5)
            if res.status_code == 200:
                messagebox.showinfo("Succès", "Clé Groq active sur le serveur !")
        except Exception as e:
            messagebox.showerror("Erreur", str(e))

    def check_server(self):
        try:
            res = requests.get(f"{SERVER_URL}/recuperer-questions", timeout=3)
            if res.status_code == 200:
                self.status_dot.config(fg="#10b981")
                self.lbl_status.config(text="En ligne", fg="#10b981")
                self.questions_cache = res.json().get("questions", [])
                self.update_listbox()
        except:
            self.status_dot.config(fg="#ef4444")
            self.lbl_status.config(text="Hors-ligne", fg="#ef4444")

    def update_listbox(self):
        curr = self.chat_list.curselection()
        self.chat_list.delete(0, tk.END)
        for q in self.questions_cache:
            icon = "🎙️" if q.get("audio") else "💬"
            self.chat_list.insert(tk.END, f" {icon}  {q['username']}")
        if curr: self.chat_list.selection_set(curr)

    def on_chat_selected(self, event):
        sel = self.chat_list.curselection()
        if not sel: return
        data = self.questions_cache[sel[0]]
        self.chat_actuel = data["chatId"]
        self.lbl_current_user.config(text=f"Discussion: {data['username']}")
        self.refresh_chat_display(data['username'])

    def refresh_chat_display(self, username):
        try:
            res = requests.get(f"{SERVER_URL}/chats/{username}")
            if res.status_code == 200:
                chats = res.json().get("chats", [])
                self.txt_display.config(state='normal')
                self.txt_display.delete("1.0", tk.END)
                for chat in chats:
                    for m in chat.get("messages", []):
                        sender = m.get("sender")
                        text = m.get("text")
                        self.txt_display.insert(tk.END, f"[{sender}] : {text}\n\n")
                self.txt_display.config(state='disabled')
                self.txt_display.see(tk.END)
        except: pass

    def send_message(self):
        msg = self.ent_msg.get().strip()
        if not msg or not self.chat_actuel: return
        try:
            requests.post(f"{SERVER_URL}/repondre-humain", json={"chatId": self.chat_actuel, "reponse": msg, "admin": ADMIN_NAME})
            self.ent_msg.delete(0, tk.END)
        except Exception as e: messagebox.showerror("Erreur", str(e))

    def force_ia(self):
        if not self.chat_actuel: return
        try:
            requests.post(f"{SERVER_URL}/repondre-humain", json={"chatId": self.chat_actuel, "forceIa": True})
        except Exception as e: messagebox.showerror("Erreur", str(e))

    def demarrer_threads(self):
        def loop():
            while True:
                self.check_server()
                time.sleep(2)
        threading.Thread(target=loop, daemon=True).start()

if __name__ == "__main__":
    app = NexusAdminGroq()
    app.mainloop()
