const state = {
  apiBaseUrl: localStorage.getItem("soaiAdminApiBaseUrl") || "http://127.0.0.1:8787",
  adminToken: localStorage.getItem("soaiAdminToken") || "soai-admin-dev"
};

const els = {
  apiBaseUrl: document.getElementById("apiBaseUrl"),
  adminToken: document.getElementById("adminToken"),
  toast: document.getElementById("toast")
};

els.apiBaseUrl.value = state.apiBaseUrl;
els.adminToken.value = state.adminToken;

document.getElementById("saveConfigBtn").addEventListener("click", saveConfig);
document.getElementById("refreshBtn").addEventListener("click", loadAll);
document.querySelectorAll("[data-open]").forEach((button) => {
  button.addEventListener("click", () => {
    document.getElementById(button.dataset.open).classList.toggle("hidden");
  });
});

document.getElementById("courseForm").addEventListener("submit", (event) => submitForm(event, "/api/admin/courses"));
document.getElementById("contentForm").addEventListener("submit", (event) => submitForm(event, "/api/admin/content"));
document.getElementById("productForm").addEventListener("submit", (event) => submitForm(event, "/api/admin/products"));
document.getElementById("settingsForm").addEventListener("submit", submitSettings);

loadAll();

function saveConfig() {
  state.apiBaseUrl = els.apiBaseUrl.value.replace(/\/$/, "");
  state.adminToken = els.adminToken.value.trim();
  localStorage.setItem("soaiAdminApiBaseUrl", state.apiBaseUrl);
  localStorage.setItem("soaiAdminToken", state.adminToken);
  toast("连接配置已保存。");
  loadAll();
}

async function loadAll() {
  try {
    const [overview, videos, courses, users, content, products, oss] = await Promise.all([
      api("/api/admin/overview"),
      api("/api/admin/videos"),
      api("/api/admin/courses"),
      api("/api/admin/users"),
      api("/api/admin/content"),
      api("/api/admin/products"),
      api("/api/admin/oss/status")
    ]);
    renderOverview(overview);
    renderOss(oss);
    renderPendingReports(overview.pendingReports || []);
    renderVideos(videos.items || []);
    renderCourses(courses.items || []);
    renderUsers(users.items || []);
    renderContent(content.items || []);
    renderProducts(products.items || []);
  } catch (error) {
    toast(`后台连接失败：${error.message}`);
  }
}

async function api(path, options = {}) {
  const response = await fetch(`${state.apiBaseUrl}${path}`, {
    ...options,
    headers: {
      "Content-Type": "application/json",
      Authorization: `Bearer ${state.adminToken}`,
      ...(options.headers || {})
    }
  });
  const json = await response.json().catch(() => ({}));
  if (!response.ok) {
    throw new Error(json.message || json.code || `HTTP ${response.status}`);
  }
  return json;
}

async function submitForm(event, path) {
  event.preventDefault();
  const form = event.currentTarget;
  const payload = Object.fromEntries(new FormData(form).entries());
  try {
    await api(path, {
      method: "POST",
      body: JSON.stringify(payload)
    });
    form.reset();
    form.classList.add("hidden");
    toast("已保存。");
    loadAll();
  } catch (error) {
    toast(`保存失败：${error.message}`);
  }
}

async function submitSettings(event) {
  event.preventDefault();
  const payload = Object.fromEntries(new FormData(event.currentTarget).entries());
  try {
    await api("/api/admin/settings", {
      method: "POST",
      body: JSON.stringify(payload)
    });
    toast("配置已保存。");
    loadAll();
  } catch (error) {
    toast(`配置保存失败：${error.message}`);
  }
}

function renderOverview(data) {
  const counts = data.counts || {};
  const cards = [
    ["视频", counts.videos || 0, "条"],
    ["报告", counts.reports || 0, "份"],
    ["待复核", counts.pendingReports || 0, "份"],
    ["课程", counts.courses || 0, "个"],
    ["内容", counts.contentItems || 0, "条"],
    ["反馈", counts.feedbackItems || 0, "条"]
  ];
  document.getElementById("overview").innerHTML = cards.map(([label, value, unit]) => `
    <article class="kpi-card">
      <div class="kpi-label">${escapeHtml(label)}</div>
      <div class="kpi-value">${escapeHtml(value)}<small>${escapeHtml(unit)}</small></div>
    </article>
  `).join("");
}

