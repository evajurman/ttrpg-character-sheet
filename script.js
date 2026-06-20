// UNDO LAYERS
const settingsUndoStack = [];

// FONT STUFF
const fontInput = document.getElementById("cfg-font");
const fontDropdown = document.getElementById("fontDropdown");
const items = document.querySelectorAll(".dropdown-item");

// Show dropdown on focus
fontInput.addEventListener("focus", () => {
  fontDropdown.classList.remove("hidden");
});

// Filter items based on input typing
fontInput.addEventListener("input", () => {
  const filter = fontInput.value.toLowerCase();
  let hasMatches = false;

  items.forEach((item) => {
    const text = item.textContent.toLowerCase();
    if (text.includes(filter)) {
      item.style.display = "";
      hasMatches = true;
    } else {
      item.style.display = "none";
    }
  });

  if (hasMatches) {
    fontDropdown.classList.remove("hidden");
  } else {
    fontDropdown.classList.add("hidden");
  }
});

// Select an item
items.forEach((item) => {
  item.addEventListener("click", () => {
    fontInput.value = item.getAttribute("data-font");
    fontInput.style.fontFamily = item.style.fontFamily;
    metaChanged();
    fontDropdown.classList.add("hidden");
  });
});

// Hide dropdown when clicking outside
document.addEventListener("click", (e) => {
  if (!e.target.closest(".font-picker-container")) {
    fontDropdown.classList.add("hidden");
  }
});
// DONE WITH FONT STUFF

let currentConfig = null,
  characterData = {},
  globalTheme = "dark",
  autoSaveTimer = null;
let insertAfterFieldId = null,
  insertDirection = null;
const LS_CONFIG = "ttrpg_current_config",
  LS_CHAR = "ttrpg_current_char",
  LS_SAVED = "ttrpg_saved_configs",
  LS_THEME = "ttrpg_theme";

window.addEventListener("load", () => {
  globalTheme = localStorage.getItem(LS_THEME) || "dark";
  applyTheme(globalTheme);
  const cfg = localStorage.getItem(LS_CONFIG);
  const chr = localStorage.getItem(LS_CHAR);
  if (cfg) {
    try {
      currentConfig = JSON.parse(cfg);
      characterData = chr ? JSON.parse(chr) : {};
      settingsUndoStack.push({ ...currentConfig });
      renderSheet();
      syncEditorToConfig();
      applyConfigTheme(
        currentConfig.theme,
        currentConfig.font,
        currentConfig.fontSize,
      );
    } catch (e) {}
  }
  refreshSavedList();
  document.getElementById("no-config").style.display = currentConfig
    ? "none"
    : "block";
  document.getElementById("sheet-grid").style.display = currentConfig
    ? "grid"
    : "none";
});

// ── THEME ──
function applyTheme(t) {
  globalTheme = t;
  document.body.setAttribute("data-theme", t);
  document.getElementById("theme-btn").textContent =
    t === "dark" ? "☀️ Light" : "🌙 Dark";
  localStorage.setItem(LS_THEME, t);
  if (currentConfig?.theme) {
    applyConfigTheme(
      currentConfig.theme,
      currentConfig.font,
      currentConfig.fontSize,
    );
  }
}
function toggleLog() {
  if (document.getElementById("log-sheet").classList.contains("hidden")) {
    document.getElementById("character-sheet").classList.add("show-log");
    document
      .getElementById("character-sheet")
      .classList.remove("hide-log");
    document.getElementById("log-sheet").classList.remove("hidden");
  } else {
    document.getElementById("character-sheet").classList.add("hide-log");
    document
      .getElementById("character-sheet")
      .classList.remove("show-log");
    document.getElementById("log-sheet").classList.add("hidden");
  }
}
function toggleTheme() {
  applyTheme(globalTheme === "dark" ? "light" : "dark");
}
function applyConfigTheme(theme, font, fontSize) {
  const key = globalTheme === "dark" ? "dark" : "light",
    colors = theme[key] || {},
    root = document.documentElement;
  if (!theme || !theme[key]) {
    console.warn(`No theme config for ${key}`);
    return;
  }
  const map = {
    bg: "--bg",
    bg2: "--bg2",
    bg3: "--bg3",
    text: "--text",
    text2: "--text2",
    text3: "--text3",
    accent: "--accent",
    accent2: "--accent2",
    border: "--border",
    border2: "--border2",
    card: "--card",
    inputBg: "--input-bg",
    font: "--font",
    fontSize: "--font-size",
    fieldLabel: "--field-label",
    fieldInput: "--field-input",
  };
  for (const [k, v] of Object.entries(map)) {
    if (colors[k]) {
      root.style.setProperty(v, colors[k]);
    }
  }
  root.style.setProperty("--font", font);
  root.style.setProperty("--font-size", fontSize + "px");

  if (settingsUndoStack.length > 1) {
    document.getElementById("undo").classList.remove("hidden");
  }
  if (settingsUndoStack.length <= 1) {
    document.getElementById("undo").classList.add("hidden");
  }
}
function resetThemeVars() {
  const root = document.documentElement;
  Array.from(root.style).forEach((prop) => {
    if (prop.startsWith("--")) {
      root.style.removeProperty(prop);
    }
  });
}
function undoTheme() {
  settingsUndoStack.pop();
  const lastTheme = settingsUndoStack.pop();
  syncMetaPane(lastTheme);
  applyMetaToConfig();
}

