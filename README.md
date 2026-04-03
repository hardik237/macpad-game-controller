# MacPad: Web-to-HID Gamepad Bridge

MacPad turns your iPhone into a virtual, ultra-low-latency game controller for your Mac using a React frontend served via Docker and a lightweight native Python bridge.

## Setup Instructions

1. Ensure [Docker Desktop](https://www.docker.com/products/docker-desktop/) or OrbStack is installed and running on your Mac.
2. Ensure you are connected to the same Wi-Fi network on both your Mac and your iPhone.
3. Run the one-click startup script:

   ```bash
   ./start.sh
   ```

4. The script will output an IP address (e.g., `http://192.168.1.5:8080`). Open this exact URL in your iPhone's Safari browser.
5. Depending on your macOS version, the first time you run this, macOS may block the Python process from simulating keystrokes.
    - Go to **System Settings > Privacy & Security > Accessibility**
    - Ensure your Terminal (or IDE) is toggled ON to allow simulating keystrokes.

## How to Configure Afterplay.io

Once you load your saved game in Afterplay in your Mac's browser, you must map the buttons so the emulator understands the mobile key presses.

1. In Afterplay, open the game menu.
2. Click **Controls**.
3. Under the control map, set the following keys:
    - **D-PAD Up:** Arrow Up
    - **D-PAD Down:** Arrow Down
    - **D-PAD Left:** Arrow Left
    - **D-PAD Right:** Arrow Right
    - **A Button:** `Z`
    - **B Button:** `X`
    - **Start:** `Enter` / `Return`
    - **Select:** `Shift`

That's it! Tap the buttons on your iPhone and enjoy gaming.
