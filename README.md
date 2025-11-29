<div align="center">
<img width="1200" height="475" alt="GHBanner" src="https://github.com/user-attachments/assets/0aa67016-6eaf-458a-adb2-6e31a0763ed6" />
</div>

# Run and deploy your AI Studio app

This contains everything you need to run your app locally.

View your app in AI Studio: https://ai.studio/apps/drive/1OJbNndmdgaTfdtURWRBo9hMh1_12U3zO

## Run Locally

**Prerequisites:**  Node.js


1. Install dependencies:
   `npm install`
2. Create `.env.local` and set:
   - `GEMINI_API_KEY` = your Gemini API key
   - `VITE_DELETION_WINDOW_MS` = milliseconds allowed to delete a newly created trip (default fallback 60000). Example: `300000` for 5 minutes.
3. Run the app:
   `npm run dev`

### Testing & Restart Workflow

After changing environment variables or dependencies:

```powershell
# Install (or update) deps
npm install

# (Optional) set deletion window for this session (5 min example)
$Env:VITE_DELETION_WINDOW_MS=300000; npm run dev

# Run test suite in a separate terminal
npm run test

# Full rebuild (useful after env changes)
git pull; npm install; npm run build; npm run preview
```

`VITE_DELETION_WINDOW_MS` controls how long (ms) a newly created trip remains deletable.