// ── NAV ──
function showPage(name, btn) {
  document
    .querySelectorAll(".page")
    .forEach((p) => p.classList.remove("active"));
  document
    .querySelectorAll(".tab-btn")
    .forEach((b) => b.classList.remove("active"));
  document.getElementById("page-" + name).classList.add("active");
  if (btn) btn.classList.add("active");
  if (name === "io") refreshSavedList();
  if (name === "editor") syncEditorToConfig();
}

// ── SHEET ──
function renderSheet(targetEl, cfg, data) {
  cfg = cfg || currentConfig;
  data = data || characterData;
  const el = targetEl || document.getElementById("sheet-grid");
  if (!cfg || !cfg.fields) {
    el.innerHTML = "";
    return;
  }
  el.style.gridTemplateColumns = `repeat(${cfg.layout?.columns || 4},1fr)`;
  el.style.gap = (cfg.layout?.gap || 10) + "px";
  el.innerHTML = "";
  for (const field of cfg.fields) {
    const cell = document.createElement("div");
    cell.className = "field-cell type-" + field.type;
    const p = field.position || {};
    cell.style.gridColumn = `${p.col || "auto"}/span ${p.colSpan || 1}`;
    cell.style.gridRow = `${p.row || "auto"}/span ${p.rowSpan || 1}`;
    cell.appendChild(makeFieldContent(field, data));
    el.appendChild(cell);
  }
}
function makeFieldContent(field, data) {
  const wrap = document.createDocumentFragment();
  if (field.type === "section") {
    const t = document.createElement("div");
    t.className = "section-title";
    t.textContent = field.label;
    const s = document.createElement("div");
    s.className = "section-subtitle";
    s.textContent = field.subtitle || "";
    wrap.appendChild(t);
    wrap.appendChild(s);
    return wrap;
  }
  const lbl = document.createElement("div");
  lbl.className = "field-label";
  lbl.textContent = field.label;
  wrap.appendChild(lbl);
  const row = document.createElement("div");
  row.className = "field-value-row";
  if (field.type === "action") {
    const val = document.createElement("div");
    val.className = "action-value";
    val.id = "action-" + field.id;
    val.textContent = computeAction(field, data);
    row.appendChild(val);
    if (field.dice) {
      const btn = document.createElement("button");
      btn.className = "dice-btn";
      btn.textContent = "🎲 " + field.dice;
      btn.onclick = () =>
        rollDice(field.dice, field.label, computeAction(field, data));
      row.appendChild(btn);
    }
  } else if (field.type === "die") {
    const inp = document.createElement("input");
    inp.className = "field-input";
    inp.value =
      data[field.id] !== undefined ? data[field.id] : field.default || "";
    inp.placeholder = field.placeholder || "";
    inp.addEventListener("input", (e) => {
      characterData[field.id] = e.target.value;
      updateActions();
      scheduleAutoSave();
    });
    row.appendChild(inp);

    const btn = document.createElement("button");
    btn.className = "dice-btn";
    btn.textContent = "🎲";
    btn.onclick = () =>
      rollDice(
        data[field.id] || "1",
        field.label,
        computeAction(field, data),
      );
    row.appendChild(btn);
  } else {
    const inp = document.createElement(
      field.multiline ? "textarea" : "input",
    );
    inp.className =
      "field-input" +
      (field.type === "text" ? "" : "") +
      (field.multiline ? " textarea" : "");
    if (!field.multiline)
      inp.type =
        field.type === "number" || field.type === "stat"
          ? "number"
          : "text";
    inp.value =
      data[field.id] !== undefined ? data[field.id] : field.default || "";
    inp.placeholder = field.placeholder || "";
    inp.addEventListener("input", (e) => {
      characterData[field.id] = e.target.value;
      updateActions();
      scheduleAutoSave();
    });
    row.appendChild(inp);
    if (
      (field.type === "stat" || field.type === "number") &&
      field.dice
    ) {
      const btn = document.createElement("button");
      btn.className = "dice-btn";
      btn.textContent = "🎲 " + field.dice;
      const fid = field.id;
      const defaultValue = currentConfig.fields.find(
        ({ id }) => id === fid,
      )?.default;
      const statModWithDefault = characterData[fid] || defaultValue;
      btn.onclick = () =>
        rollDice(
          field.dice,
          field.label,
          parseInt(statModWithDefault || 0),
        );
      row.appendChild(btn);
    }
  }
  wrap.appendChild(row);
  return wrap;
}
function computeAction(field, data) {
  const defaultFields = currentConfig.fields.reduce(
    (fields, fieldItem) => {
      return { ...fields, [fieldItem.id]: fieldItem.default };
    },
    {},
  );
  data = { ...defaultFields, ...characterData, ...data };
  if (!field.equation) return "—";
  try {
    let eq = field.equation;
    for (const [k, v] of Object.entries(data))
      eq = eq.replace(
        new RegExp("\\b" + k + "\\b", "g"),
        parseFloat(v) || 0,
      );
    const r = Math.round(Function('"use strict";return(' + eq + ")")());
    return isNaN(r) ? "—" : r;
  } catch (error) {
    return "—";
  }
}
function updateActions() {
  if (!currentConfig) return;
  for (const f of currentConfig.fields) {
    if (f.type === "action") {
      const el = document.getElementById("action-" + f.id);
      if (el) el.textContent = computeAction(f, characterData);
    }
  }
}

