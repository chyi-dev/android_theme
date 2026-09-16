const TOKEN_INPUTS = {
  "brand.primary": { color: "color-brand", hex: "hex-brand" },
  "text.primary": { color: "color-text", hex: "hex-text" },
  surface: { color: "color-surface", hex: "hex-surface" },
  background: { color: "color-bg", hex: "hex-bg" },
};

const STRING_LABELS = {
  "string.app.title": "应用标题",
  "string.home.welcome": "首页欢迎（可用 {name}）",
  "string.home.body": "首页正文",
  "string.action.pull": "拉取按钮",
  "string.chat.short": "短气泡",
  "string.chat.bubble": "长气泡（观察九宫格拉伸）",
};

const state = {
  colors: {},
  assets: {},
  strings: { "zh-CN": {}, en: {} },
  stringKeys: Object.keys(STRING_LABELS),
  editLocale: "zh-CN",
  previewLocale: "zh-CN",
};

function toColorInput(hex) {
  const h = (hex || "#000000").replace("#", "");
  return `#${h.slice(0, 6)}`;
}

function formatTemplate(template, args) {
  return String(template || "").replace(/\{(\w+)\}/g, (_, key) => (
    args[key] == null ? `{${key}}` : String(args[key])
  ));
}

function t(key, args = {}) {
  const locale = state.previewLocale;
  const table = state.strings[locale] || {};
  const fallback = state.strings.en || {};
  return formatTemplate(table[key] || fallback[key] || key, args);
}

function applyBubbleImage(url, fallbackColor) {
  ["previewBubbleShort", "previewBubbleLong"].forEach((id) => {
    const el = document.getElementById(id);
    if (url) {
      el.style.borderImageSource = `url("${url}${url.includes("?") ? "&" : "?"}t=${Date.now()}")`;
      el.style.background = "transparent";
    } else {
      el.style.borderImageSource = "none";
      el.style.background = fallbackColor;
    }
  });
}

function setStatus(text) {
  document.getElementById("status").textContent = text;
}

function applyPreview() {
  const c = state.colors;
  const phone = document.getElementById("phone");
  const toolbar = document.getElementById("previewToolbar");
  const card = document.getElementById("previewCard");
  const title = document.getElementById("previewTitle");
  const body = document.getElementById("previewBody");
  const pull = document.getElementById("previewPull");
  phone.style.background = c.background || "#fff";
  toolbar.style.background = c["brand.primary"] || "#333";
  pull.style.background = c["brand.primary"] || "#333";
  card.style.background = c.surface || "#fff";
  title.style.color = c["text.primary"] || "#111";
  body.style.color = c["text.primary"] || "#111";
  toolbar.textContent = t("string.app.title");
  title.textContent = t("string.home.welcome", { name: "Ada" });
  body.textContent = t("string.home.body");
  pull.textContent = t("string.action.pull");
  document.getElementById("previewBubbleShort").textContent = t("string.chat.short");
  document.getElementById("previewBubbleLong").textContent = t("string.chat.bubble");
  const bubbleUrl = state.assets["chat.bubble"]?.url;
  applyBubbleImage(bubbleUrl, c["brand.primary"] || "#E65100");
  const banner = state.assets["home.banner"]?.url;
  const logo = state.assets.logo?.url;
  const bannerEl = document.getElementById("previewBanner");
  const logoEl = document.getElementById("previewLogo");
  if (banner) bannerEl.src = `${banner}?t=${Date.now()}`;
  if (logo) logoEl.src = `${logo}?t=${Date.now()}`;
}

function syncInputsFromState() {
  for (const [token, ids] of Object.entries(TOKEN_INPUTS)) {
    const hex = state.colors[token] || "#000000";
    document.getElementById(ids.color).value = toColorInput(hex);
    document.getElementById(ids.hex).value = hex;
  }
  renderStringFields();
}

function renderStringFields() {
  const root = document.getElementById("stringFields");
  const locale = state.editLocale;
  root.innerHTML = "";
  for (const key of state.stringKeys) {
    const wrap = document.createElement("div");
    wrap.className = "field string-field";
    const label = document.createElement("label");
    label.innerHTML = `${STRING_LABELS[key] || key} <code>${key}</code>`;
    const textarea = document.createElement("textarea");
    textarea.value = state.strings[locale]?.[key] || "";
    textarea.dataset.key = key;
    textarea.addEventListener("input", () => {
      if (!state.strings[locale]) state.strings[locale] = {};
      state.strings[locale][key] = textarea.value;
      applyPreview();
    });
    wrap.append(label, textarea);
    root.append(wrap);
  }
}

function setActiveTab(selector, attr, value) {
  document.querySelectorAll(selector).forEach((btn) => {
    btn.classList.toggle("is-active", btn.getAttribute(attr) === value);
  });
}