function renderOss(oss) {
  const pill = document.getElementById("ossStatusPill");
  pill.textContent = oss.ready ? "已就绪" : "待配置";
  pill.className = `status-pill ${oss.ready ? "ok" : "watch"}`;
  document.getElementById("ossStatus").innerHTML = `
    <p>Bucket：<code>${escapeHtml(oss.bucket || "未设置")}</code></p>
    <p>Region：<code>${escapeHtml(oss.region || "未设置")}</code></p>
    <p>Endpoint：<code>${escapeHtml(oss.endpoint || "未设置")}</code></p>
    <p>AccessKey：${oss.accessKeyConfigured ? "已配置" : "未配置"}，Secret：${oss.secretConfigured ? "已配置" : "未配置"}</p>
    <p>缺少项：${(oss.missing || []).length ? oss.missing.map(escapeHtml).join("、") : "无"}</p>
    <p>${escapeHtml(oss.recommendation || "")}</p>
  `;
}

function renderPendingReports(items) {
  document.getElementById("pendingReports").innerHTML = empty(items, "暂无待复核报告") || items.map((item) => `
    <article class="compact-item">
      <strong>${escapeHtml(item.studentName || item.studentId)} · ${escapeHtml(item.overallScore)} 分</strong>
      <span>${escapeHtml(item.conclusion || "等待教练复核")} · ${formatDate(item.reportTime)}</span>
    </article>
  `).join("");
}

function renderVideos(items) {
  document.getElementById("videoRows").innerHTML = items && items.length ? items.map((item) => `
    <tr>
      <td><strong>${escapeHtml(item.fileName || item.id)}</strong><br><small>${escapeHtml(item.id)}</small></td>
      <td>${escapeHtml(item.studentId || "-")}</td>
      <td>${status(item.uploadStatus || "selected")}</td>
      <td>${escapeHtml(item.durationSec || 0)}s</td>
      <td>${escapeHtml(item.storageProvider || "-")}<br><small>${escapeHtml(item.storageKey || "")}</small></td>
      <td>${item.reportId ? escapeHtml(item.reportId) : "-"}</td>
    </tr>
  `).join("") : `<tr><td colspan="6">暂无视频，数据会在小程序上传后自动出现。</td></tr>`;
}

function renderCourses(items) {
  document.getElementById("courseGrid").innerHTML = empty(items, "暂无课程") || items.map((item) => `
    <article class="course-card">
      <strong>${escapeHtml(item.title)}</strong>
      <span>${escapeHtml(item.description || "暂无说明")}</span>
      <footer>
        <b>${escapeHtml(item.category || "未分类")}</b>
        ${status(item.status)}
      </footer>
    </article>
  `).join("");
}

function renderUsers(items) {
  document.getElementById("userList").innerHTML = empty(items, "暂无用户") || items.map((item) => `
    <article class="compact-item">
      <strong>${escapeHtml(item.name || item.id)}</strong>
      <span>${escapeHtml(item.clubName || "未绑定俱乐部")} · ${escapeHtml(item.coachName || "未绑定教练")} · 报告 ${escapeHtml(item.reportCount || 0)} 份</span>
    </article>
  `).join("");
}

function renderContent(items) {
  document.getElementById("contentQueue").innerHTML = empty(items, "暂无内容") || items.map((item) => `
    <article class="queue-item">
      <strong>${escapeHtml(item.title)}</strong>
      <span>${escapeHtml(item.boundary || "")}</span>
      <footer>
        <b>${escapeHtml(item.channel || "-")} · ${escapeHtml(item.owner || "-")}</b>
        ${status(item.status)}
      </footer>
    </article>
  `).join("");
}

function renderProducts(items) {
  document.getElementById("productGrid").innerHTML = empty(items, "暂无产品") || items.map((item) => `
    <article class="product-card">
      <strong>${escapeHtml(item.name)}</strong>
      <span>${escapeHtml(item.description || "暂无说明")}</span>
      <footer>
        <b>${escapeHtml(item.category || "未分类")} · ${escapeHtml(item.channel || "-")}</b>
        ${status(item.status)}
      </footer>
    </article>
  `).join("");
}

function status(value) {
  const labelMap = {
    uploaded: "已上传",
    selected: "已选择",
    draft: "草稿",
    published: "上架",
    archived: "归档",
    reviewing: "审核中",
    scheduled: "已排期",
    active: "销售中",
    planning: "规划中",
    paused: "暂停"
  };
  const watch = ["draft", "selected", "reviewing", "scheduled", "planning"].includes(value);
  return `<span class="status-pill ${watch ? "watch" : "ok"}">${escapeHtml(labelMap[value] || value)}</span>`;
}

function empty(items, text) {
  return items && items.length ? "" : `<article class="compact-item"><strong>${escapeHtml(text)}</strong><span>数据会在小程序和后台操作后自动出现。</span></article>`;
}

function formatDate(value) {
  if (!value) return "-";
  return String(value).replace("T", " ").slice(0, 16);
}

function toast(message) {
  els.toast.textContent = message;
  els.toast.classList.add("show");
  window.clearTimeout(toast.timer);
  toast.timer = window.setTimeout(() => els.toast.classList.remove("show"), 2600);
}

function escapeHtml(value) {
  return String(value ?? "")
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;")
    .replace(/'/g, "&#039;");
}