// ── CANVAS ──
function renderCanvas() {
  const cfg = currentConfig;
  const canvas = document.getElementById("config-canvas");
  const empty = document.getElementById("canvas-empty");
  if (!cfg || !cfg.fields || cfg.fields.length === 0) {
    canvas.innerHTML = "";
    empty.style.display = "block";
    return;
  }
  empty.style.display = "none";
  const cols = cfg.layout?.columns || 6;
  canvas.style.gridTemplateColumns = `repeat(${cols},1fr)`;
  canvas.style.gap = (cfg.layout?.gap || 8) + "px";
  canvas.innerHTML = "";
  document.getElementById("canvas-version").textContent =
    `${cfg.name || "Untitled"} v${cfg.version || "?"} · ${cols} cols`;

  for (const field of cfg.fields) {
    const cell = document.createElement("div");
    cell.className = "cv-cell type-" + field.type;
    const p = field.position || {};
    cell.style.gridColumn = `${p.col || "auto"}/span ${p.colSpan || 1}`;
    cell.style.gridRow = `${p.row || "auto"}/span ${p.rowSpan || 1}`;

    const lbl = document.createElement("div");
    lbl.className = "cv-label";
    lbl.textContent = field.label;
    const tp = document.createElement("div");
    tp.className = "cv-type";
    tp.textContent =
      field.type +
      (field.dice ? " · 🎲" + field.dice : "") +
      (field.equation ? " · eq" : "");
    const pos = document.createElement("div");
    pos.className = "cv-pos";
    pos.textContent = `col:${p.col || "auto"} row:${p.row || "auto"} span:${p.colSpan || 1}×${p.rowSpan || 1}`;
    cell.appendChild(lbl);
    cell.appendChild(tp);
    cell.appendChild(pos);

    // edit/delete buttons
    const acts = document.createElement("div");
    acts.className = "cv-actions";
    const editBtn = document.createElement("button");
    editBtn.className = "cv-cell-btn";
    editBtn.textContent = "✏️";
    editBtn.title = "Edit";
    editBtn.onclick = () => openEditFieldModal(field.id);
    const delBtn = document.createElement("button");
    delBtn.className = "cv-cell-btn danger";
    delBtn.textContent = "✕";
    delBtn.title = "Delete";
    delBtn.onclick = () => deleteField(field.id);
    acts.appendChild(editBtn);
    acts.appendChild(delBtn);
    cell.appendChild(acts);

    // + RIGHT button
    const addRight = document.createElement("button");
    addRight.className = "add-btn add-btn-right";
    addRight.textContent = "+";
    addRight.title = "Add field to the right (shares column space)";
    addRight.onclick = (e) => {
      e.stopPropagation();
      openAddFieldModal(field.id, "right");
    };
    cell.appendChild(addRight);

    // + BELOW button
    const addBelow = document.createElement("button");
    addBelow.className = "add-btn add-btn-below";
    addBelow.textContent = "+";
    addBelow.title = "Add field below";
    addBelow.onclick = (e) => {
      e.stopPropagation();
      openAddFieldModal(field.id, "below");
    };
    cell.appendChild(addBelow);

    canvas.appendChild(cell);
  }
}

function syncEditorToConfig() {
  renderCanvas();
  syncJsonPane();
  syncMetaPane();
}
function syncJsonPane() {
  document.getElementById("json-textarea").value = currentConfig
    ? JSON.stringify(currentConfig, null, 2)
    : "";
  updateJsonStatus(true);
}
function syncMetaPane(config) {
  if (config) {
    currentConfig = { ...currentConfig, ...config };
  }
  if (!currentConfig) return;
  document.getElementById("cfg-name").value = currentConfig.name || "";
  document.getElementById("cfg-font").value =
    currentConfig.font || "Georgia";
  document.getElementById("cfg-font-size").value =
    currentConfig.fontSize || "20";
  document.getElementById("cfg-version").value =
    currentConfig.version || "1.0";
  document.getElementById("cfg-cols").value =
    currentConfig.layout?.columns || 6;
  document.getElementById("cfg-gap").value =
    currentConfig.layout?.gap || 10;
  document.getElementById("cfg-accent-dark").value =
    currentConfig.theme?.dark?.accent || "#e94560";
  document.getElementById("cfg-accent-light").value =
    currentConfig.theme?.light?.accent || "#c0392b";
  document.getElementById("cfg-bg-dark").value =
    currentConfig.theme?.dark?.bg || "#1a1a2e";
  document.getElementById("cfg-bg-light").value =
    currentConfig.theme?.light?.bg || "#f0f0f5";
  document.getElementById("cfg-card-dark").value =
    currentConfig.theme?.dark?.card || "#1e1e38";
  document.getElementById("cfg-card-light").value =
    currentConfig.theme?.light?.card || "#ffffff";
  document.getElementById("cfg-label-light").value =
    currentConfig.theme?.light?.fieldLabel || "#606070";
  document.getElementById("cfg-label-dark").value =
    currentConfig.theme?.dark?.fieldLabel || "#e0e0e0";
  document.getElementById("cfg-input-light").value =
    currentConfig.theme?.light?.fieldInput || "#1a1a2e";
  document.getElementById("cfg-input-dark").value =
    currentConfig.theme?.dark?.fieldInput || "#e0e0e0";
}

