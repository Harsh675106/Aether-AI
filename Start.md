# 🚀 Aether AI - Quick Start Guide

Welcome! Follow these steps to get Aether AI running on your machine.

---

## <span style="color: #FF6B6B">📋 Step 1: Initial Setup & Dependencies</span>

Initialize your Python virtual environment and install all dependencies:

```powershell
cd AetherAI
if (Test-Path .venv) { Remove-Item -Recurse -Force .venv }
python -m venv .venv
.\.venv\Scripts\Activate.ps1
python -m pip install --upgrade pip
python -m pip install -e ".[dev]"
npm install --prefix frontend
```

> ✅ This sets up Python venv, installs backend dependencies, and frontend packages.

---

## <span style="color: #4ECDC4">🧠 Step 2: Pull the AI Model</span>

Download the default Qwen 2.5 7B instruction-tuned model:

```powershell
ollama pull qwen2.5:7b-instruct
```

> ⏳ This may take a few minutes depending on your internet connection (≈5 GB download).

---

## <span style="color: #45B7D1">⚙️ Step 3: Start Ollama Server</span>

Open a **new terminal** and run the Ollama server:

```powershell
# Kill any existing Ollama processes
Get-Process ollama -ErrorAction SilentlyContinue | Stop-Process -Force

# Wait for port to be released
Start-Sleep -Seconds 2

# Start the Ollama server
ollama serve
```

> 🔑 Keep this terminal open—Ollama must be running for the backend to work.
> 
> ✓ You'll see: `Listening on 127.0.0.1:11434`

---

## <span style="color: #95E1D3">🖥️ Step 4: Start the Backend Server</span>

Open a **third terminal**, navigate to the backend, and start the API:

```powershell
cd backend
..\.venv\Scripts\Activate.ps1
uvicorn app.main:create_app --factory --host 127.0.0.1 --port 8001
```

> 🔑 Keep this terminal open as well.
> 
> ✓ You'll see: `Uvicorn running on http://127.0.0.1:8001`

---

## <span style="color: #FFE66D">🎨 Step 5: Start the Frontend Dev Server</span>

Open a **fourth terminal** and start the frontend:

```powershell
cd frontend
npm run dev
```

> 🌐 This will launch the browser dev server with hot reload.
> 
> ✓ You'll see a local URL like `http://localhost:5173`

---

## <span style="color: #A8D8FF">🖥️ (Optional) Desktop App Mode</span>

If you want to run as a native desktop app instead of browser:

```powershell
cd frontend
npm run tauri:dev
```

> 🎯 This launches the Tauri desktop wrapper with hot reload.

---

## ✨ You're Done!

All systems running:
- ✅ Ollama server (port 11434)
- ✅ FastAPI backend (port 8001)
- ✅ Frontend dev server (port 5173)

Open your browser and navigate to the frontend URL. Enjoy Aether AI!