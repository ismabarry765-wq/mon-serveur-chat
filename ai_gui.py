import tkinter as tk
from tkinter import scrolledtext
import socketio
import threading
from groq import Groq

sio = socketio.Client()
CONV_ID = 'conv-1'

class IAOperatorGUI:
    def __init__(self, root):
        self.root = root
        self.root.title("Console IA Studio - Opérateur")
        self.root.geometry("520x680")
        self.root.configure(bg="#181825")

        self.typing_timer = None

        header_frame = tk.Frame(root, bg="#1e1e2e")
        header_frame.pack(fill=tk.X, ipadx=10, ipady=5)
        header = tk.Label(header_frame, text="⚡ Console Opérateur IA", font=("Segoe UI", 13, "bold"), bg="#1e1e2e", fg="#cdd6f4")
        header.pack(side=tk.LEFT, padx=10, pady=5)

        api_frame = tk.Frame(root, bg="#181825")
        api_frame.pack(fill=tk.X, padx=15, pady=(10, 5))
        
        api_label = tk.Label(api_frame, text="Clé API Groq :", font=("Segoe UI", 9), bg="#181825", fg="#a6adc8")
        api_label.pack(side=tk.LEFT)
        
        self.api_entry = tk.Entry(api_frame, bg="#313244", fg="#a6e3a1", font=("Consolas", 9), show="*", insertbackground="white", borderwidth=0)
        self.api_entry.pack(side=tk.LEFT, fill=tk.X, expand=True, padx=8)

        self.chat_display = scrolledtext.ScrolledText(root, wrap=tk.WORD, bg="#1e1e2e", fg="#cdd6f4", font=("Segoe UI", 10), state='disabled', borderwidth=0)
        self.chat_display.pack(padx=15, pady=10, fill=tk.BOTH, expand=True)

        self.status_label = tk.Label(root, text="Prêt.", font=("Segoe UI", 9, "italic"), bg="#181825", fg="#a6adc8")
        self.status_label.pack(anchor="w", padx=15)

        input_frame = tk.Frame(root, bg="#181825")
        input_frame.pack(fill=tk.X, padx=15, pady=(5, 15))

        self.msg_entry = tk.Entry(input_frame, bg="#313244", fg="#cdd6f4", font=("Segoe UI", 11), insertbackground="white", borderwidth=0)
        self.msg_entry.pack(side=tk.LEFT, fill=tk.X, expand=True, padx=(0, 8), ipady=6)
        
        # Événement quand l'opérateur tape du texte
        self.msg_entry.bind("<Key>", self.on_typing)
        self.msg_entry.bind("<Return>", lambda event: self.process_and_send())

        send_btn = tk.Button(input_frame, text="Envoyer", command=self.process_and_send, bg="#89b4fa", fg="#11111b", font=("Segoe UI", 10, "bold"), activebackground="#b4befe", borderwidth=0, cursor="hand2")
        send_btn.pack(side=tk.RIGHT, ipadx=10, ipady=4)

        threading.Thread(target=self.connect_socket, daemon=True).start()

    def on_typing(self, event):
        if sio.connected:
            sio.emit('typing', {'sender': 'assistant'})
            if self.typing_timer:
                self.root.after_cancel(self.typing_timer)
            self.typing_timer = self.root.after(1000, self.stop_typing)

    def stop_typing(self):
        if sio.connected:
            sio.emit('stop-typing', {'sender': 'assistant'})

    def log(self, text, prefix=""):
        self.chat_display.config(state='normal')
        if prefix:
            self.chat_display.insert(tk.END, prefix + "\n", "bold")
        self.chat_display.insert(tk.END, text + "\n\n")
        self.chat_display.config(state='disabled')
        self.chat_display.yview(tk.END)

    def connect_socket(self):
        @sio.event
        def connect():
            self.log("Connecté au serveur avec succès.", "🟢 Système")

        @sio.on('new-message')
        def on_message(data):
            msg = data.get('message', {})
            sender = msg.get('sender')
            text = msg.get('text', '')
            
            if sender == 'user':
                self.log(text, "📩 Utilisateur :")
                self.status_label.config(text="Prêt.", fg="#a6adc8")

        @sio.on('user-typing')
        def on_user_typing(data):
            if data.get('sender') == 'user':
                self.status_label.config(text="✏️ L'utilisateur est en train d'écrire...", fg="#f9e2af")

        @sio.on('user-stop-typing')
        def on_user_stop_typing(data):
            if data.get('sender') == 'user':
                self.status_label.config(text="Prêt.", fg="#a6adc8")

        try:
            sio.connect('http://localhost:3000')
            sio.wait()
        except Exception as e:
            self.log(f"Erreur de connexion : {e}", "🔴 Erreur")

    def correct_spelling(self, text, api_key):
        try:
            client = Groq(api_key=api_key)
            prompt = f"Maintiens exactement le sens et le ton, mais corrige toutes les fautes d'orthographe et de grammaire du texte suivant. Ne réponds rien d'autre que le texte corrigé :\n\n{text}"
            
            completion = client.chat.completions.create(
                model="llama-3.3-70b-versatile",
                messages=[{"role": "user", "content": prompt}],
                temperature=0.2
            )
            return completion.choices[0].message.content.strip()
        except Exception as e:
            self.status_label.config(text=f"Erreur Groq: {e}", fg="#f38ba8")
            return text

    def process_and_send(self):
        self.stop_typing()
        raw_text = self.msg_entry.get().strip()
        api_key = self.api_entry.get().strip()

        if not raw_text:
            return

        final_text = raw_text

        if api_key:
            self.status_label.config(text="✨ Correction par Groq en cours...", fg="#f9e2af")
            self.root.update_idletasks()
            final_text = self.correct_spelling(raw_text, api_key)
            self.status_label.config(text="✅ Message corrigé et envoyé !", fg="#a6e3a1")
        else:
            self.status_label.config(text="⚠️ Envoyé sans correction", fg="#fab387")

        sio.emit('send-message', {
            'convId': CONV_ID,
            'text': final_text,
            'sender': 'assistant'
        })

        self.log(final_text, "🤖 Réponse envoyée (IA) :")
        self.msg_entry.delete(0, tk.END)

if __name__ == "__main__":
    root = tk.Tk()
    app = IAOperatorGUI(root)
    root.mainloop()