// ── SIDEBAR TABS ──
function showSidebarTab(name, btn) {
  document
    .querySelectorAll(".stab")
    .forEach((b) => b.classList.remove("active"));
  if (btn) btn.classList.add("active");
  document.getElementById("stab-meta").style.display =
    name === "meta" ? "block" : "none";
  document.getElementById("stab-json").style.display =
    name === "json" ? "flex" : "none";
  if (name === "json") syncJsonPane();
}

// ── JSON PANE ──
let jsonEditTimer = null;
function onJsonEdit() {
  updateJsonStatus(false);
  clearTimeout(jsonEditTimer);
  jsonEditTimer = setTimeout(() => {
    try {
      const cfg = JSON.parse(
        document.getElementById("json-textarea").value,
      );
      validateConfig(cfg);
      currentConfig = cfg;
      updateJsonStatus(true);
      renderCanvas();
      renderSheet();
      scheduleAutoSave();
    } catch (e) {
      updateJsonStatus(false, e.message);
    }
  }, 600);
}
function updateJsonStatus(ok, msg) {
  const el = document.getElementById("json-status");
  if (ok) {
    el.textContent = "✓ Valid JSON";
    el.className = "status-ok";
  } else {
    el.textContent = "✗ " + (msg || "Invalid JSON").slice(0, 50);
    el.className = "status-err";
  }
}

// ── META PANE ──
function metaChanged() {
  applyMetaToConfig();
}
function applyMetaToConfig() {
  if (!currentConfig)
    currentConfig = {
      version: "1.0",
      name: "",
      fields: [],
      layout: {},
      theme: { dark: {}, light: {} },
    };
  currentConfig.name =
    document.getElementById("cfg-name").value || "Untitled";
  currentConfig.font =
    document.getElementById("cfg-font").value || "Georgia";
  currentConfig.fontSize =
    document.getElementById("cfg-font-size").value || "14";
  currentConfig.version =
    document.getElementById("cfg-version").value || "1.0";
  currentConfig.layout = {
    columns: parseInt(document.getElementById("cfg-cols").value) || 6,
    gap: parseInt(document.getElementById("cfg-gap").value) || 10,
  };
  currentConfig.theme = {
    dark: {
      accent: document.getElementById("cfg-accent-dark").value,
      bg: document.getElementById("cfg-bg-dark").value,
      card: document.getElementById("cfg-card-dark").value,
      fieldLabel: document.getElementById("cfg-label-dark").value,
      fieldInput: document.getElementById("cfg-input-dark").value,
    },
    light: {
      accent: document.getElementById("cfg-accent-light").value,
      bg: document.getElementById("cfg-bg-light").value,
      card: document.getElementById("cfg-card-light").value,
      fieldLabel: document.getElementById("cfg-label-light").value,
      fieldInput: document.getElementById("cfg-input-light").value,
    },
  };
  settingsUndoStack.push({ ...currentConfig });
  resetThemeVars();
  applyConfigTheme(
    currentConfig.theme,
    currentConfig.font,
    currentConfig.fontSize,
  );
  renderCanvas();
  renderSheet();
  syncJsonPane();
  persistConfig();
  showToast("✓ Settings applied", 1500);
}

// ── FIELD MODALS ──
const FIELD_TYPES = [
  "text",
  "number",
  "stat",
  "die",
  "action",
  "section",
];

function openAddFieldModal(afterId, direction) {
  insertAfterFieldId = afterId;
  insertDirection = direction || null;
  const src = afterId
    ? currentConfig?.fields?.find((f) => f.id === afterId)
    : null;
  buildFieldModal(null, src, direction);
  document.getElementById("modal-title").textContent =
    direction === "right"
      ? "Add Field to the Right"
      : direction === "below"
        ? "Add Field Below"
        : "Add Field";
  document.getElementById("modal-confirm").textContent = "Add Field";
  document.getElementById("modal-confirm").onclick = confirmAddField;
  document.getElementById("modal-overlay").classList.add("show");
}
function openEditFieldModal(id) {
  const field = currentConfig?.fields?.find((f) => f.id === id);
  if (!field) return;
  buildFieldModal(field, null, null);
  document.getElementById("modal-title").textContent = "Edit Field";
  document.getElementById("modal-confirm").textContent = "Save Changes";
  document.getElementById("modal-confirm").onclick = () =>
    confirmEditField(id);
  document.getElementById("modal-overlay").classList.add("show");
}