async function loadTheme() {
  const res = await fetch("/admin/theme");
  if (!res.ok) throw new Error("加载主题失败");
  const data = await res.json();
  state.colors = { ...data.draft.colors };
  state.assets = { ...data.draft.assets };
  state.stringKeys = data.stringKeys?.length ? data.stringKeys : state.stringKeys;
  state.strings = {
    "zh-CN": { ...(data.draft.strings?.["zh-CN"] || {}) },
    en: { ...(data.draft.strings?.en || {}) },
  };
  syncInputsFromState();
  applyPreview();
  document.getElementById("publishedId").textContent = data.published?.snapshotId || "—";
  document.getElementById("publishedI18nId").textContent =
    data.i18nPublished?.i18nSnapshotId || data.published?.linkedI18nSnapshotId || "—";
  document.getElementById("publishedAt").textContent = data.published?.publishedAt || "—";
  setStatus("已加载草稿");
}

function bindColorInputs() {
  for (const [token, ids] of Object.entries(TOKEN_INPUTS)) {
    document.getElementById(ids.color).addEventListener("input", (e) => {
      state.colors[token] = e.target.value.toUpperCase();
      document.getElementById(ids.hex).value = state.colors[token];
      applyPreview();
    });
    document.getElementById(ids.hex).addEventListener("input", (e) => {
      let v = e.target.value.trim();
      if (v && !v.startsWith("#")) v = `#${v}`;
      if (/^#([0-9a-fA-F]{6}|[0-9a-fA-F]{8})$/.test(v)) {
        state.colors[token] = v.toUpperCase();
        document.getElementById(ids.color).value = toColorInput(v);
        applyPreview();
      }
    });
  }
}

async function uploadSlot(slot, file) {
  const form = new FormData();
  form.set("file", file);
  setStatus(`正在上传 ${slot}…`);
  const res = await fetch(`/admin/theme/assets/${encodeURIComponent(slot)}`, {
    method: "POST",
    body: form,
  });
  const data = await res.json();
  if (!res.ok) throw new Error(data.error || "上传失败");
  state.assets[slot] = data.asset;
  applyPreview();
  setStatus(`${slot} 已写入草稿（需发布后客户端才会更新）`);
}

async function saveDraft() {
  setStatus("正在保存草稿…");
  const colorRes = await fetch("/admin/theme/colors", {
    method: "PUT",
    headers: { "content-type": "application/json" },
    body: JSON.stringify(state.colors),
  });
  const colorData = await colorRes.json();
  if (!colorRes.ok) throw new Error(colorData.error || "保存颜色失败");
  state.colors = colorData.colors;

  const i18nRes = await fetch("/admin/i18n", {
    method: "PUT",
    headers: { "content-type": "application/json" },
    body: JSON.stringify({ messages: state.strings }),
  });
  const i18nData = await i18nRes.json();
  if (!i18nRes.ok) throw new Error(i18nData.error || "保存文案失败");
  state.strings = i18nData.messages;
  syncInputsFromState();
  applyPreview();
  setStatus("草稿已保存（颜色 + 文案）。Android 仍使用上次发布的 snapshot，直到你点击发布。");
}

async function publish() {
  await saveDraft();
  setStatus("正在发布主题和语言包…");
  const res = await fetch("/admin/theme/publish", { method: "POST" });
  const data = await res.json();
  if (!res.ok) throw new Error(data.error || "发布失败");
  document.getElementById("publishedId").textContent = data.snapshotId;
  document.getElementById("publishedI18nId").textContent = data.i18nSnapshotId || "—";
  document.getElementById("publishedAt").textContent = data.publishedAt;
  setStatus(`已发布 theme ${data.snapshotId} 与 i18n ${data.i18nSnapshotId}。模拟器中点击「立即拉取」并切换语言即可验收。`);
}

function withBusy(btn, fn) {
  return async () => {
    btn.disabled = true;
    try {
      await fn();
    } catch (err) {
      setStatus(err.message || String(err));
    } finally {
      btn.disabled = false;
    }
  };
}

document.getElementById("file-banner").addEventListener("change", async (e) => {
  const file = e.target.files?.[0];
  if (!file) return;
  try { await uploadSlot("home.banner", file); }
  catch (err) { setStatus(err.message); }
});
document.getElementById("file-logo").addEventListener("change", async (e) => {
  const file = e.target.files?.[0];
  if (!file) return;
  try { await uploadSlot("logo", file); }
  catch (err) { setStatus(err.message); }
});
document.getElementById("file-bubble").addEventListener("change", async (e) => {
  const file = e.target.files?.[0];
  if (!file) return;
  try { await uploadSlot("chat.bubble", file); }
  catch (err) { setStatus(err.message); }
});

document.querySelectorAll("[data-edit-locale]").forEach((btn) => {
  btn.addEventListener("click", () => {
    state.editLocale = btn.getAttribute("data-edit-locale");
    setActiveTab("[data-edit-locale]", "data-edit-locale", state.editLocale);
    renderStringFields();
  });
});
document.querySelectorAll("[data-preview-locale]").forEach((btn) => {
  btn.addEventListener("click", () => {
    state.previewLocale = btn.getAttribute("data-preview-locale");
    setActiveTab("[data-preview-locale]", "data-preview-locale", state.previewLocale);
    applyPreview();
  });
});

const saveBtn = document.getElementById("saveBtn");
const publishBtn = document.getElementById("publishBtn");
saveBtn.addEventListener("click", withBusy(saveBtn, saveDraft));
publishBtn.addEventListener("click", withBusy(publishBtn, publish));

bindColorInputs();
loadTheme().catch((err) => setStatus(err.message));
