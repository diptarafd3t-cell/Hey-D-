import speech_recognition as sr
import pyttsx3
import google.generativeai as genai
import os

# --- Configuration ---
# On Android/Pydroid, we will use an environment variable or a local config
# For GitHub, we leave this as a placeholder
API_KEY = "YOUR_GEMINI_API_KEY_HERE" 

genai.configure(api_key=API_KEY)
model = genai.GenerativeModel('gemini-1.5-flash')
engine = pyttsx3.init()

def speak(text):
    print(f"Hey D: {text}")
    engine.say(text)
    engine.runAndWait()

def listen():
    r = sr.Recognizer()
    with sr.Microphone() as source:
        print("Listening for 'Hey D'...")
        r.pause_threshold = 1
        audio = r.listen(source)
    try:
        query = r.recognize_google(audio, language='en-us')
        return query.lower()
    except:
        return ""

# --- Main Loop ---
if __name__ == "__main__":
    speak("Hey D is online.")
    while True:
        command = listen()
        if "hey d" in command:
            user_msg = command.replace("hey d", "").strip()
            if user_msg:
                response = model.generate_content(user_msg)
                speak(response.text)
            else:
                speak("I'm listening, what can I do for you?")