function buildFieldModal(field, sourceField, direction) {
  const body = document.getElementById("modal-body");
  const v = field || {};
  const cols = currentConfig?.layout?.columns || 6;

  let sCol = 1,
    sRow = "",
    sColSpan = 1,
    sRowSpan = 1;
  if (sourceField?.position) {
    const sp = sourceField.position;
    if (direction === "right") {
      const total = sp.colSpan || 1;
      const srcNew = Math.ceil(total / 2);
      const newSpan = Math.max(1, total - srcNew);
      sCol = (sp.col || 1) + srcNew;
      sRow = sp.row || "";
      sColSpan = newSpan;
      sRowSpan = sp.rowSpan || 1;
    } else if (direction === "below") {
      sCol = sp.col || 1;
      sRow = (sp.row || 1) + (sp.rowSpan || 1);
      sColSpan = sp.colSpan || 1;
      sRowSpan = 1;
    }
  }

  body.innerHTML = `
<div class="form-row">
  <label>Field Type *</label>
  <select class="form-input" id="mf-type" onchange="refreshModalDynamic()">
    ${FIELD_TYPES.map((t) => `<option value="${t}"${v.type === t ? " selected" : ""}>${t}</option>`).join("")}
  </select>
</div>
<div class="form-row">
  <label>ID * <span class="field-hint">Unique, no spaces</span></label>
  <input class="form-input" id="mf-id" value="${esc(v.id || "")}" placeholder="unique_field_id"/>
</div>
<div class="form-row">
  <label>Label *</label>
  <input class="form-input" id="mf-label" value="${esc(v.label || "")}" placeholder="Display label"/>
</div>
<div id="mf-dynamic"></div>
<div class="form-row"><label>Position</label></div>
<div class="form-row-2">
  <div class="form-row"><label>Column (1–${cols})</label><input class="form-input" id="mf-col" type="number" min="1" max="${cols}" value="${v.position?.col || sCol}"/></div>
  <div class="form-row"><label>Row</label><input class="form-input" id="mf-row" type="number" min="1" value="${v.position?.row || sRow}"/></div>
</div>
<div class="form-row-2">
  <div class="form-row"><label>Col Span</label><input class="form-input" id="mf-colspan" type="number" min="1" max="${cols}" value="${v.position?.colSpan || sColSpan}"/></div>
  <div class="form-row"><label>Row Span</label><input class="form-input" id="mf-rowspan" type="number" min="1" value="${v.position?.rowSpan || sRowSpan}"/></div>
</div>`;
  refreshModalDynamic(field);
}

function refreshModalDynamic(field) {
  const type = document.getElementById("mf-type")?.value;
  const dyn = document.getElementById("mf-dynamic");
  if (!dyn) return;
  const v = field || {};
  let html = "";
  if (type === "section") {
    html = `<div class="form-row"><label>Subtitle</label><input class="form-input" id="mf-subtitle" value="${esc(v.subtitle || "")}" placeholder="Optional subtitle"/></div>`;
  } else if (type === "action") {
    html = `<div class="form-row"><label>Equation * <span class="field-hint">e.g. 10 + Math.floor((dex-10)/2)</span></label><input class="form-input" id="mf-equation" value="${esc(v.equation || "")}" placeholder="JS expression"/></div>
  <div class="form-row"><label>Dice (optional)</label><input class="form-input" id="mf-dice" value="${esc(v.dice || "")}" placeholder="d20"/></div>`;
  } else if (type === "die") {
    html = ``;
  } else {
    html = `<div class="form-row"><label>Placeholder</label><input class="form-input" id="mf-placeholder" value="${esc(v.placeholder || "")}" placeholder="Hint text"/></div>
  <div class="form-row"><label>Default Value</label><input class="form-input" id="mf-default" value="${esc(v.default || "")}" placeholder="Initial value"/></div>`;
    if (type === "stat" || type === "number")
      html += `<div class="form-row"><label>Dice (optional)</label><input class="form-input" id="mf-dice" value="${esc(v.dice || "")}" placeholder="d20"/></div>`;
    if (type === "text")
      html += `<div class="form-row"><label>Multiline</label><select class="form-input" id="mf-multiline"><option value="false"${!v.multiline ? " selected" : ""}>No</option><option value="true"${v.multiline ? " selected" : ""}>Yes</option></select></div>`;
  }
  dyn.innerHTML = html;
}

function gatherModalField() {
  const type = document.getElementById("mf-type").value;
  const id = document
    .getElementById("mf-id")
    .value.trim()
    .replace(/\s+/g, "_");
  const label = document.getElementById("mf-label").value.trim();
  if (!id) throw new Error("ID is required");
  if (!label) throw new Error("Label is required");
  const f = { id, type, label };
  const row = parseInt(document.getElementById("mf-row").value);
  f.position = {
    col: parseInt(document.getElementById("mf-col").value) || 1,
    colSpan: parseInt(document.getElementById("mf-colspan").value) || 1,
    rowSpan: parseInt(document.getElementById("mf-rowspan").value) || 1,
  };
  if (row) f.position.row = row;
  if (type === "section") {
    const s = document.getElementById("mf-subtitle")?.value;
    if (s) f.subtitle = s;
  } else if (type === "action") {
    f.equation =
      document.getElementById("mf-equation")?.value.trim() || "0";
    const d = document.getElementById("mf-dice")?.value.trim();
    if (d) f.dice = d;
  } else {
    const ph = document.getElementById("mf-placeholder")?.value;
    if (ph) f.placeholder = ph;
    const def = document.getElementById("mf-default")?.value;
    if (def) f.default = def;
    const d = document.getElementById("mf-dice")?.value?.trim();
    if (d) f.dice = d;
    const ml = document.getElementById("mf-multiline")?.value;
    if (ml === "true") f.multiline = true;
  }
  return f;
}

