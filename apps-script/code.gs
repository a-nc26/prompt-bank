/**
 * PROMPT BANK BACKEND
 *
 * For "Within my org" / "Only myself": use EMBEDDED mode (app and API same URL, no CORS).
 * 1. Create a Google Sheet. 2. Extensions > Apps Script. 3. Paste this code. Save.
 * 4. File > New > HTML. Name it "App". Paste the contents of dist-embed/index.html (from npm run build:embed). Save.
 * 5. Deploy > New Deployment > Web App. Who has access: "Only myself" or "Within my org".
 * 6. Open the Web App URL in your browser — you get the full app; API calls are same-origin, so no CORS.
 */

const SHEET_NAME = 'Prompts';

function doGet(e) {
  const params = (e && e.parameter) || {};
  const action = params.action;

  try {
    if (!action) {
      try {
        var html = HtmlService.createHtmlOutputFromFile('App').getContent();
        var scriptUrl = ScriptApp.getService().getUrl();
        html = html.replace(/__INJECT_SCRIPT_URL__/g, scriptUrl);
        return HtmlService.createHtmlOutput(html).setTitle('Prompt Bank');
      } catch (err) {
        return jsonResponse({ status: 'ok', message: 'Add HTML file "App" (contents of dist-embed/index.html from npm run build:embed) for embedded app. Use ?action=ping to test.' });
      }
    }
    return jsonResponse(handleAction(action, params));
  } catch (err) {
    return jsonResponse({ error: String(err) }, 500);
  }
}

function doPost(e) {
  try {
    const data = JSON.parse((e && e.postData && e.postData.contents) || '{}');
    return jsonResponse(handleAction(data.action, data));
  } catch (err) {
    return jsonResponse({ error: err.toString() }, 500);
  }
}

/**
 * Embedded bridge for HTMLService (google.script.run.apiAction(...)).
 * Returns plain objects/arrays (not ContentService output).
 */
function apiAction(action, payload) {
  return handleAction(action, payload || {});
}

function handleAction(action, payload) {
  if (action === 'ping') {
    return { status: 'ok', message: 'pong' };
  }

  if (action === 'getAll') {
    const ss = SpreadsheetApp.getActiveSpreadsheet();
    if (!ss) return { error: 'No spreadsheet. Create the script from a Google Sheet: Extensions > Apps Script.' };
    return getAllPrompts();
  }

  if (action === 'search') {
    const query = payload.query || '';
    return searchLocalPrompts(query);
  }

  if (action === 'addPrompts') {
    const count = addPromptsToSheet(payload.prompts || []);
    return { success: true, count: count };
  }

  if (action === 'updateRating') {
    updatePromptRating(payload.id, payload.rating);
    return { success: true };
  }

  if (action === 'deletePrompt') {
    deletePromptFromSheet(payload.id);
    return { success: true };
  }

  if (action === 'classify') {
    // Placeholder for AI classification logic
    // In a real app, you would fetch OpenAI here using UrlFetchApp
    return { success: true, message: 'Classification logic not yet implemented' };
  }

  return { error: 'Unknown action' };
}

// --- Logic Implementation ---

function getOrCreateSheet() {
  const ss = SpreadsheetApp.getActiveSpreadsheet();
  let sheet = ss.getSheetByName(SHEET_NAME);
  if (!sheet) {
    sheet = ss.insertSheet(SHEET_NAME);
    sheet.appendRow(['id', 'text', 'category', 'abuseArea', 'rating', 'turnType', 'score', 'conversation', 'createdAt']);
    sheet.getRange(1, 1, 1, 9).setFontWeight('bold').setBackground('#f3f4f6');
    sheet.setFrozenRows(1);
  }
  return sheet;
}

function getAllPrompts() {
  const sheet = getOrCreateSheet();
  const data = sheet.getDataRange().getValues();
  if (data.length <= 1) return [];
  
  const headers = data[0];
  return data.slice(1).map(row => {
    let obj = {};
    headers.forEach((h, i) => obj[h] = row[i]);
    return obj;
  });
}

function addPromptsToSheet(prompts) {
  const sheet = getOrCreateSheet();
  const rows = prompts.map(p => [
    p.id || Utilities.getUuid(),
    p.text || '',
    p.category || 'Trust & Safety',
    p.abuseArea || '',
    p.rating || 'safe',
    p.turnType || 'single-turn',
    p.score || 0,
    typeof p.conversation === 'object' ? JSON.stringify(p.conversation) : (p.conversation || ''),
    p.createdAt || new Date().toISOString()
  ]);
  
  const startRow = sheet.getLastRow() + 1;
  if (rows.length > 0) {
    sheet.getRange(startRow, 1, rows.length, 9).setValues(rows);
  }
  return rows.length;
}

function updatePromptRating(id, rating) {
  const sheet = getOrCreateSheet();
  const data = sheet.getDataRange().getValues();
  for (let i = 1; i < data.length; i++) {
    if (data[i][0] == id) {
      sheet.getRange(i + 1, 5).setValue(rating);
      return;
    }
  }
}

function deletePromptFromSheet(id) {
  const sheet = getOrCreateSheet();
  const data = sheet.getDataRange().getValues();
  for (let i = 1; i < data.length; i++) {
    if (data[i][0] == id) {
      sheet.deleteRow(i + 1);
      return;
    }
  }
}

function searchLocalPrompts(query) {
  const prompts = getAllPrompts();
  if (!query) return prompts;
  
  const terms = query.toLowerCase().split(/\s+/);
  return prompts.map(p => {
    const content = (p.text + ' ' + p.abuseArea + ' ' + p.category).toLowerCase();
    let score = 0;
    terms.forEach(t => {
      if (content.includes(t)) score += 1;
    });
    return { ...p, similarity: score / terms.length };
  })
  .filter(p => p.similarity > 0)
  .sort((a, b) => b.similarity - a.similarity);
}

function jsonResponse(data, status = 200) {
  return ContentService.createTextOutput(JSON.stringify(data))
    .setMimeType(ContentService.MimeType.JSON);
}
