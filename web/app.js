const TOKEN_INPUTS = {
  "brand.primary": { color: "color-brand", hex: "hex-brand" },
  "text.primary": { color: "color-text", hex: "hex-text" },
  surface: { color: "color-surface", hex: "hex-surface" },
  background: { color: "color-bg", hex: "hex-bg" },
};

const state = {
  colors: {},
  assets: {},
};

function toColorInput(hex) {
  const h = (hex || "#000000").replace("#", "");
  return `#${h.slice(0, 6)}`;
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
  phone.style.background = c.background || "#fff";
  toolbar.style.background = c["brand.primary"] || "#333";
  card.style.background = c.surface || "#fff";
  title.style.color = c["text.primary"] || "#111";
  body.style.color = c["text.primary"] || "#111";
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
}

async function loadTheme() {
  const res = await fetch("/admin/theme");
  if (!res.ok) throw new Error("加载主题失败");
  const data = await res.json();
  state.colors = { ...data.draft.colors };
  state.assets = { ...data.draft.assets };
  syncInputsFromState();
  applyPreview();
  document.getElementById("publishedId").textContent = data.published?.snapshotId || "—";
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
  setStatus("正在保存颜色…");
  const res = await fetch("/admin/theme/colors", {
    method: "PUT",
    headers: { "content-type": "application/json" },
    body: JSON.stringify(state.colors),
  });
  const data = await res.json();
  if (!res.ok) throw new Error(data.error || "保存失败");
  state.colors = data.colors;
  syncInputsFromState();
  applyPreview();
  setStatus("草稿已保存。Android 仍使用上次发布的 snapshot，直到你点击发布。");
}

async function publish() {
  await saveDraft();
  setStatus("正在发布…");
  const res = await fetch("/admin/theme/publish", { method: "POST" });
  const data = await res.json();
  if (!res.ok) throw new Error(data.error || "发布失败");
  document.getElementById("publishedId").textContent = data.snapshotId;
  document.getElementById("publishedAt").textContent = data.publishedAt;
  setStatus(`已发布 ${data.snapshotId}。模拟器中点击「立即拉取」即可看到更新。`);
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

const saveBtn = document.getElementById("saveBtn");
const publishBtn = document.getElementById("publishBtn");
saveBtn.addEventListener("click", withBusy(saveBtn, saveDraft));
publishBtn.addEventListener("click", withBusy(publishBtn, publish));

bindColorInputs();
loadTheme().catch((err) => setStatus(err.message));