function confirmAddField() {
  try {
    const f = gatherModalField();
    if (!currentConfig)
      currentConfig = {
        version: "1.0",
        name: "Untitled",
        fields: [],
        layout: { columns: 6 },
      };
    if (!currentConfig.fields) currentConfig.fields = [];
    if (currentConfig.fields.find((x) => x.id === f.id))
      throw new Error(`ID "${f.id}" already exists`);
    if (insertAfterFieldId) {
      const idx = currentConfig.fields.findIndex(
        (x) => x.id === insertAfterFieldId,
      );
      if (idx > -1) {
        if (insertDirection === "right") {
          const src = currentConfig.fields[idx];
          const total = src.position?.colSpan || 1;
          src.position = src.position || {};
          src.position.colSpan = Math.ceil(total / 2);
        }
        if (insertDirection === "below") {
          for (field of currentConfig.fields) {
            if (f.position.row <= (field.position?.row || 1)) {
              field.position = field.position || {};
              field.position.row =
                field.position.row + f.position?.rowSpan;
            }
          }
        }
        currentConfig.fields.splice(idx + 1, 0, f);
      } else currentConfig.fields.push(f);
    } else currentConfig.fields.push(f);
    closeModal();
    afterConfigChange();
    showToast(`✓ Added "${f.label}"`, 1500);
  } catch (e) {
    showToast("❌ " + e.message, 3000);
  }
}
function confirmEditField(oldId) {
  try {
    const f = gatherModalField();
    const idx = currentConfig.fields.findIndex((x) => x.id === oldId);
    if (idx === -1) throw new Error("Field not found");
    if (f.id !== oldId && currentConfig.fields.find((x) => x.id === f.id))
      throw new Error(`ID "${f.id}" already exists`);
    currentConfig.fields[idx] = f;
    closeModal();
    afterConfigChange();
    showToast(`✓ Updated "${f.label}"`, 1500);
  } catch (e) {
    showToast("❌ " + e.message, 3000);
  }
}
function deleteField(id) {
  if (!currentConfig) return;
  currentConfig.fields = currentConfig.fields.filter((f) => f.id !== id);
  afterConfigChange();
  showToast("Field deleted", 1500);
}
function afterConfigChange() {
  renderCanvas();
  renderSheet();
  syncJsonPane();
  persistConfig();
}

// ── SAVE ──
function scheduleAutoSave() {
  const ind = document.getElementById("save-indicator");
  ind.textContent = "● Unsaved";
  ind.style.color = "var(--warn)";
  clearTimeout(autoSaveTimer);
  autoSaveTimer = setTimeout(() => persistConfig(true), 1500);
}
function persistConfig(notify) {
  if (!currentConfig) return;
  localStorage.setItem(LS_CONFIG, JSON.stringify(currentConfig));
  localStorage.setItem(LS_CHAR, JSON.stringify(characterData));
  const ind = document.getElementById("save-indicator");
  ind.textContent = "✓ Saved";
  ind.style.color = "";
  if (notify) showToast("✓ Auto-saved", 1000);
}

// ── EXAMPLE ──
function loadExampleConfig() {
  currentConfig = {
    version: "1.0",
    name: "Fantasy RPG",
    font: "Georgia",
    fontSize: "20",
    layout: { columns: 6, gap: 10 },
    theme: {
      dark: { accent: "#e94560", bg: "#1a1a2e", card: "#1e1e38" },
      light: { accent: "#c0392b", bg: "#f0f0f5", card: "#ffffff" },
    },
    fields: [
      {
        id: "s_id",
        type: "section",
        label: "Identity",
        subtitle: "Core character info",
        position: { col: 1, row: 1, colSpan: 6 },
      },
      {
        id: "char_name",
        type: "text",
        label: "Name",
        placeholder: "Your character",
        position: { col: 1, row: 2, colSpan: 2 },
      },
      {
        id: "char_race",
        type: "text",
        label: "Race",
        placeholder: "e.g. Elf",
        position: { col: 3, row: 2, colSpan: 2 },
      },
      {
        id: "char_class",
        type: "text",
        label: "Class",
        placeholder: "e.g. Ranger",
        position: { col: 5, row: 2, colSpan: 2 },
      },
      {
        id: "s_stats",
        type: "section",
        label: "Core Stats",
        subtitle: "Ability scores",
        position: { col: 1, row: 3, colSpan: 6 },
      },
      {
        id: "str",
        type: "stat",
        label: "Strength",
        dice: "d20",
        default: "10",
        position: { col: 1, row: 4 },
      },
      {
        id: "dex",
        type: "stat",
        label: "Dexterity",
        dice: "d20",
        default: "10",
        position: { col: 2, row: 4 },
      },
      {
        id: "con",
        type: "stat",
        label: "Constitution",
        dice: "d20",
        default: "10",
        position: { col: 3, row: 4 },
      },
      {
        id: "int",
        type: "stat",
        label: "Intelligence",
        dice: "d20",
        default: "10",
        position: { col: 4, row: 4 },
      },
      {
        id: "wis",
        type: "stat",
        label: "Wisdom",
        dice: "d20",
        default: "10",
        position: { col: 5, row: 4 },
      },
      {
        id: "cha",
        type: "stat",
        label: "Charisma",
        dice: "d20",
        default: "10",
        position: { col: 6, row: 4 },
      },
      {
        id: "s_derived",
        type: "section",
        label: "Derived",
        subtitle: "Computed values",
        position: { col: 1, row: 5, colSpan: 6 },
      },
      {
        id: "hp_max",
        type: "action",
        label: "Max HP",
        equation: "10+con",
        dice: "d8",
        position: { col: 1, row: 6, colSpan: 2 },
      },
      {
        id: "ac",
        type: "action",
        label: "Armor Class",
        equation: "10+Math.floor((dex-10)/2)",
        position: { col: 3, row: 6, colSpan: 2 },
      },
      {
        id: "init",
        type: "action",
        label: "Initiative",
        equation: "Math.floor((dex-10)/2)",
        dice: "d20",
        position: { col: 5, row: 6, colSpan: 2 },
      },
      {
        id: "s_vitals",
        type: "section",
        label: "Vitals",
        position: { col: 1, row: 7, colSpan: 6 },
      },
      {
        id: "hp_cur",
        type: "number",
        label: "Current HP",
        default: "10",
        dice: "d8",
        position: { col: 1, row: 8, colSpan: 2 },
      },
      {
        id: "level",
        type: "number",
        label: "Level",
        default: "1",
        position: { col: 3, row: 8 },
      },
      {
        id: "gold",
        type: "number",
        label: "Gold",
        default: "0",
        position: { col: 4, row: 8 },
      },
      {
        id: "notes",
        type: "text",
        label: "Notes",
        multiline: true,
        placeholder: "Character notes…",
        position: { col: 1, row: 9, colSpan: 6, rowSpan: 2 },
      },
    ],
  };
  characterData = {};
  resetThemeVars();
  applyConfigTheme(
    currentConfig.theme,
    currentConfig.font,
    currentConfig.fontSize,
  );
  afterConfigChange();
  syncMetaPane();
  showToast("✓ Example loaded", 1500);
}

