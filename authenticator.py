from bluetooth import discover_devices
from screen_brightness_control import get_brightness
import customtkinter as Ctk
from sys import platform
from os import path
from pyautogui import size as getres
from datetime import datetime

from requests import post
import hashlib
from cryptography.fernet import Fernet
from base64 import b64decode

authenticating = False
cycle = False

def hashandencrypt(data, key):
    hashed_data = hashlib.sha256(data.encode()).hexdigest()
    key = b64decode(key).decode()
    email = b64decode(key.split('-', 1)[1]).decode()
    str.replace(key, "-"+key, "")
    cipher = Fernet(key.encode())
    encrypted = cipher.encrypt(hashed_data.encode()).decode()
    send(encrypted, email)

def send(data, email):
    captcha = Ctk.CTkToplevel(app)
    captcha.title("CAPTCHA")
    captcha.geometry("300x125")

    def switch(x, y):
        x.configure(text="No")
        y.configure(text="Yes")

    data = {
        "email" : email,
        "password": data
    }

    def fail():
        response = post("http://localhost:3000/auth/authenticate", json=data)
        print("Status Code", response.status_code)
        print("JSON Response ", response.json())

    Ctk.CTkLabel(captcha, 100, 25, text="Are you human?").pack(padx=5, pady=5)

    yes = Ctk.CTkButton(captcha, 100, 25, text="Yes", command=fail)
    yes.pack(padx=5, pady=5)
    yes.bind('<Enter>', lambda x: switch(yes, no))

    no = Ctk.CTkButton(captcha, 100, 25, text="No", command=fail)
    no.pack(padx=5, pady=5)
    no.bind('<Enter>', lambda x: switch(no, yes))

def authenticate():
    global authenticating
    
    if authenticating:
        return
    
    authenticating = True

    # Bluetooth status
    try:
        bluetooth_on = len(discover_devices(5))
        if bluetooth_on > 0:
            bluetooth_on = "On"
        else:
            bluetooth_on = "Off"
    except Exception as e:
        print('Error getting bluetooth status')
    
    # Screen brightness
    brightness = get_brightness()[0]

    # Volume level
    if str.lower(platform) == "darwin":
        from subprocess import run, PIPE
        from re import compile
        cmd = "osascript -e 'get volume settings'"
        process = run(cmd, stdout=PIPE, shell=True)
        output = process.stdout.strip().decode('ascii')

        pattern = compile(r"output volume:(\d+), input volume:(\d+), "
                            r"alert volume:(\d+), output muted:(true|false)")
        volume, _, _, muted = pattern.match(output).groups()

        volume = int(volume)
        muted = (muted == 'true')

        return 0 if muted else volume
    elif str.lower(platform) == 'win32':
        from pycaw.pycaw import AudioUtilities, IAudioEndpointVolume
        devices = AudioUtilities.GetSpeakers()
        interface = devices.Activate(IAudioEndpointVolume._iid_, 1, None)
        volume = interface.QueryInterface(IAudioEndpointVolume)
        volume = round((volume.GetMasterVolumeLevelScalar() * 100))
    elif str.lower(platform) == 'linux':
        try:
            volume = open('/sys/class/sound/card0/volume').read().strip() if path.exists('/sys/class/sound/card0/volume') else "Volume file not found"
        except Exception as e:
            print(str(e))
    
    # Screen Resolution
    width, height = getres()
    screenres = f"{width}x{height}"

    # Time
    now = datetime.now()
    time = now.strftime("%H:%M")

    print(f"{bluetooth_on} {brightness} {volume} {screenres} {time}")

    bt.configure(text=f"Bluetooth: {bluetooth_on}")
    bright.configure(text=f"Brightness: {brightness}")
    vol.configure(text=f"Volume: {volume}")
    res.configure(text=f"Screen Resolution: {screenres}")
    timel.configure(text=f"Time: {time}")

    authenticating = False
    hashandencrypt(f"{bluetooth_on} {brightness} {volume} {screenres}", keyinput.get())

app = Ctk.CTk()
app.title("Sysset Authenticator")
app.geometry("400x300")

button = Ctk.CTkButton(app, 100, 25, text='Retry', command=authenticate)
button.pack(padx=5, pady=5)

keyinput = Ctk.CTkEntry(app, 100, 25, placeholder_text=Fernet.generate_key().decode())
keyinput.pack(padx=5, pady=5)

bt = Ctk.CTkLabel(app, 100, 25, text="Bluetooth: Off")
bt.pack(padx=5, pady=5)

bright = Ctk.CTkLabel(app, 100, 25, text="Brightness: 0")
bright.pack(padx=5, pady=5)

vol = Ctk.CTkLabel(app, 100, 25, text="Volume: 0")
vol.pack(padx=5, pady=5)

res = Ctk.CTkLabel(app, 100, 25, text="Screen Resolution: 0x0")
res.pack(padx=5, pady=5)

timel = Ctk.CTkLabel(app, 100, 25, text="Time: 00:00")
timel.pack(padx=5, pady=5)

if __name__ == "__main__":
    app.mainloop()
