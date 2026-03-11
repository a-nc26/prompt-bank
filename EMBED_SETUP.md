# Prompt Bank — "Within my org" / No "Anyone" access

If you can only deploy Apps Script as **Only myself** or **People within my org** (not "Anyone"), use **embedded mode**: the app and the API are the **same URL**, so there is no CORS and no "Failed to fetch".

## Steps

### 1. Build the single-file app

In the Prompt Bank project folder:

```bash
npm run build:embed
```

This creates **`dist-embed/index.html`** (one file with the whole app inlined).

### 2. Add the app to your Apps Script project

1. Open your **Google Sheet** → **Extensions** → **Apps Script**.
2. **File** → **New** → **HTML file**.
3. Name it **`App`** (replace the default name).
4. Open **`dist-embed/index.html`** on your computer (in an editor or browser).
5. **Select all** (Ctrl/Cmd+A) and **copy**.
6. In the Apps Script editor, **delete** any default content in `App`, then **paste** the full contents of `dist-embed/index.html`.
7. **Save** (Ctrl/Cmd+S).

### 3. Use the updated backend in Apps Script

Make sure the **Code.gs** (or your main script file) is the one from this repo’s **`apps-script/code.gs`**, including the part that serves the app when there is no `action` (so opening the Web App URL returns the HTML app).

### 4. Deploy as Web App

1. **Deploy** → **New deployment** (or **Manage deployments** → edit existing).
2. Type: **Web app**.
3. **Execute as:** Me  
4. **Who has access:** **Only myself** or **People within [your org]**.
5. **Deploy** and copy the **Web app URL** (ends with `/exec`).

### 5. Open the app

Open that Web App URL in your browser. You should see the full Prompt Bank UI.  
All API calls go to the same URL with `?action=...`, so they are same-origin and work with "Within my org" and no "Anyone" access.

No separate script URL or proxy is needed in this mode.