// ── VALIDATE ──
function validateConfig(cfg) {
  if (!cfg.version) throw new Error('Config missing "version"');
  if (!Array.isArray(cfg.fields))
    throw new Error('Config missing "fields" array');
  for (const f of cfg.fields) {
    if (!f.id) throw new Error('Field missing "id"');
    if (!f.type) throw new Error(`Field "${f.id}" missing "type"`);
    if (!f.label) throw new Error(`Field "${f.id}" missing "label"`);
  }
}

// ── EXPORT / IMPORT ──
function exportCharacter() {
  if (!currentConfig) {
    showToast("No config loaded", 2000);
    return;
  }
  const name =
    document.getElementById("char-name-nav").value || "character";
  downloadJSON(
    {
      type: "CHARACTER-CONFIG",
      version: "1.0",
      exported: new Date().toISOString(),
      characterName: name,
      characterData,
      ttrpgConfig: currentConfig,
    },
    name.replace(/\s+/g, "_") + "_character.json",
  );
}
function exportConfig() {
  if (!currentConfig) {
    showToast("No config loaded", 2000);
    return;
  }
  downloadJSON(
    currentConfig,
    (currentConfig.name || "ttrpg").replace(/\s+/g, "_") + "_config.json",
  );
}
function downloadJSON(obj, fn) {
  const a = document.createElement("a");
  a.href =
    "data:application/json;charset=utf-8," +
    encodeURIComponent(JSON.stringify(obj, null, 2));
  a.download = fn;
  a.click();
}
function loadFile(evt) {
  const f = evt.target.files[0];
  if (!f) return;
  const r = new FileReader();
  r.onload = (e) => importJSON(e.target.result);
  r.readAsText(f);
  evt.target.value = "";
}
function importJSON(text) {
  try {
    const obj = JSON.parse(text);
    if (obj.type === "CHARACTER-CONFIG") {
      currentConfig = obj.ttrpgConfig;
      characterData = obj.characterData || {};
      document.getElementById("char-name-nav").value =
        obj.characterName || "";
      showToast(`✓ Character "${obj.characterName}" loaded`, 2500);
    } else {
      validateConfig(obj);
      currentConfig = obj;
      characterData = {};
      showToast(`✓ Config "${obj.name}" loaded`, 2500);
    }
    resetThemeVars();
    if (currentConfig.theme)
      applyConfigTheme(
        currentConfig.theme,
        currentConfig.font,
        currentConfig.fontSize,
      );
    afterConfigChange();
    syncEditorToConfig();
    syncMetaPane();
    document.getElementById("no-config").style.display = "none";
    document.getElementById("sheet-grid").style.display = "grid";
    saveConfigToStorage();
  } catch (e) {
    showToast("❌ " + e.message, 4000);
  }
}
function dragOver(e) {
  e.preventDefault();
  document.getElementById("drop-zone").classList.add("dragover");
}
function dragLeave() {
  document.getElementById("drop-zone").classList.remove("dragover");
}
function dropFile(e) {
  e.preventDefault();
  dragLeave();
  const f = e.dataTransfer.files[0];
  if (!f) return;
  const r = new FileReader();
  r.onload = (ev) => importJSON(ev.target.result);
  r.readAsText(f);
}

