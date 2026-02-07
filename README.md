# QCar Ground Station - Complete Setup Guide

A modern web-based GUI for controlling your QCar fleet in real-time.

---

## 📋 What You Need

1. **Python** (you already have this in your Qcar conda environment)
2. **Node.js** (you need to install this - see below)
3. **Your QCar vehicles** running on the network

---

## 🚀 Complete Setup Instructions

### STEP 1: Install Node.js (One-time setup)

Node.js is required to run the web development tools.

#### For Windows:

1. **Download Node.js:**
   - Go to: https://nodejs.org/
   - Download the **LTS version** (recommended - currently v20.x)
   - Choose the **Windows Installer (.msi)** for your system

2. **Run the installer:**
   - Double-click the downloaded `.msi` file
   - Click "Next" through the setup wizard
   - **Important:** Make sure "Add to PATH" is checked (it is by default)
   - Click "Install"

3. **Verify installation:**
   Open a **new** PowerShell/Command Prompt and run:
   ```bash
   node --version
   ```
   You should see: `v20.x.x` (or similar)

   ```bash
   npm --version
   ```
   You should see: `10.x.x` (or similar)

   ⚠️ **If you get "command not found":**
   - Close and reopen your terminal
   - Or restart your computer
   - The PATH needs to be refreshed

---

### STEP 2: Install Python Dependencies

Open your terminal and activate your Qcar conda environment:

```bash
conda activate Qcar
```

Then install the required Python packages:

```bash
pip install websockets pyyaml
```

**Expected output:**
```
Successfully installed websockets-x.x pyyaml-x.x
```

---

### STEP 3: Install Frontend Dependencies (One-time)

Navigate to the Ground Station folder:

```bash
cd C:\Users\Quang Huy Nugyen\Desktop\PHD_paper\Simulation\QCAR\QCar2_Cran\GroundStation-Qcar-App
```

Install all JavaScript dependencies:

```bash
npm install
```

**This will take 1-2 minutes.** You'll see lots of packages being downloaded.

**Expected output (at the end):**
```
added 200+ packages in 60s
```

⚠️ **You only need to run `npm install` once** (or when dependencies change).

---

## 🎯 Running the Ground Station

You need **TWO terminal windows** open at the same time.

### Terminal 1: Start the WebSocket Bridge

```bash
# Activate conda environment
conda activate Qcar


# Run the bridge (Bridge is a GUI python version)
cd .\Development\multi_vehicle_self_driving_RealQcar\qcar\GUI     
python .\app_main.py
```

**Expected output:**
```
============================================================
 QCar WebSocket Bridge
============================================================
WebSocket server: ws://0.0.0.0:8080
Configured vehicles: 2
  • qcar-00: 192.168.137.102:5000
  • qcar-01: 192.168.137.208:5001
============================================================

[READY] WebSocket Bridge started on ws://localhost:8080
Waiting for browser connections...
```

✅ **Leave this terminal running!**

---

### Terminal 2: Start the Web Interface

Open a **new** terminal window:

```bash
# Navigate to Ground Station folder
cd C:\Users\Quang Huy Nugyen\Desktop\PHD_paper\Simulation\QCAR\QCar2_Cran\GroundStation-Qcar-App

# Start the development server
npm run dev

or 
# For host another device in same Wifi
npm run dev -- --host 
```

**Expected output:**
```
  VITE v6.x.x  ready in 500 ms

  ➜  Local:    http://localhost:3000/
  ➜  Network: use --host to expose
  ➜  press h + enter to show help
```

✅ **Your browser should automatically open to http://localhost:5173**

If not, manually open your browser and go to: **http://localhost:5173**

---

## 🎮 Using the Ground Station

### 1. Connect to the Bridge

In the web interface, look at the **top-right corner**.

Click the **"CONNECT BRIDGE"** button.

**Status indicators:**
- 🔌 **Gray** = Not connected
- 🟡 **Yellow (pulsing)** = Connecting...
- 🟢 **Green** = Connected! ✅

### 2. Control Your QCars

Once connected (green), you can:

- **Start Mission**: Click the green ▶️ Play button
- **Stop Mission**: Click the orange ⏹️ Stop button
- **Emergency Stop**: Click the red "EMERGENCY STOP" button (top-right)
- **Set Speed**: Use the slider (0 - 2.0 m/s)
- **Deploy Path**: Choose a path and click "Deploy Path"

### 3. Monitor Telemetry

The interface shows real-time:
- **Vehicle positions** on the map
- **Speed, battery, steering** for each vehicle
- **System logs** in the right panel

---

## 🛠️ Troubleshooting

### Problem: `npm: command not found`

**Solution:** Node.js is not installed or not in PATH.
1. Install Node.js from https://nodejs.org/
2. Restart your terminal
3. Try again

---

### Problem: "Cannot connect to bridge" (stays gray/yellow)

**Solution:** The Python bridge isn't running.

**Check:**
1. Is Terminal 1 running `websocket_bridge.py`?
2. Do you see "[READY] WebSocket Bridge started"?
3. Try closing and restarting the bridge

---

### Problem: Vehicles show "DISCONNECTED"

**Solution:** QCars aren't reachable on the network.

**Check:**
1. Are your QCars powered on?
2. Are they on the same network as your PC?
3. Check IP addresses in `fleet_config.yaml` match your QCars
4. Try pinging a QCar: `ping 192.168.137.102`

---

### Problem: Bridge shows "Connection refused" for QCars

**Solution:** QCar vehicle software isn't running.

**Check:**
1. SSH into the QCar
2. Start the vehicle control software:
   ```bash
   cd /home/nvidia/Documents/multi_vehicle_RealCar
   python vehicle_main.py --car-id 0
   ```

---

## 📁 Project Structure

```
GroundStation-Qcar-App/
├── App.tsx                    # Main application (React)
├── index.html                 # HTML entry point
├── package.json               # JavaScript dependencies
├── services/
│   ├── websocketBridgeService.ts  # WebSocket client
│   └── mockVehicleService.ts      # Simulation mode
├── components/
│   ├── VehicleCard.tsx        # Individual vehicle display
│   ├── TelemetryMap.tsx       # Map visualization
│   └── StatCard.tsx           # Statistics cards
└── types.ts                   # TypeScript type definitions
```

---

## ⚙️ Configuration

### Change WebSocket Port

Edit `services/websocketBridgeService.ts`:

```typescript
export const BRIDGE_CONFIG = {
  url: 'ws://localhost:8080',  // Change port here
  ...
};
```

### Change Vehicle Configuration

Edit `Development/multi_vehicle_self_driving_RealQcar/fleet_config.yaml`:

```yaml
vehicles:
  - car_id: 0
    ip: 192.168.137.102  # Change QCar IP here
    port: 5000
    enabled: true
```

---

## 🔄 Daily Workflow

After initial setup, you only need:

**Every time you want to use the Ground Station:**

```bash
# Terminal 1: Start bridge
conda activate Qcar
cd Development\multi_vehicle_self_driving_RealQcar\python
python websocket_bridge.py

# Terminal 2: Start frontend
cd GroundStation-Qcar-App
npm run dev
```

**No need to run `npm install` again!**

---

## 📞 Need Help?

- Bridge not starting? Check Python dependencies: `pip install websockets pyyaml`
- Frontend not starting? Make sure Node.js is installed and run `npm install`
- Vehicles not connecting? Verify network and IP addresses in `fleet_config.yaml`
