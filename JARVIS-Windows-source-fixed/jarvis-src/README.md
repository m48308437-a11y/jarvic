# JARVIS AI — Windows portable build

This is the repaired source package for the JARVIS desktop assistant.

## Build on Windows 10/11
1. Install Node.js 22 LTS (or newer supported Node.js).
2. Extract this ZIP into a normal folder.
3. Double-click `BUILD-WINDOWS.bat`.
4. When it finishes, the portable executable will be in `dist/`.

Manual commands:
```bash
npm install
npm run dist
```

## Build with GitHub Actions
1. Upload/extract this project into a GitHub repository.
2. Open **Actions** → **Build JARVIS for Windows**.
3. Click **Run workflow** and wait for the run to finish.
4. Download the `JARVIS-Windows-x64` artifact. It contains the `.exe`.

## First launch
Open Settings in JARVIS and enter your OpenAI-compatible API URL, model, and API key. The API key is encrypted with Electron `safeStorage` where the operating system supports it. No API key is bundled in this project.

## Notes
- The renderer files are packaged from `renderer/`; Electron's startup path has been corrected accordingly.
- Conversation history is stored locally in the app's user-data folder using SQLite.
- Speech recognition depends on Windows/Electron support and may not be available on every system.
- The executable produced by this configuration is a portable Windows x64 build and is not code-signed.