// ── SAVED LIST ──
function saveConfigToStorage() {
  if (!currentConfig) return;
  const name = currentConfig.name || "Unnamed";
  const saved = getSaved();
  const idx = saved.findIndex((s) => s.name === name);
  const entry = {
    name,
    version: currentConfig.version,
    saved: Date.now(),
    config: currentConfig,
  };
  if (idx > -1) saved[idx] = entry;
  else saved.push(entry);
  localStorage.setItem(LS_SAVED, JSON.stringify(saved));
  refreshSavedList();
}
function getSaved() {
  try {
    return JSON.parse(localStorage.getItem(LS_SAVED) || "[]");
  } catch {
    return [];
  }
}
function refreshSavedList() {
  const list = document.getElementById("saved-list");
  if (!list) return;
  const saved = getSaved();
  list.innerHTML = "";
  if (!saved.length) {
    list.innerHTML =
      '<li style="color:var(--text3);font-size:12px;padding:8px 0">No saved configs yet</li>';
    return;
  }
  for (const [i, s] of saved.entries()) {
    const li = document.createElement("li");
    li.className = "saved-item";
    li.innerHTML = `<div><div class="saved-name">${esc(s.name)}</div><span>v${s.version || "?"} · ${new Date(s.saved).toLocaleDateString()}</span></div>`;
    const btns = document.createElement("div");
    btns.style.cssText = "display:flex;gap:4px;flex-shrink:0";
    const lb = document.createElement("button");
    lb.className = "btn";
    lb.textContent = "Load";
    lb.style.cssText = "font-size:11px;padding:3px 8px";
    lb.onclick = () => loadSavedConfig(i);
    const db = document.createElement("button");
    db.className = "danger-btn";
    db.textContent = "✕";
    db.onclick = () => deleteSavedConfig(i);
    btns.appendChild(lb);
    btns.appendChild(db);
    li.appendChild(btns);
    list.appendChild(li);
  }
}
function loadSavedConfig(i) {
  const saved = getSaved();
  if (!saved[i]) return;
  currentConfig = saved[i].config;
  characterData = {};
  resetThemeVars();
  if (currentConfig.theme)
    applyConfigTheme(
      currentConfig.theme,
      currentConfig.font,
      currentConfig.fontSize,
    );
  afterConfigChange();
  syncEditorToConfig();
  syncMetaPane();
  document.getElementById("no-config").style.display = "none";
  document.getElementById("sheet-grid").style.display = "grid";
  showToast(`Loaded "${saved[i].name}"`, 2000);
}
function deleteSavedConfig(i) {
  const saved = getSaved();
  saved.splice(i, 1);
  localStorage.setItem(LS_SAVED, JSON.stringify(saved));
  refreshSavedList();
}

// ── MODAL ──
function closeModal() {
  document.getElementById("modal-overlay").classList.remove("show");
}
document
  .getElementById("modal-overlay")
  .addEventListener("click", (e) => {
    if (e.target === document.getElementById("modal-overlay"))
      closeModal();
  });

// ── DICE ──
function parseDice(str) {
  const m = str.match(/^(\d*)d(\d+)([+-]\d+)?$/i);
  if (!m) return null;
  return {
    count: parseInt(m[1] || 1),
    sides: parseInt(m[2]),
    mod: parseInt(m[3] || 0),
  };
}
function rollDice(diceStr, label, statMod) {
  const d = parseDice(diceStr);
  if (!d) {
    showToast("Invalid dice: " + diceStr, 2000);
    return;
  }
  const rolls = [];
  for (let i = 0; i < d.count; i++)
    rolls.push(Math.ceil(Math.random() * d.sides));
  const base = rolls.reduce((a, b) => a + b, 0),
    mod = (d.mod || 0) + (typeof statMod === "number" ? statMod : 0),
    total = base + mod;
  const modStr = mod !== 0 ? ` ${mod >= 0 ? "+" : ""}${mod}` : "",
    rollStr = rolls.length > 1 ? `[${rolls.join(", ")}]` : rolls[0];
  showToast(
    `<span style="font-size:12px;color:var(--text3)">${label} — ${diceStr}${modStr}</span><span class="roll-big">${total}</span>${rolls.length > 1 || mod ? `<span style="font-size:11px;color:var(--text2)">${rollStr}${mod ? " + mod " + mod : ""}</span>` : ""}`,
    4000,
  );
}
let timeoutId = 0;
function showToast(html, dur) {
  const t = document.getElementById("toast");
  t.innerHTML = html;
  t.classList.add("show");
  if (timeoutId) {
    window.clearTimeout(timeoutId);
  }
  timeoutId = setTimeout(() => t.classList.remove("show"), dur || 3000);
  const element = document.createElement("div");
  element.classList.add("flex-column");
  element.innerHTML = html;
  document.getElementById("log-sheet").appendChild(element);
  document
    .getElementById("log-sidebar-body")
    .scrollTo(
      0,
      document.getElementById("log-sidebar-body").scrollHeight,
    );
}
function esc(s) {
  return String(s).replace(
    /[&<>"']/g,
    (c) =>
      ({
        "&": "&amp;",
        "<": "&lt;",
        ">": "&gt;",
        '"': "&quot;",
        "'": "&#39;",
      })[c],
  );
}
