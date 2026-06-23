// =====================================================
// IGS 機台材料成本 ERP — 前端 v1.9
// 1. ERP 密碼登入
// 2. 工作階段驗證
// 3. 私人 Google Sheet 安全讀取
// =====================================================

const APPS_SCRIPT_URL = "https://script.google.com/macros/s/AKfycbwwDS05GM-oWngHd2GOslFPTrr0ab8O3kamuoSloY-_1QJJHu7jFDH4hDI_-J3qF9In/exec";
const AUTH_TOKEN_KEY = "igs-erp-auth-token";
const MACHINE_STAGING_KEY = "igs-erp-machine-staging-v2";
const API_MESSAGE_SOURCE = "igs-erp-api";
const $ = (id) => document.getElementById(id);

const COST_TYPES = ["打樣版費用", "測試台費用", "實際費用"];
const FALLBACK_CATEGORIES = [
  "01_模擬機", "02_競速類", "03_槍機類", "04_彩票機", "05_推幣推珠機",
  "06_兒童水槍射球機", "07_兒童模擬", "08_兒童卡牌", "09_兒童體感",
  "10_音樂機", "11_魚機", "12_VR", "13_禮品機", "14_競技類",
  "15_運動類", "16_中性機", "17_彈珠台", "18_自動兌換機",
];

const pageDescriptions = {
  dashboard: "集中查看機台、材料品項與三階段成本。",
  machines: "搜尋機台並查看打樣版、測試台與實際費用。",
  costRecords: "查看各機台的成本單與原始估價單。",
  machineTotals: "彙整每台機台的個別成本總和。",
  quotationEntry: "上傳圖片或 PDF，將成本歸入既有機台並確認稅額與安裝區域。",
  quickMachine: "快速建立新的機台主檔。",
  suppliers: "查看供應商與成本單金額。",
  machine360Setup: "上傳四張基準角度圖，建立少量圖片驅動的 360° 機台成本視覺。",
};

let authToken = sessionStorage.getItem(AUTH_TOKEN_KEY) || "";
let authenticationReady = false;

let state = {
  machines: [],
  costOrders: [],
  costItems: [],
  suppliers: [],
  settings: [],
  machineAreas: [],
  machine360Views: [],
  machine360Draft: {},
  draftItems: [],
  stagedMachines: loadStagedMachines(),
  selectedMachineId: "",
  machineImagePayload: null,
  quotationDocumentPayload: null,
  quotationAiStatus: "未辨識",
  quotationRawText: "",
  selectedMachineStage: COST_TYPES[0],
  selectedMachineArea: "",
};

const secureImageCache = new Map();

const money = (value) => {
  const number = toNumber(value);
  return "$" + number.toLocaleString("zh-TW", { maximumFractionDigits: 2 });
};

function toNumber(value) {
  if (typeof value === "number") return Number.isFinite(value) ? value : 0;
  const number = Number(String(value ?? "").replace(/[$,，\s]/g, ""));
  return Number.isFinite(number) ? number : 0;
}

function norm(value) {
  return String(value ?? "").toLowerCase().replace(/\s+/g, "");
}

function escapeHTML(value) {
  return String(value ?? "")
    .replaceAll("&", "&amp;")
    .replaceAll("<", "&lt;")
    .replaceAll(">", "&gt;")
    .replaceAll('"', "&quot;")
    .replaceAll("'", "&#039;");
}

function firstValue(row, keys, fallback = "") {
  for (const key of keys) {
    const value = row?.[key];
    if (value !== undefined && value !== null && String(value).trim() !== "") return value;
  }
  return fallback;
}

function normalizeDate(value) {
  const text = String(value || "").trim();
  const match = text.match(/^(\d{4})[-/.](\d{1,2})[-/.](\d{1,2})/);
  if (!match) return text;
  return `${match[1]}-${String(match[2]).padStart(2, "0")}-${String(match[3]).padStart(2, "0")}`;
}

function dateValue(value) {
  const timestamp = Date.parse(String(value || "").replace(/\//g, "-"));
  return Number.isFinite(timestamp) ? timestamp : 0;
}

function normalizeMachine(row) {
  return {
    id: String(firstValue(row, ["機台ID", "machineId", "id"])),
    code: String(firstValue(row, ["機台代碼", "machineCode", "code"])),
    name: String(firstValue(row, ["機台名稱", "machineName", "name"], "未命名機台")),
    category: String(firstValue(row, ["機台分類", "category"], "未分類")),
    imageUrl: String(firstValue(row, ["機台圖片URL", "圖片URL", "imageUrl"])),
    imageFileId: String(firstValue(row, ["機台圖片檔案ID", "imageFileId"])),
    note: String(firstValue(row, ["備註", "note"])),
    createdAt: String(firstValue(row, ["建立時間", "createdAt"])),
    updatedAt: String(firstValue(row, ["更新時間", "updatedAt"])),
  };
}

function normalizeCostOrder(row) {
  return {
    id: String(firstValue(row, ["成本單ID", "costOrderId", "id"])),
    machineId: String(firstValue(row, ["機台ID", "machineId"])),
    type: String(firstValue(row, ["費用類型", "成本類型", "type"])),
    date: normalizeDate(firstValue(row, ["日期", "date"])),
    supplierId: String(firstValue(row, ["供應商ID", "supplierId"])),
    supplier: String(firstValue(row, ["供應商名稱", "供應商", "supplier"])),
    project: String(firstValue(row, ["專案名稱", "project"])),
    quotationNumber: String(firstValue(row, ["報價單號", "quotationNumber"])),
    quotationMode: String(firstValue(row, ["報價方式", "quotationMode"], "未稅")),
    taxRate: toNumber(firstValue(row, ["稅率", "taxRate"], 5)),
    materialSubtotal: toNumber(firstValue(row, ["材料小計", "materialSubtotal"])),
    tax: toNumber(firstValue(row, ["稅額", "tax"])),
    other: toNumber(firstValue(row, ["其他費用", "other"])),
    total: toNumber(firstValue(row, ["階段總成本", "含稅總成本", "total"])),
    quotationUrl: String(firstValue(row, ["估價單圖片URL", "原始圖片URL", "quotationUrl"])),
    quotationFileId: String(firstValue(row, ["估價單檔案ID", "quotationFileId"])),
    quotationFileName: String(firstValue(row, ["估價單檔名", "quotationFileName"])),
    aiStatus: String(firstValue(row, ["AI辨識狀態", "aiStatus"])),
    aiRawText: String(firstValue(row, ["AI辨識原文", "aiRawText"])),
    note: String(firstValue(row, ["備註", "note"])),
    createdAt: String(firstValue(row, ["建立時間", "createdAt"])),
    updatedAt: String(firstValue(row, ["更新時間", "updatedAt"])),
  };
}

function normalizeCostItem(row) {
  const qty = toNumber(firstValue(row, ["數量", "qty"]));
  const price = toNumber(firstValue(row, ["單價", "price"]));
  const subtotal = toNumber(firstValue(row, ["小計", "金額", "subtotal"]));
  return {
    id: String(firstValue(row, ["明細ID", "itemId", "id"])),
    costOrderId: String(firstValue(row, ["成本單ID", "costOrderId"])),
    index: firstValue(row, ["項次", "index"]),
    itemType: String(firstValue(row, ["品項類型", "itemType"], "材料")),
    name: String(firstValue(row, ["品項名稱", "品項", "name"])),
    spec: String(firstValue(row, ["規格", "規格/包裝", "規格／包裝", "spec"])),
    qty,
    unit: String(firstValue(row, ["單位", "unit"])),
    price,
    material: String(firstValue(row, ["材質", "material"])),
    thickness: String(firstValue(row, ["厚度", "thickness"])),
    fileName: String(firstValue(row, ["檔案名稱", "fileName"])),
    subtotal: subtotal || qty * price,
    areaId: String(firstValue(row, ["區域ID", "areaId"])),
    areaName: String(firstValue(row, ["安裝區域", "areaName"], "未指定")),
    areaStatus: String(firstValue(row, ["區域狀態", "areaStatus"], "未指定")),
    hotspot: String(firstValue(row, ["熱區座標", "hotspot"])),
    imageUrl: String(firstValue(row, ["品項圖片URL", "imageUrl"])),
    imageFileId: String(firstValue(row, ["品項圖片檔案ID", "imageFileId"])),
    note: String(firstValue(row, ["備註", "note"])),
  };
}

function normalizeMachineArea(row) {
  return {
    id: String(firstValue(row, ["區域ID", "areaId", "id"])),
    machineId: String(firstValue(row, ["機台ID", "machineId"])),
    name: String(firstValue(row, ["區域名稱", "areaName", "name"])),
    x: toNumber(firstValue(row, ["X百分比", "x"])),
    y: toNumber(firstValue(row, ["Y百分比", "y"])),
    width: toNumber(firstValue(row, ["寬度百分比", "width"])),
    height: toNumber(firstValue(row, ["高度百分比", "height"])),
    status: String(firstValue(row, ["區域狀態", "status"], "AI建議")),
    note: String(firstValue(row, ["備註", "note"])),
  };
}


function normalizeMachine360View(row) {
  return {
    id: String(firstValue(row, ["視圖ID", "viewId", "id"])),
    machineId: String(firstValue(row, ["機台ID", "machineId"])),
    viewKey: String(firstValue(row, ["視角代碼", "viewKey"])),
    viewName: String(firstValue(row, ["視角名稱", "viewName"])),
    angle: toNumber(firstValue(row, ["角度", "angle"])),
    imageUrl: String(firstValue(row, ["圖片URL", "imageUrl"])),
    imageFileId: String(firstValue(row, ["圖片檔案ID", "imageFileId"])),
    originalName: String(firstValue(row, ["原始檔名", "originalName"])),
    status: String(firstValue(row, ["圖片狀態", "status"], "基準圖")),
    createdAt: String(firstValue(row, ["建立時間", "createdAt"])),
    updatedAt: String(firstValue(row, ["更新時間", "updatedAt"])),
  };
}

function normalizeSupplier(row) {
  return {
    id: String(firstValue(row, ["供應商ID", "supplierId", "id"])),
    name: String(firstValue(row, ["供應商名稱", "供應商", "name"], "未命名供應商")),
    contact: String(firstValue(row, ["聯絡人", "contact"])),
    phone: String(firstValue(row, ["電話", "phone"])),
    email: String(firstValue(row, ["Email", "email"])),
    note: String(firstValue(row, ["備註", "note"])),
  };
}

function secureApiRequest(payload, options = {}) {
  if (!APPS_SCRIPT_URL || !APPS_SCRIPT_URL.includes("/exec")) {
    return Promise.reject(new Error("尚未設定 Apps Script 網址"));
  }

  const requestId = `igs-${Date.now()}-${Math.random().toString(36).slice(2, 9)}`;
  const includeToken = options.includeToken !== false;
  const requestPayload = {
    ...payload,
    requestId,
    origin: window.location.origin,
  };

  if (includeToken) requestPayload.token = authToken;

  return new Promise((resolve, reject) => {
    const iframeName = `igs-api-${Date.now()}-${Math.random().toString(36).slice(2, 7)}`;
    const iframe = document.createElement("iframe");
    iframe.name = iframeName;
    iframe.hidden = true;
    iframe.setAttribute("aria-hidden", "true");

    const form = document.createElement("form");
    form.method = "POST";
    form.action = APPS_SCRIPT_URL;
    form.target = iframeName;
    form.hidden = true;

    const field = document.createElement("input");
    field.type = "hidden";
    field.name = "payload";
    field.value = JSON.stringify(requestPayload);
    form.appendChild(field);

    let finished = false;

    const cleanup = () => {
      window.removeEventListener("message", onMessage);
      form.remove();
      iframe.remove();
    };

    const finish = (callback) => {
      if (finished) return;
      finished = true;
      clearTimeout(timeout);
      cleanup();
      callback();
    };

    const onMessage = (event) => {
      // Apps Script HTML Service 會把回應放在額外的沙箱 iframe 中，
      // 因此 event.source 不一定等於外層 iframe.contentWindow。
      // 改以 Google 回應網域、隨機 requestId 與固定 source 三重驗證。
      let trustedOrigin = false;
      try {
        const hostname = new URL(event.origin).hostname;
        trustedOrigin =
          hostname === "script.google.com" ||
          hostname === "script.googleusercontent.com" ||
          hostname.endsWith(".googleusercontent.com");
      } catch (error) {
        trustedOrigin = false;
      }

      if (!trustedOrigin) return;

      const data = event.data;
      if (!data || data.source !== API_MESSAGE_SOURCE || data.requestId !== requestId) return;

      finish(() => {
        if (data.ok) {
          resolve(data);
          return;
        }

        if (data.code === "AUTH_REQUIRED") {
          handleAuthenticationFailure(data.error);
        }

        reject(new Error(data.error || "伺服器沒有完成要求"));
      });
    };

    const timeout = setTimeout(() => {
      finish(() => reject(new Error("連線逾時，請稍後再試")));
    }, options.timeoutMs || 45000);

    iframe.addEventListener("error", () => {
      finish(() => reject(new Error("無法連線到 Apps Script")));
    });

    window.addEventListener("message", onMessage);
    document.body.append(iframe, form);
    form.submit();
  });
}

document.addEventListener("DOMContentLoaded", () => {
  setupAuthentication();
  setupNavigation();
  setupSearch();
  setupFilters();
  setupDialog();
  setupForms();
  setupQuotationPreview();
  setupDraftItems();
  setupMachine360();
  setupExport();
  setupSecureImageActions();
  $("quotationDate").value = todayValue();
  restoreAuthentication();
});

function setupAuthentication() {
  $("loginForm").addEventListener("submit", handleLoginSubmit);
  $("logoutButton").addEventListener("click", logoutErp);
}

async function restoreAuthentication() {
  lockErp();
  setDataStatus("等待登入", "");
  if (!authToken) return;

  setLoginBusy(true, "正在驗證登入…");
  try {
    await secureApiRequest(
      { action: "validateSession" },
      { includeToken: true, timeoutMs: 30000 }
    );
    unlockErp();
    await loadData();
  } catch (error) {
    clearAuthentication();
    showLoginError("登入已失效，請重新輸入密碼。");
  } finally {
    setLoginBusy(false);
  }
}

async function handleLoginSubmit(event) {
  event.preventDefault();
  const password = $("loginPassword").value;
  if (!password) return;

  hideLoginError();
  setLoginBusy(true, "登入驗證中…");

  try {
    const response = await secureApiRequest(
      { action: "login", password },
      { includeToken: false, timeoutMs: 30000 }
    );

    authToken = String(response.token || "");
    if (!authToken) throw new Error("伺服器沒有回傳登入憑證");

    sessionStorage.setItem(AUTH_TOKEN_KEY, authToken);
    $("loginPassword").value = "";
    unlockErp();
    await loadData();
  } catch (error) {
    clearAuthentication();
    showLoginError(error.message || "登入失敗");
    $("loginPassword").focus();
  } finally {
    setLoginBusy(false);
  }
}

function unlockErp() {
  authenticationReady = true;
  document.body.classList.remove("authLocked");
  $("authGate").hidden = true;
}

function lockErp() {
  authenticationReady = false;
  document.body.classList.add("authLocked");
  $("authGate").hidden = false;
}

async function logoutErp() {
  const currentToken = authToken;
  clearAuthentication();
  resetPrivateState();
  lockErp();
  $("loginPassword").value = "";
  hideNotice();
  setDataStatus("等待登入", "");
  window.scrollTo({ top: 0 });

  if (currentToken) {
    try {
      authToken = currentToken;
      await secureApiRequest({ action: "logout" }, { includeToken: true, timeoutMs: 15000 });
    } catch (error) {
      console.info("後端登出未完成：", error.message);
    } finally {
      clearAuthentication();
    }
  }

  setTimeout(() => $("loginPassword").focus(), 50);
}

function resetPrivateState() {
  state.machines = [];
  state.costOrders = [];
  state.costItems = [];
  state.suppliers = [];
  state.settings = [];
  state.machineAreas = [];
  state.machine360Views = [];
  state.machine360Draft = {};
  state.selectedMachineId = "";
  state.machineImagePayload = null;
  state.quotationDocumentPayload = null;
  state.selectedMachineStage = COST_TYPES[0];
  state.selectedMachineArea = "";
  state.quotationAiStatus = "未辨識";
  state.quotationRawText = "";
  secureImageCache.clear();
  renderAll();
}

function clearAuthentication() {
  authToken = "";
  authenticationReady = false;
  sessionStorage.removeItem(AUTH_TOKEN_KEY);
}

function setLoginBusy(isBusy, text = "登入 ERP") {
  const button = $("loginButton");
  button.disabled = isBusy;
  button.textContent = isBusy ? text : "登入 ERP";
  $("loginPassword").disabled = isBusy;
}

function showLoginError(message) {
  const errorBox = $("loginError");
  errorBox.textContent = message;
  errorBox.hidden = false;
}

function hideLoginError() {
  $("loginError").hidden = true;
}

function handleAuthenticationFailure(message) {
  clearAuthentication();
  resetPrivateState();
  lockErp();
  showLoginError(message || "登入已失效，請重新輸入密碼。");
  setDataStatus("等待登入", "");
  setTimeout(() => $("loginPassword").focus(), 50);
}

function setupNavigation() {
  document.querySelectorAll(".nav").forEach((button) => {
    button.addEventListener("click", () => {
      document.querySelectorAll(".nav").forEach((item) => item.classList.remove("active"));
      document.querySelectorAll(".view").forEach((view) => view.classList.remove("active"));
      button.classList.add("active");
      const viewId = button.dataset.view;
      $(viewId)?.classList.add("active");
      $("pageTitle").textContent = button.dataset.title || button.textContent.trim();
      $("pageDescription").textContent = pageDescriptions[viewId] || "";
      $("globalSearch").style.display = ["quotationEntry", "quickMachine", "machine360Setup"].includes(viewId) ? "none" : "block";
      window.scrollTo({ top: 0, behavior: "smooth" });
    });
  });
  $("reloadData").addEventListener("click", () => {
    if (authenticationReady && authToken) loadData();
  });
}

function setupSearch() {
  $("globalSearch").addEventListener("input", renderAll);
}

function setupFilters() {
  $("categoryFilter").addEventListener("change", renderMachineCards);
}

function setupDialog() {
  $("closeMachineDialog").addEventListener("click", () => $("machineDialog").close());
  $("machineDialog").addEventListener("click", (event) => {
    if (event.target === $("machineDialog")) $("machineDialog").close();
  });
}

function setupForms() {
  $("machineForm").addEventListener("submit", addMachineToStaged);
  $("resetMachineForm").addEventListener("click", resetMachineForm);
  $("machineImageFile").addEventListener("change", handleMachineImageSelection);
  $("clearMachineImage").addEventListener("click", clearMachineImage);
  $("machineStagedRows").addEventListener("click", handleMachineStagedClick);
  $("clearMachineStaged").addEventListener("click", clearMachineStaged);
  $("downloadMachineStaged").addEventListener("click", downloadMachineStagedCsv);
  $("submitMachineStaged").addEventListener("click", submitMachineStaged);
  renderMachineStaged();

  $("quotationForm").addEventListener("submit", handleCreateCostOrder);
  $("resetQuotationForm").addEventListener("click", resetQuotationForm);
  $("quotationMode").addEventListener("change", handleQuotationModeChange);
  $("quotationTaxRate").addEventListener("input", renderDraftSubtotal);
  $("quotationMachine").addEventListener("change", populateMachineAreaOptions);
  $("analyzeQuotation").addEventListener("click", analyzeQuotationDocument);
}

function handleQuotationModeChange() {
  const mode = $("quotationMode").value;
  const taxRate = $("quotationTaxRate");
  taxRate.disabled = mode === "不計稅";
  if (mode === "不計稅") taxRate.value = 0;
  if (mode !== "不計稅" && toNumber(taxRate.value) <= 0) taxRate.value = 5;
  renderDraftSubtotal();
}

function addMachineToStaged(event) {
  event.preventDefault();

  const machine = {
    code: $("machineCode").value.trim().toUpperCase(),
    name: $("machineName").value.trim(),
    category: $("machineCategory").value.trim(),
    image: state.machineImagePayload ? { ...state.machineImagePayload } : null,
    note: $("machineNote").value.trim(),
  };

  if (!machine.code || !machine.name || !machine.category) {
    showNotice("請填寫機台代碼、機台名稱與機台分類。", "warn");
    return;
  }

  const duplicateInSheet = state.machines.some(
    (item) => norm(item.code) === norm(machine.code)
  );
  if (duplicateInSheet) {
    showNotice(`機台代碼「${machine.code}」已存在於 Google Sheet。`, "warn");
    return;
  }

  const duplicateInStaging = state.stagedMachines.some(
    (item) => norm(item.code) === norm(machine.code)
  );
  if (duplicateInStaging) {
    showNotice(`機台代碼「${machine.code}」已在待送清單中。`, "warn");
    return;
  }

  state.stagedMachines.push(machine);
  saveStagedMachines();
  renderMachineStaged();
  resetMachineForm();
  showNotice(`已將「${machine.name}」加入待送清單。`);
}

async function handleMachineImageSelection(event) {
  const file = event.target.files?.[0];
  if (!file) return;
  try {
    state.machineImagePayload = await compressImageFile(file, 1200, 0.8);
    $("machineImagePreview").src = state.machineImagePayload.dataUrl;
    $("machineImageFileName").textContent = state.machineImagePayload.name;
    $("machineImagePreviewWrap").hidden = false;
  } catch (error) {
    clearMachineImage();
    showNotice(`機台圖片處理失敗：${error.message}`, "error");
  }
}

function clearMachineImage() {
  state.machineImagePayload = null;
  $("machineImageFile").value = "";
  $("machineImagePreview").removeAttribute("src");
  $("machineImagePreviewWrap").hidden = true;
}

function resetMachineForm() {
  $("machineForm").reset();
  clearMachineImage();
}
function handleMachineStagedClick(event) {
  const button = event.target.closest("[data-remove-machine]");
  if (!button) return;

  const index = Number(button.dataset.removeMachine);
  if (!Number.isInteger(index) || !state.stagedMachines[index]) return;

  const removed = state.stagedMachines.splice(index, 1)[0];
  saveStagedMachines();
  renderMachineStaged();
  showNotice(`已從待送清單移除「${removed.name}」。`);
}

function clearMachineStaged() {
  if (!state.stagedMachines.length) {
    showNotice("待送清單目前是空的。", "warn");
    return;
  }

  if (!window.confirm(`確定清除待送清單中的 ${state.stagedMachines.length} 筆機台嗎？`)) {
    return;
  }

  state.stagedMachines = [];
  saveStagedMachines();
  renderMachineStaged();
  showNotice("待送清單已清空。");
}

async function submitMachineStaged() {
  if (!state.stagedMachines.length) {
    showNotice("請先加入至少一筆機台資料。", "warn");
    return;
  }

  const button = $("submitMachineStaged");
  const originalText = button.textContent;
  button.disabled = true;
  button.textContent = "寫入中…";

  try {
    const response = await secureApiRequest(
      {
        action: "createMachines",
        machines: state.stagedMachines,
      },
      { includeToken: true, timeoutMs: 90000 }
    );

    const result = response.result || {};
    const count = toNumber(result.count) || (Array.isArray(result.machines) ? result.machines.length : 0);

    state.stagedMachines = [];
    saveStagedMachines();
    renderMachineStaged();
    await loadData();

    showNotice(`已成功寫入 ${count} 筆機台資料。`);
    const machineNav = document.querySelector('[data-view="machines"]');
    if (machineNav) machineNav.click();
  } catch (error) {
    showNotice(`寫入機台失敗：${error.message}`, "error");
  } finally {
    button.disabled = false;
    button.textContent = originalText;
  }
}

function renderMachineStaged() {
  const rows = $("machineStagedRows");
  const count = state.stagedMachines.length;
  $("machineStagingCount").textContent = `共 ${count} 筆；確認無誤後再寫入 Google Sheet。`;
  $("submitMachineStaged").disabled = count === 0;
  $("clearMachineStaged").disabled = count === 0;
  $("downloadMachineStaged").disabled = count === 0;

  if (!count) {
    rows.innerHTML = '<tr><td colspan="7" class="empty">尚未加入機台資料。</td></tr>';
    return;
  }

  rows.innerHTML = state.stagedMachines.map((machine, index) => `
    <tr>
      <td>${index + 1}</td>
      <td><strong>${escapeHTML(machine.code)}</strong></td>
      <td>${escapeHTML(machine.name)}</td>
      <td><span class="tag">${escapeHTML(machine.category)}</span></td>
      <td>${machine.image?.dataUrl ? `<img class="stageThumb" src="${escapeHTML(machine.image.dataUrl)}" alt="${escapeHTML(machine.name)}">` : '<span class="muted">無</span>'}</td>
      <td class="stageNote">${escapeHTML(machine.note || "")}</td>
      <td><button class="removeRow" type="button" data-remove-machine="${index}">刪除</button></td>
    </tr>
  `).join("");
}

function loadStagedMachines() {
  try {
    const stored = JSON.parse(localStorage.getItem(MACHINE_STAGING_KEY) || "[]");
    if (!Array.isArray(stored)) return [];
    return stored
      .filter((item) => item && typeof item === "object")
      .map((item) => ({
        code: String(item.code || "").trim().toUpperCase(),
        name: String(item.name || "").trim(),
        category: String(item.category || "").trim(),
        image: item.image && typeof item.image === "object" ? {
          name: String(item.image.name || "image.jpg"),
          mimeType: String(item.image.mimeType || "image/jpeg"),
          base64: String(item.image.base64 || ""),
          dataUrl: item.image.base64 ? `data:${item.image.mimeType || "image/jpeg"};base64,${item.image.base64}` : "",
        } : null,
        note: String(item.note || "").trim(),
      }))
      .filter((item) => item.code && item.name && item.category);
  } catch (error) {
    console.warn("無法讀取機台待送清單：", error);
    return [];
  }
}

function saveStagedMachines() {
  const serializable = state.stagedMachines.map((machine) => ({
    code: machine.code,
    name: machine.name,
    category: machine.category,
    note: machine.note,
    image: machine.image ? {
      name: machine.image.name,
      mimeType: machine.image.mimeType,
      base64: machine.image.base64,
    } : null,
  }));
  try {
    localStorage.setItem(MACHINE_STAGING_KEY, JSON.stringify(serializable));
  } catch (error) {
    console.warn("待送清單無法完整保存到瀏覽器：", error);
    showNotice("待送清單圖片較多，重新整理前請先寫入 Google Sheet。", "warn");
  }
}

function downloadMachineStagedCsv() {
  if (!state.stagedMachines.length) {
    showNotice("待送清單目前是空的。", "warn");
    return;
  }

  const rows = [
    ["機台代碼", "機台名稱", "機台分類", "機台圖片檔名", "備註"],
    ...state.stagedMachines.map((machine) => [
      machine.code,
      machine.name,
      machine.category,
      machine.image?.name || "",
      machine.note,
    ]),
  ];

  downloadCsv(rows, `IGS_機台待送清單_${todayValue()}.csv`);
}

function setupQuotationPreview() {
  $("quotationFile").addEventListener("change", async (event) => {
    const file = event.target.files?.[0];
    if (!file) return;
    try {
      state.quotationDocumentPayload = await prepareQuotationDocument(file);
      $("quotationFileName").textContent = state.quotationDocumentPayload.name;
      $("quotationPreviewWrap").hidden = false;

      const isPdf = state.quotationDocumentPayload.mimeType === "application/pdf";
      $("quotationPreview").hidden = isPdf;
      $("quotationPdfPreview").hidden = !isPdf;
      if (isPdf) {
        $("quotationPdfPreview").src = state.quotationDocumentPayload.dataUrl;
        $("quotationPreview").removeAttribute("src");
      } else {
        $("quotationPreview").src = state.quotationDocumentPayload.dataUrl;
        $("quotationPdfPreview").removeAttribute("src");
      }

      $("analyzeQuotation").disabled = false;
      setQuotationAiStatus(`${isPdf ? "PDF" : "圖片"}已準備完成，可進行 AI 智慧辨識。`, "ready");
    } catch (error) {
      clearQuotationDocument();
      showNotice(`估價單檔案處理失敗：${error.message}`, "error");
    }
  });
  $("clearQuotation").addEventListener("click", clearQuotationDocument);
}

function clearQuotationDocument() {
  state.quotationDocumentPayload = null;
  state.quotationAiStatus = "未辨識";
  state.quotationRawText = "";
  $("quotationFile").value = "";
  $("quotationPreview").removeAttribute("src");
  $("quotationPdfPreview").removeAttribute("src");
  $("quotationPreview").hidden = true;
  $("quotationPdfPreview").hidden = true;
  $("quotationPreviewWrap").hidden = true;
  $("analyzeQuotation").disabled = true;
  $("quotationRawText").value = "";
  $("quotationAiBadge").textContent = "尚未辨識";
  setQuotationAiStatus("尚未選擇估價單檔案");
}

// 保留舊函式名稱，避免舊快取事件呼叫失敗。
function clearQuotationImage() {
  clearQuotationDocument();
}

async function analyzeQuotationDocument() {
  if (!state.quotationDocumentPayload) {
    showNotice("請先上傳估價單圖片或 PDF。", "warn");
    return;
  }

  const button = $("analyzeQuotation");
  const originalText = button.textContent;
  button.disabled = true;
  button.textContent = "AI 辨識中…";
  setQuotationAiStatus("Gemini 正在讀取估價單；模型忙碌時會自動重試，請稍候…", "loading");

  try {
    const machineImage = await getSelectedMachineImagePayload();
    const response = await secureApiRequest({
      action: "analyzeQuotation",
      document: stripDataUrl(state.quotationDocumentPayload),
      machineImage,
    }, { includeToken: true, timeoutMs: 240000 });
    const result = response.result || {};
    applyQuotationAnalysis(result);
    state.quotationAiStatus = "已辨識";
    $("quotationAiBadge").textContent = "AI 已辨識，待人工確認";
    setQuotationAiStatus(`辨識完成，共帶入 ${state.draftItems.length} 筆明細。安裝區域若無足夠依據會保留「未指定」。`, "success");
    showNotice("AI 已先填入可辨識資料；請確認後再寫入 Google Sheet。");
  } catch (error) {
    state.quotationAiStatus = "辨識失敗";
    $("quotationAiBadge").textContent = "辨識失敗";
    setQuotationAiStatus(`AI 辨識失敗：${error.message}`, "error");
    showNotice(`AI 辨識失敗：${error.message}。仍可手動建檔。`, "error");
  } finally {
    button.disabled = false;
    button.textContent = originalText;
  }
}

// 保留舊函式名稱。
function analyzeQuotationImage() {
  return analyzeQuotationDocument();
}

async function getSelectedMachineImagePayload() {
  const machine = machineById($("quotationMachine").value);
  if (!machine?.imageFileId) return null;
  try {
    const response = await secureApiRequest(
      { action: "getImageData", fileId: machine.imageFileId },
      { includeToken: true, timeoutMs: 60000 }
    );
    const result = response.result || {};
    if (!String(result.mimeType || "").startsWith("image/")) return null;
    return {
      name: String(result.name || "machine.jpg"),
      mimeType: String(result.mimeType || "image/jpeg"),
      base64: String(result.base64 || ""),
    };
  } catch (error) {
    console.info("無法附加機台圖片供 AI 比對：", error.message);
    return null;
  }
}

function applyQuotationAnalysis(result) {
  if (result.date) $("quotationDate").value = normalizeDate(result.date);
  if (result.supplier) $("quotationSupplier").value = String(result.supplier);
  if (result.project) $("quotationProject").value = String(result.project);
  if (result.quotationNumber) $("quotationNumber").value = String(result.quotationNumber);
  if (["未稅", "含稅", "不計稅"].includes(String(result.quotationMode || ""))) {
    $("quotationMode").value = String(result.quotationMode);
  }
  if (toNumber(result.taxRate) >= 0) $("quotationTaxRate").value = toNumber(result.taxRate);
  if (result.note) $("quotationNote").value = String(result.note);
  state.quotationRawText = String(result.rawText || "");
  $("quotationRawText").value = state.quotationRawText;

  const materialItems = Array.isArray(result.items) ? result.items : [];
  const feeItems = Array.isArray(result.otherFees) ? result.otherFees : [];
  const rows = [
    ...materialItems.map((item) => ({
      itemType: "材料",
      name: String(item.name || ""),
      spec: String(item.spec || ""),
      qty: toNumber(item.qty) || 1,
      unit: String(item.unit || ""),
      price: toNumber(item.price),
      material: String(item.material || ""),
      thickness: String(item.thickness || ""),
      fileName: String(item.fileName || ""),
      areaName: String(item.areaName || "未指定") || "未指定",
      areaStatus: ["AI建議", "已確認"].includes(String(item.areaStatus || "")) ? String(item.areaStatus) : "未指定",
      hotspot: normalizeHotspotValue(item.areaBox || item.hotspot),
      note: String(item.note || ""),
      image: null,
      confidence: toNumber(item.confidence),
    })),
    ...feeItems.map((fee) => ({
      ...emptyDraftItem("附加費用"),
      name: String(fee.name || "其他費用"),
      price: toNumber(fee.amount),
      note: String(fee.note || ""),
    })),
  ];

  if (rows.length) {
    state.draftItems = rows;
    renderDraftItems();
  }
  handleQuotationModeChange();
}

function normalizeHotspotValue(value) {
  if (!value) return "";
  if (typeof value === "string") return value;
  const x = toNumber(value.x);
  const y = toNumber(value.y);
  const width = toNumber(value.width);
  const height = toNumber(value.height);
  if (width <= 0 || height <= 0) return "";
  return [x, y, width, height].join(",");
}

function setQuotationAiStatus(message, type = "") {
  const element = $("quotationAiStatus");
  element.textContent = message;
  element.className = `photoStatus muted ${type}`.trim();
}
function setupDraftItems() {
  $("addDraftItem").addEventListener("click", () => {
    state.draftItems.push(emptyDraftItem("材料"));
    renderDraftItems();
  });
  $("addFeeItem").addEventListener("click", () => {
    state.draftItems.push(emptyDraftItem("附加費用"));
    renderDraftItems();
  });
  $("draftItemRows").addEventListener("input", handleDraftRowInput);
  $("draftItemRows").addEventListener("change", (event) => {
    if (event.target.matches("[data-item-image]")) {
      handleDraftItemImageChange(event);
      return;
    }
    handleDraftRowInput(event);
  });
  $("draftItemRows").addEventListener("click", (event) => {
    const remove = event.target.closest("[data-remove]");
    if (remove) {
      state.draftItems.splice(Number(remove.dataset.remove), 1);
      if (!state.draftItems.length) state.draftItems.push(emptyDraftItem("材料"));
      renderDraftItems();
      return;
    }
    const clearImage = event.target.closest("[data-clear-item-image]");
    if (clearImage) {
      const item = state.draftItems[Number(clearImage.dataset.clearItemImage)];
      if (item) item.image = null;
      renderDraftItems();
    }
  });
  state.draftItems = [emptyDraftItem("材料")];
  renderDraftItems();
}

function handleDraftRowInput(event) {
  const input = event.target.closest("[data-field]");
  const row = event.target.closest("[data-index]");
  if (!input || !row) return;
  const item = state.draftItems[Number(row.dataset.index)];
  if (!item) return;
  const field = input.dataset.field;
  item[field] = ["qty", "price"].includes(field) ? toNumber(input.value) : input.value;

  if (field === "itemType" && item.itemType === "附加費用") {
    item.qty = 1;
    item.unit = "";
    item.spec = "";
    item.material = "";
    item.thickness = "";
    item.fileName = "";
    item.areaName = "未指定";
    item.areaStatus = "未指定";
    item.hotspot = "";
    item.image = null;
    renderDraftItems();
    return;
  }

  renderDraftSubtotal();
  if (["qty", "price"].includes(field)) {
    const subtotalCell = row.querySelector("[data-subtotal]");
    if (subtotalCell) subtotalCell.textContent = money(item.qty * item.price);
  }
}

function emptyDraftItem(itemType = "材料") {
  return {
    itemType,
    name: "",
    spec: "",
    qty: 1,
    unit: "",
    price: 0,
    material: "",
    thickness: "",
    fileName: "",
    areaName: "未指定",
    areaStatus: "未指定",
    hotspot: "",
    note: "",
    image: null,
    confidence: 0,
  };
}

async function handleDraftItemImageChange(event) {
  const input = event.target.closest("[data-item-image]");
  if (!input) return;
  const index = Number(input.dataset.itemImage);
  const file = input.files?.[0];
  if (!file || !state.draftItems[index]) return;
  try {
    state.draftItems[index].image = await compressImageFile(file, 1100, 0.8);
    renderDraftItems();
  } catch (error) {
    showNotice(`品項圖片處理失敗：${error.message}`, "error");
  }
}
async function handleCreateCostOrder(event) {
  event.preventDefault();

  const validItems = state.draftItems.filter((item) => String(item.name || "").trim());
  if (!validItems.length) {
    showNotice("請至少填寫一個材料或附加費用。", "warn");
    return;
  }
  if (!$("quotationMachine").value) {
    showNotice("請先選擇成本要歸入的機台。", "warn");
    return;
  }

  const invalidItem = validItems.find((item) =>
    item.itemType === "材料"
      ? toNumber(item.qty) <= 0 || toNumber(item.price) < 0
      : toNumber(item.price) < 0
  );
  if (invalidItem) {
    showNotice(`品項「${invalidItem.name}」的數量或金額不正確。`, "warn");
    return;
  }

  const button = $("submitCostOrder");
  const originalText = button.textContent;
  button.disabled = true;
  button.textContent = "檔案上傳與寫入中…";

  try {
    const response = await secureApiRequest({
      action: "createCostOrder",
      order: {
        machineId: $("quotationMachine").value,
        type: $("quotationType").value,
        date: $("quotationDate").value,
        supplier: $("quotationSupplier").value.trim(),
        project: $("quotationProject").value.trim(),
        quotationNumber: $("quotationNumber").value.trim(),
        quotationMode: $("quotationMode").value,
        taxRate: toNumber($("quotationTaxRate").value),
        note: $("quotationNote").value.trim(),
        aiStatus: state.quotationAiStatus === "已辨識" ? "人工確認" : state.quotationAiStatus,
        aiRawText: state.quotationRawText,
        quotationFile: state.quotationDocumentPayload ? stripDataUrl(state.quotationDocumentPayload) : null,
      },
      items: validItems.map((item) => ({
        itemType: item.itemType === "附加費用" ? "附加費用" : "材料",
        name: String(item.name || "").trim(),
        spec: String(item.spec || "").trim(),
        qty: item.itemType === "附加費用" ? 1 : toNumber(item.qty),
        unit: String(item.unit || "").trim(),
        price: toNumber(item.price),
        material: String(item.material || "").trim(),
        thickness: String(item.thickness || "").trim(),
        fileName: String(item.fileName || "").trim(),
        areaName: String(item.areaName || "未指定").trim() || "未指定",
        areaStatus: String(item.areaStatus || "未指定").trim() || "未指定",
        hotspot: String(item.hotspot || "").trim(),
        note: String(item.note || "").trim(),
        image: item.image ? stripDataUrl(item.image) : null,
      })),
    }, { includeToken: true, timeoutMs: 300000 });

    const result = response.result || {};
    showNotice(`成本單 ${result.costOrderId || ""} 已建立，共 ${result.itemCount || validItems.length} 筆明細，總成本 ${money(result.total)}。`);
    resetQuotationForm();
    await loadData();
    document.querySelector('[data-view="costRecords"]')?.click();
  } catch (error) {
    showNotice(`成本資料寫入失敗：${error.message}`, "error");
  } finally {
    button.disabled = false;
    button.textContent = originalText;
  }
}

function resetQuotationForm() {
  const machineValue = $("quotationMachine").value;
  $("quotationForm").reset();
  if ([...$("quotationMachine").options].some((option) => option.value === machineValue)) {
    $("quotationMachine").value = machineValue;
  }
  $("quotationDate").value = todayValue();
  $("quotationMode").value = "未稅";
  $("quotationTaxRate").value = 5;
  state.draftItems = [emptyDraftItem("材料")];
  state.quotationRawText = "";
  clearQuotationDocument();
  populateMachineAreaOptions();
  renderDraftItems();
  handleQuotationModeChange();
}

function stripDataUrl(payload) {
  if (!payload) return null;
  return {
    name: String(payload.name || "file"),
    mimeType: String(payload.mimeType || "application/octet-stream"),
    base64: String(payload.base64 || ""),
  };
}

async function prepareQuotationDocument(file) {
  const type = String(file?.type || "").toLowerCase();
  const extension = String(file?.name || "").toLowerCase().split(".").pop();
  const isPdf = type === "application/pdf" || extension === "pdf";
  const isImage = ["image/jpeg", "image/png", "image/webp"].includes(type) || ["jpg", "jpeg", "png", "webp"].includes(extension);

  if (!isPdf && !isImage) {
    throw new Error("估價單僅支援 JPG、JPEG、PNG、WebP 或 PDF，不支援 Word");
  }

  if (isPdf) {
    if (file.size > 10 * 1024 * 1024) {
      throw new Error("PDF 不可超過 10 MB");
    }
    const dataUrl = await readFileAsDataUrl(file);
    return {
      name: String(file.name || "quotation.pdf"),
      mimeType: "application/pdf",
      base64: dataUrl.split(",")[1] || "",
      dataUrl,
    };
  }

  return compressImageFile(file, 1800, 0.86);
}

async function compressImageFile(file, maxSide = 1400, quality = 0.82) {
  if (!file || !String(file.type || "").startsWith("image/")) {
    throw new Error("請選擇 JPG、PNG 或 WebP 圖片");
  }
  if (file.size > 15 * 1024 * 1024) {
    throw new Error("原始圖片不可超過 15 MB");
  }
  const source = await readFileAsDataUrl(file);
  const image = await loadBrowserImage(source);
  const width0 = image.naturalWidth || image.width;
  const height0 = image.naturalHeight || image.height;
  const scale = Math.min(1, maxSide / Math.max(width0, height0));
  const canvas = document.createElement("canvas");
  canvas.width = Math.max(1, Math.round(width0 * scale));
  canvas.height = Math.max(1, Math.round(height0 * scale));
  const context = canvas.getContext("2d", { alpha: false });
  context.fillStyle = "#fff";
  context.fillRect(0, 0, canvas.width, canvas.height);
  context.drawImage(image, 0, 0, canvas.width, canvas.height);
  const dataUrl = canvas.toDataURL("image/jpeg", quality);
  const base64 = dataUrl.split(",")[1] || "";
  if (base64.length * 0.75 > 4.5 * 1024 * 1024) {
    throw new Error("壓縮後圖片仍過大，請改用尺寸較小的圖片");
  }
  return {
    name: String(file.name || "image.jpg").replace(/\.[^.]+$/, "") + ".jpg",
    mimeType: "image/jpeg",
    base64,
    dataUrl,
  };
}

function readFileAsDataUrl(file) {
  return new Promise((resolve, reject) => {
    const reader = new FileReader();
    reader.onload = () => resolve(String(reader.result || ""));
    reader.onerror = () => reject(new Error("無法讀取檔案"));
    reader.readAsDataURL(file);
  });
}

function loadBrowserImage(src) {
  return new Promise((resolve, reject) => {
    const image = new Image();
    image.onload = () => resolve(image);
    image.onerror = () => reject(new Error("瀏覽器無法開啟這張圖片"));
    image.src = src;
  });
}

function setupSecureImageActions() {
  document.addEventListener("click", (event) => {
    const button = event.target.closest("[data-view-file]");
    if (!button) return;
    viewPrivateImage(button.dataset.viewFile, button.dataset.fileName || "IGS 圖片");
  });
}

async function hydrateSecureImages(root = document) {
  const images = [...root.querySelectorAll("img[data-secure-file-id]")];
  await Promise.all(images.map(async (img) => {
    const fileId = img.dataset.secureFileId;
    if (!fileId || img.dataset.secureLoaded === "1") return;
    img.dataset.secureLoaded = "1";
    try {
      img.src = await getPrivateImageDataUrl(fileId);
    } catch (error) {
      img.alt = "圖片讀取失敗";
    }
  }));
}

async function getPrivateFileData(fileId) {
  if (secureImageCache.has(fileId)) return secureImageCache.get(fileId);
  const response = await secureApiRequest({ action: "getImageData", fileId }, { includeToken: true, timeoutMs: 60000 });
  const result = response.result || {};
  const fileData = {
    name: String(result.name || "IGS 檔案"),
    mimeType: String(result.mimeType || "application/octet-stream"),
    base64: String(result.base64 || ""),
  };
  fileData.dataUrl = `data:${fileData.mimeType};base64,${fileData.base64}`;
  secureImageCache.set(fileId, fileData);
  return fileData;
}

async function getPrivateImageDataUrl(fileId) {
  const file = await getPrivateFileData(fileId);
  return file.dataUrl;
}

async function viewPrivateImage(fileId, title) {
  const viewer = window.open("", "_blank");
  try {
    const file = await getPrivateFileData(fileId);
    if (viewer) {
      viewer.document.title = title;
      viewer.document.body.style.margin = "0";
      viewer.document.body.style.background = "#111";
      if (file.mimeType === "application/pdf") {
        viewer.document.body.innerHTML = `<iframe src="${file.dataUrl}" title="${escapeHTML(title)}" style="width:100vw;height:100vh;border:0;background:#fff"></iframe>`;
      } else {
        viewer.document.body.innerHTML = `<img src="${file.dataUrl}" alt="${escapeHTML(title)}" style="display:block;max-width:100%;max-height:100vh;margin:auto;object-fit:contain">`;
      }
    }
  } catch (error) {
    if (viewer) viewer.close();
    showNotice(`檔案讀取失敗：${error.message}`, "error");
  }
}


const MACHINE_360_VIEW_CONFIG = Object.freeze({
  FRONT: { label: "正面", angle: 0, inputId: "machine360FrontFile", previewId: "machine360FrontPreview", nameId: "machine360FrontName" },
  RIGHT45: { label: "右 45°", angle: 45, inputId: "machine360Right45File", previewId: "machine360Right45Preview", nameId: "machine360Right45Name" },
  BACK: { label: "背面", angle: 180, inputId: "machine360BackFile", previewId: "machine360BackPreview", nameId: "machine360BackName" },
  LEFT45: { label: "左 45°", angle: 315, inputId: "machine360Left45File", previewId: "machine360Left45Preview", nameId: "machine360Left45Name" },
});

function setupMachine360() {
  const machineSelect = $("machine360Machine");
  if (!machineSelect) return;
  machineSelect.addEventListener("change", () => {
    state.machine360Draft = {};
    renderMachine360Setup();
  });
  document.querySelectorAll("[data-machine360-view]").forEach((input) => {
    input.addEventListener("change", handleMachine360FileSelection);
  });
  document.querySelectorAll("[data-clear-360]").forEach((button) => {
    button.addEventListener("click", () => clearMachine360Draft(button.dataset.clear360));
  });
  $("saveMachine360Views").addEventListener("click", saveMachine360Views);
  renderMachine360Setup();
}

function machine360ViewsForMachine(machineId) {
  return state.machine360Views.filter((view) => view.machineId === machineId);
}

function existingMachine360View(machineId, viewKey) {
  return state.machine360Views.find((view) => view.machineId === machineId && view.viewKey === viewKey) || null;
}

async function handleMachine360FileSelection(event) {
  const input = event.currentTarget;
  const viewKey = input.dataset.machine360View;
  const file = input.files?.[0];
  if (!viewKey || !file) return;
  try {
    const payload = await compressImageFile(file, 2000, 0.88);
    state.machine360Draft[viewKey] = payload;
    renderMachine360Setup();
  } catch (error) {
    input.value = "";
    showNotice(`角度圖片讀取失敗：${error.message}`, "error");
  }
}

function clearMachine360Draft(viewKey) {
  const config = MACHINE_360_VIEW_CONFIG[viewKey];
  if (!config) return;
  delete state.machine360Draft[viewKey];
  const input = $(config.inputId);
  if (input) input.value = "";
  renderMachine360Setup();
}

async function renderMachine360Setup() {
  const machineSelect = $("machine360Machine");
  if (!machineSelect) return;
  const machineId = machineSelect.value || "";
  const existingViews = machine360ViewsForMachine(machineId);
  let completed = 0;

  for (const [viewKey, config] of Object.entries(MACHINE_360_VIEW_CONFIG)) {
    const preview = $(config.previewId);
    const name = $(config.nameId);
    const card = document.querySelector(`.viewUploadCard[data-view-key="${viewKey}"]`);
    const placeholder = card?.querySelector(".viewDropPlaceholder");
    const draft = state.machine360Draft[viewKey];
    const existing = existingViews.find((view) => view.viewKey === viewKey);
    card?.classList.toggle("hasImage", Boolean(draft || existing));

    if (draft) {
      preview.src = draft.dataUrl;
      preview.hidden = false;
      if (placeholder) placeholder.hidden = true;
      name.textContent = `${draft.name}（尚未儲存）`;
      completed += 1;
      continue;
    }

    if (existing?.imageFileId) {
      preview.hidden = false;
      if (placeholder) placeholder.hidden = true;
      name.textContent = existing.originalName || `${config.label}基準圖`;
      if (preview.dataset.fileId !== existing.imageFileId) {
        preview.dataset.fileId = existing.imageFileId;
        preview.removeAttribute("src");
        try {
          preview.src = await getPrivateImageDataUrl(existing.imageFileId);
        } catch (error) {
          preview.hidden = true;
          if (placeholder) {
            placeholder.hidden = false;
            placeholder.textContent = "圖片讀取失敗，請重新上傳";
          }
        }
      }
      completed += 1;
      continue;
    }

    preview.hidden = true;
    preview.removeAttribute("src");
    delete preview.dataset.fileId;
    if (placeholder) {
      placeholder.hidden = false;
      placeholder.textContent = `＋ 上傳${config.label}圖`;
    }
    name.textContent = "尚未上傳";
  }

  const percent = Math.round((completed / 4) * 100);
  $("machine360ProgressText").textContent = `${completed} / 4`;
  $("machine360ProgressBar").style.width = `${percent}%`;
  const badge = $("machine360CompletionBadge");
  badge.textContent = machineId ? (completed === 4 ? "四張基準圖已完成" : `已完成 ${completed} / 4 張`) : "尚未選擇機台";
  badge.classList.toggle("connected", completed === 4);
  $("machine360Status").textContent = machineId
    ? (completed === 4 ? "基準角度已齊全，下一階段可建立 AI 旋轉草稿。" : "可先儲存目前已有的圖片，之後再補齊其餘角度。")
    : "請先選擇機台，再上傳至少一張基準圖。";
}

async function saveMachine360Views() {
  const machineId = $("machine360Machine").value;
  if (!machineId) {
    showNotice("請先選擇要綁定的機台。", "warn");
    return;
  }
  const views = Object.entries(state.machine360Draft).map(([viewKey, image]) => ({
    viewKey,
    image: stripDataUrl(image),
  }));
  if (!views.length) {
    showNotice("目前沒有新選擇的角度圖片。", "warn");
    return;
  }

  const button = $("saveMachine360Views");
  button.disabled = true;
  button.textContent = "正在儲存…";
  $("machine360Status").textContent = "正在將基準圖保存到私人 Google Drive…";
  try {
    const response = await secureApiRequest(
      { action: "saveMachine360Views", machineId, views },
      { includeToken: true, timeoutMs: 120000 }
    );
    const saved = (response.result?.views || []).map(normalizeMachine360View);
    const savedKeys = new Set(saved.map((view) => `${view.machineId}|${view.viewKey}`));
    state.machine360Views = state.machine360Views.filter((view) => !savedKeys.has(`${view.machineId}|${view.viewKey}`));
    state.machine360Views.push(...saved);
    state.machine360Draft = {};
    Object.values(MACHINE_360_VIEW_CONFIG).forEach((config) => {
      const input = $(config.inputId);
      if (input) input.value = "";
    });
    await renderMachine360Setup();
    showNotice(`已儲存 ${saved.length} 張基準角度圖。`, "success");
  } catch (error) {
    showNotice(`基準角度圖儲存失敗：${error.message}`, "error");
    $("machine360Status").textContent = "儲存失敗，圖片仍保留在目前頁面，可修正後重試。";
  } finally {
    button.disabled = false;
    button.textContent = "儲存基準角度圖";
  }
}

function setupExport() {
  $("exportCostsCsv").addEventListener("click", () => {
    const rows = filteredCostOrders();
    if (!rows.length) {
      showNotice("目前沒有可匯出的成本紀錄。", "warn");
      return;
    }
    const header = ["日期", "機台", "費用類型", "供應商", "報價單號", "報價方式", "稅率", "專案名稱", "材料小計", "附加費用", "稅額", "階段總成本", "估價單檔案URL"];
    const body = rows.map((order) => {
      const machine = machineById(order.machineId);
      return [order.date, machine?.name || order.machineId, order.type, order.supplier, order.quotationNumber, order.quotationMode, order.taxRate, order.project, order.materialSubtotal, order.other, order.tax, orderTotal(order), order.quotationUrl];
    });
    downloadCsv([header, ...body], "IGS_成本紀錄.csv");
  });
}

async function loadData() {
  if (!authenticationReady || !authToken) return;

  setDataStatus("私人資料讀取中", "");
  showNotice("正在安全讀取 Google Sheet…");

  try {
    const response = await secureApiRequest(
      { action: "readData" },
      { includeToken: true, timeoutMs: 60000 }
    );

    const result = response.result || {};
    state.machines = (Array.isArray(result.machines) ? result.machines : []).map(normalizeMachine);
    state.settings = Array.isArray(result.settings) ? result.settings : [];
    state.costOrders = (Array.isArray(result.costOrders) ? result.costOrders : []).map(normalizeCostOrder);
    state.costItems = (Array.isArray(result.costItems) ? result.costItems : []).map(normalizeCostItem);
    state.suppliers = (Array.isArray(result.suppliers) ? result.suppliers : []).map(normalizeSupplier);
    state.machineAreas = (Array.isArray(result.machineAreas) ? result.machineAreas : []).map(normalizeMachineArea);
    state.machine360Views = (Array.isArray(result.machine360Views) ? result.machine360Views : []).map(normalizeMachine360View);

    populateControls();
    renderAll();
    setDataStatus("私人 Google Sheet 已同步", "ok");
    hideNotice();
  } catch (error) {
    if (!authenticationReady) return;
    console.error(error);
    resetPrivateState();
    populateControls();
    setDataStatus("資料讀取失敗", "error");
    showNotice(`私人 Google Sheet 讀取失敗：${error.message}`, "error");
  }
}

function populateControls() {
  const categories = state.settings
    .filter((row) => String(row["設定類型"] || row.type || "") === "機台分類")
    .filter((row) => String(row["使用中"] || row.active || "是") !== "否")
    .sort((a, b) => toNumber(a["排序"] || a.order) - toNumber(b["排序"] || b.order))
    .map((row) => String(row["設定值"] || row.value || ""))
    .filter(Boolean);
  const categoryList = categories.length ? categories : FALLBACK_CATEGORIES;

  fillSelect("categoryFilter", categoryList, true, "全部分類");
  fillSelect("machineCategory", categoryList, false);

  const machineOptions = state.machines.map((machine) => ({ value: machine.id, label: `${machine.name}${machine.code ? `（${machine.code}）` : ""}` }));
  const quotationMachine = $("quotationMachine");
  quotationMachine.innerHTML = machineOptions.length
    ? machineOptions.map((item) => `<option value="${escapeHTML(item.value)}">${escapeHTML(item.label)}</option>`).join("")
    : '<option value="">請先建立機台</option>';

  const machine360Machine = $("machine360Machine");
  if (machine360Machine) {
    const current360 = machine360Machine.value;
    machine360Machine.innerHTML = machineOptions.length
      ? machineOptions.map((item) => `<option value="${escapeHTML(item.value)}">${escapeHTML(item.label)}</option>`).join("")
      : '<option value="">請先建立機台</option>';
    if ([...machine360Machine.options].some((option) => option.value === current360)) machine360Machine.value = current360;
    renderMachine360Setup();
  }

  const supplierNames = unique([
    ...state.suppliers.map((supplier) => supplier.name),
    ...state.costOrders.map((order) => order.supplier),
  ]).filter(Boolean);
  $("supplierOptions").innerHTML = supplierNames.map((name) => `<option value="${escapeHTML(name)}"></option>`).join("");
  populateMachineAreaOptions();
}

function areasForMachine(machineId) {
  const saved = state.machineAreas
    .filter((area) => area.machineId === machineId && area.name)
    .map((area) => area.name);
  const orderIds = state.costOrders.filter((order) => order.machineId === machineId).map((order) => order.id);
  const fromItems = state.costItems
    .filter((item) => orderIds.includes(item.costOrderId))
    .map((item) => item.areaName)
    .filter((name) => name && name !== "未指定");
  return unique([...saved, ...fromItems]);
}

function populateMachineAreaOptions() {
  const machineId = $("quotationMachine")?.value || "";
  const areas = areasForMachine(machineId);
  if ($("machineAreaOptions")) {
    $("machineAreaOptions").innerHTML = areas.map((name) => `<option value="${escapeHTML(name)}"></option>`).join("");
  }
}

function fillSelect(id, values, includeAll, allLabel = "全部") {
  const select = $(id);
  const current = select.value;
  const options = includeAll ? [`<option value="">${escapeHTML(allLabel)}</option>`] : [];
  options.push(...values.map((value) => `<option value="${escapeHTML(value)}">${escapeHTML(value)}</option>`));
  select.innerHTML = options.join("");
  if ([...select.options].some((option) => option.value === current)) select.value = current;
}

function renderAll() {
  renderDashboard();
  renderMachineCards();
  renderCostRecords();
  renderMachineTotals();
  renderSuppliers();
}

function searchKeyword() {
  return norm($("globalSearch").value);
}

function machineSearchText(machine) {
  const orderIds = state.costOrders.filter((order) => order.machineId === machine.id).map((order) => order.id);
  const items = state.costItems.filter((item) => orderIds.includes(item.costOrderId));
  return [machine.id, machine.code, machine.name, machine.category, machine.note, ...items.flatMap((item) => [item.name, item.spec, item.note])].join(" ");
}

function filteredMachines() {
  const keyword = searchKeyword();
  const category = $("categoryFilter")?.value || "";
  return state.machines.filter((machine) => {
    const keywordMatch = !keyword || norm(machineSearchText(machine)).includes(keyword);
    const categoryMatch = !category || machine.category === category;
    return keywordMatch && categoryMatch;
  });
}

function filteredCostOrders() {
  const keyword = searchKeyword();
  return state.costOrders.filter((order) => {
    const machine = machineById(order.machineId);
    const text = [order.date, order.type, order.supplier, order.project, order.note, machine?.name, machine?.code, machine?.category].join(" ");
    return !keyword || norm(text).includes(keyword);
  });
}

function renderDashboard() {
  $("statMachines").textContent = state.machines.length.toLocaleString("zh-TW");
  $("statCostOrders").textContent = state.costOrders.length.toLocaleString("zh-TW");
  $("statItems").textContent = unique(state.costItems.map((item) => item.name).filter(Boolean)).length.toLocaleString("zh-TW");
  $("statSuppliers").textContent = unique([...state.suppliers.map((supplier) => supplier.name), ...state.costOrders.map((order) => order.supplier)].filter(Boolean)).length.toLocaleString("zh-TW");
  const actualTotal = state.costOrders.filter((order) => order.type === "實際費用").reduce((sum, order) => sum + orderTotal(order), 0);
  $("statActualTotal").textContent = money(actualTotal);

  const recent = [...state.machines]
    .sort((a, b) => dateValue(b.updatedAt || b.createdAt) - dateValue(a.updatedAt || a.createdAt))
    .slice(0, 8);
  $("recentMachines").innerHTML = recent.length
    ? recent.map((machine) => {
      const totals = totalsForMachine(machine.id);
      return `<button class="item itemButton" type="button" data-open-machine="${escapeHTML(machine.id)}">
        <div class="itemMain">
          <strong>${escapeHTML(machine.name)}</strong>
          <small>${escapeHTML(machine.code || "未填代碼")}｜${escapeHTML(machine.category)}</small>
        </div>
        <div class="itemAmount">
          <strong>${money(totals.actual)}</strong>
          <small>實際費用</small>
        </div>
      </button>`;
    }).join("")
    : '<div class="empty">尚無機台資料</div>';

  $("recentMachines").querySelectorAll("[data-open-machine]").forEach((button) => {
    button.addEventListener("click", () => openMachineDialog(button.dataset.openMachine));
  });

  const actualRows = state.machines
    .map((machine) => ({ label: machine.name, total: totalsForMachine(machine.id).actual }))
    .filter((row) => row.total > 0)
    .sort((a, b) => b.total - a.total)
    .slice(0, 8);
  renderBars($("actualCostBars"), actualRows);
}

function renderMachineCards() {
  const machines = filteredMachines();
  $("machineCards").innerHTML = machines.length
    ? machines.map((machine) => {
      const totals = totalsForMachine(machine.id);
      const orderCount = state.costOrders.filter((order) => order.machineId === machine.id).length;
      return `<article class="machineCard">
        <div class="machineImage ${(machine.imageFileId || machine.imageUrl) ? "hasImage" : ""}">
          ${machine.imageFileId ? `<img data-secure-file-id="${escapeHTML(machine.imageFileId)}" alt="${escapeHTML(machine.name)}" loading="lazy">` : machine.imageUrl ? `<img src="${escapeHTML(machine.imageUrl)}" alt="${escapeHTML(machine.name)}" loading="lazy">` : `<span>${escapeHTML(machine.name.slice(0, 2).toUpperCase())}</span>`}
        </div>
        <div class="machineCardBody">
          <div class="cardTags">
            <span class="tag">${escapeHTML(machine.category)}</span>
            <span class="tag">${orderCount} 張成本單</span>
          </div>
          <h3>${escapeHTML(machine.name)}</h3>
          <p class="machineCode">${escapeHTML(machine.code || machine.id || "未填代碼")}</p>
          <div class="stageCosts">
            <div><span>打樣版</span><strong>${money(totals.sample)}</strong></div>
            <div><span>測試台</span><strong>${money(totals.test)}</strong></div>
            <div class="actual"><span>實際費用</span><strong>${money(totals.actual)}</strong></div>
          </div>
          <button class="button secondary fullButton" type="button" data-open-machine="${escapeHTML(machine.id)}">查看所有品項</button>
        </div>
      </article>`;
    }).join("")
    : '<div class="empty fullSpan">找不到符合條件的機台</div>';

  $("machineCards").querySelectorAll("[data-open-machine]").forEach((button) => {
    button.addEventListener("click", () => openMachineDialog(button.dataset.openMachine));
  });
  hydrateSecureImages($("machineCards"));
}

function renderCostRecords() {
  const orders = [...filteredCostOrders()].sort((a, b) => dateValue(b.date) - dateValue(a.date));
  $("costRecordCount").textContent = `共 ${orders.length.toLocaleString("zh-TW")} 筆`;
  $("costRecordRows").innerHTML = orders.length
    ? orders.map((order) => {
      const machine = machineById(order.machineId);
      const link = order.quotationFileId
        ? `<button class="tableAction" type="button" data-view-file="${escapeHTML(order.quotationFileId)}" data-file-name="${escapeHTML(order.quotationFileName || "估價單")}">查看檔案</button>`
        : order.quotationUrl
          ? `<a class="textLink" href="${escapeHTML(order.quotationUrl)}" target="_blank" rel="noopener">查看檔案</a>`
          : "—";
      return `<tr>
        <td>${escapeHTML(order.date || "—")}</td>
        <td>${escapeHTML(machine?.name || order.machineId || "—")}</td>
        <td><span class="stageBadge ${stageClass(order.type)}">${escapeHTML(order.type || "未分類")}</span></td>
        <td>${escapeHTML(order.supplier || "—")}</td>
        <td>${escapeHTML(order.project || "—")}</td>
        <td>${money(order.materialSubtotal)}</td>
        <td>${money(order.tax)}</td>
        <td>${money(order.other)}</td>
        <td><strong>${money(orderTotal(order))}</strong></td>
        <td>${link}</td>
      </tr>`;
    }).join("")
    : '<tr><td colspan="10" class="empty">成本單 API 尚未開通或目前沒有資料</td></tr>';
}

function renderMachineTotals() {
  const machines = filteredMachines();
  $("machineTotalRows").innerHTML = machines.length
    ? machines.map((machine) => {
      const totals = totalsForMachine(machine.id);
      const lastDate = latestMachineCostDate(machine.id);
      return `<tr>
        <td><strong>${escapeHTML(machine.name)}</strong><br><small>${escapeHTML(machine.code || machine.id)}</small></td>
        <td>${escapeHTML(machine.category)}</td>
        <td>${money(totals.sample)}</td>
        <td>${money(totals.test)}</td>
        <td><strong>${money(totals.actual)}</strong></td>
        <td>${money(totals.development)}</td>
        <td>${escapeHTML(lastDate || machine.updatedAt || machine.createdAt || "—")}</td>
        <td><button class="tableAction" type="button" data-open-machine="${escapeHTML(machine.id)}">查看</button></td>
      </tr>`;
    }).join("")
    : '<tr><td colspan="8" class="empty">尚無機台資料</td></tr>';
  $("machineTotalRows").querySelectorAll("[data-open-machine]").forEach((button) => {
    button.addEventListener("click", () => openMachineDialog(button.dataset.openMachine));
  });
}

function renderSuppliers() {
  const keyword = searchKeyword();
  const map = new Map();
  state.suppliers.forEach((supplier) => map.set(supplier.name, { ...supplier, total: 0, orderCount: 0, machines: new Set() }));
  state.costOrders.forEach((order) => {
    const name = order.supplier || "未填供應商";
    if (!map.has(name)) map.set(name, { id: "", name, contact: "", phone: "", email: "", note: "", total: 0, orderCount: 0, machines: new Set() });
    const supplier = map.get(name);
    supplier.total += orderTotal(order);
    supplier.orderCount += 1;
    if (order.machineId) supplier.machines.add(order.machineId);
  });
  const rows = [...map.values()]
    .filter((supplier) => !keyword || norm([supplier.name, supplier.contact, supplier.phone, supplier.email, supplier.note].join(" ")).includes(keyword))
    .sort((a, b) => b.total - a.total);
  $("supplierCards").innerHTML = rows.length
    ? rows.map((supplier) => `<article class="supplierCard">
      <span class="tag">供應商</span>
      <h3>${escapeHTML(supplier.name)}</h3>
      <div class="price">${money(supplier.total)}</div>
      <div class="meta">
        <span class="label">成本單數</span><span>${supplier.orderCount}</span>
        <span class="label">機台數</span><span>${supplier.machines.size}</span>
        <span class="label">聯絡人</span><span>${escapeHTML(supplier.contact || "—")}</span>
        <span class="label">電話</span><span>${escapeHTML(supplier.phone || "—")}</span>
        <span class="label">Email</span><span>${escapeHTML(supplier.email || "—")}</span>
      </div>
    </article>`).join("")
    : '<div class="empty fullSpan">供應商 API 尚未開通或目前沒有資料</div>';
}

function openMachineDialog(machineId) {
  const machine = machineById(machineId);
  if (!machine) return;
  state.selectedMachineId = machineId;
  state.selectedMachineStage = COST_TYPES[0];
  state.selectedMachineArea = "";
  const totals = totalsForMachine(machineId);
  const areas = state.machineAreas.filter((area) => area.machineId === machineId && isValidMachineArea(area));
  const imageMarkup = machine.imageFileId
    ? `<img data-secure-file-id="${escapeHTML(machine.imageFileId)}" alt="${escapeHTML(machine.name)}">`
    : machine.imageUrl
      ? `<img src="${escapeHTML(machine.imageUrl)}" alt="${escapeHTML(machine.name)}">`
      : `<span>${escapeHTML(machine.name.slice(0, 2).toUpperCase())}</span>`;

  $("machineDialogContent").innerHTML = `
    <div class="dialogHeader">
      <div class="dialogMachineImage ${(machine.imageFileId || machine.imageUrl) ? "hasImage" : ""}">${imageMarkup}</div>
      <div>
        <span class="tag">${escapeHTML(machine.category)}</span>
        <h2>${escapeHTML(machine.name)}</h2>
        <p>${escapeHTML(machine.code || machine.id)}${machine.note ? `｜${escapeHTML(machine.note)}` : ""}</p>
      </div>
    </div>
    <div class="dialogCostCards">
      <div><span>打樣版費用</span><strong>${money(totals.sample)}</strong></div>
      <div><span>測試台費用</span><strong>${money(totals.test)}</strong></div>
      <div class="actual"><span>實際費用</span><strong>${money(totals.actual)}</strong></div>
      <div><span>開發累積投入</span><strong>${money(totals.development)}</strong></div>
    </div>
    ${(machine.imageFileId || machine.imageUrl) ? `
      <div class="machineAreaExplorer">
        <div class="machineAreaCanvas">
          ${imageMarkup}
          ${areas.map((area) => `<button class="machineHotspot ${area.status === "已確認" ? "confirmed" : "suggested"}" type="button" data-machine-hotspot="${escapeHTML(area.name)}" style="left:${area.x}%;top:${area.y}%;width:${area.width}%;height:${area.height}%"><span>${escapeHTML(area.name)}</span></button>`).join("")}
        </div>
        <div id="machineAreaCostPanel" class="machineAreaCostPanel">
          ${areas.length ? "點選機台圖片上的區域，查看該區域的品項與費用。" : "目前沒有可點擊熱區。AI 有足夠依據時會建立建議熱區，也可先用安裝區域文字保存成本。"}
        </div>
      </div>` : ""}
    <div class="stageTabs" role="tablist">
      ${COST_TYPES.map((type, index) => `<button class="stageTab ${index === 0 ? "active" : ""}" type="button" data-stage="${escapeHTML(type)}">${escapeHTML(type)}</button>`).join("")}
    </div>
    <div id="dialogStageContent"></div>`;

  $("machineDialogContent").querySelectorAll("[data-stage]").forEach((button) => {
    button.addEventListener("click", () => {
      $("machineDialogContent").querySelectorAll("[data-stage]").forEach((item) => item.classList.remove("active"));
      button.classList.add("active");
      state.selectedMachineStage = button.dataset.stage;
      renderDialogStage(machineId, state.selectedMachineStage);
      if (state.selectedMachineArea) renderMachineAreaCostPanel(machineId, state.selectedMachineArea, state.selectedMachineStage);
    });
  });
  $("machineDialogContent").querySelectorAll("[data-machine-hotspot]").forEach((button) => {
    button.addEventListener("click", () => {
      state.selectedMachineArea = button.dataset.machineHotspot;
      $("machineDialogContent").querySelectorAll("[data-machine-hotspot]").forEach((item) => item.classList.remove("active"));
      button.classList.add("active");
      renderMachineAreaCostPanel(machineId, state.selectedMachineArea, state.selectedMachineStage);
    });
  });
  renderDialogStage(machineId, state.selectedMachineStage);
  $("machineDialog").showModal();
  hydrateSecureImages($("machineDialogContent"));
}

function isValidMachineArea(area) {
  return area && area.name && area.width > 0 && area.height > 0 && area.x >= 0 && area.y >= 0 && area.x + area.width <= 100.5 && area.y + area.height <= 100.5;
}

function renderMachineAreaCostPanel(machineId, areaName, type) {
  const panel = $("machineAreaCostPanel");
  if (!panel) return;
  const orderIds = state.costOrders
    .filter((order) => order.machineId === machineId && order.type === type)
    .map((order) => order.id);
  const items = state.costItems.filter((item) =>
    orderIds.includes(item.costOrderId) &&
    norm(item.areaName) === norm(areaName)
  );
  const total = items.reduce((sum, item) => sum + item.subtotal, 0);
  panel.innerHTML = `
    <div class="areaPanelHead"><div><span class="tag">${escapeHTML(type)}</span><h3>${escapeHTML(areaName)}</h3></div><strong>${money(total)}</strong></div>
    ${items.length ? `<div class="areaItemList">${items.map((item) => `<div class="areaItem">
      ${item.imageFileId ? `<img data-secure-file-id="${escapeHTML(item.imageFileId)}" alt="${escapeHTML(item.name)}">` : item.imageUrl ? `<img src="${escapeHTML(item.imageUrl)}" alt="${escapeHTML(item.name)}">` : ""}
      <div><strong>${escapeHTML(item.name)}</strong><small>${escapeHTML([item.spec, item.material, item.thickness].filter(Boolean).join("｜") || "未填規格")}</small></div>
      <span>${money(item.subtotal)}</span>
    </div>`).join("")}</div>` : '<div class="empty">這個費用階段尚無對應品項。</div>'}`;
  hydrateSecureImages(panel);
}

function renderDialogStage(machineId, type) {
  const orders = state.costOrders.filter((order) => order.machineId === machineId && order.type === type);
  const orderIds = orders.map((order) => order.id);
  const items = state.costItems.filter((item) => orderIds.includes(item.costOrderId));
  const total = orders.reduce((sum, order) => sum + orderTotal(order), 0);
  const content = $("dialogStageContent");
  if (!orders.length && !items.length) {
    content.innerHTML = `<div class="empty dialogEmpty">尚未建立「${escapeHTML(type)}」資料</div>`;
    return;
  }
  content.innerHTML = `
    <div class="dialogStageSummary">
      <span>${escapeHTML(type)}共 ${orders.length} 張成本單、${items.length} 筆明細</span>
      <strong>${money(total)}</strong>
    </div>
    <div class="tableWrap">
      <table class="dialogTable">
        <thead><tr><th>類型</th><th>圖片</th><th>品項</th><th>規格／包裝</th><th>數量</th><th>單位</th><th>單價</th><th>材質</th><th>厚度</th><th>檔案名稱</th><th>安裝區域</th><th>小計</th><th>備註</th></tr></thead>
        <tbody>${items.length ? items.map((item) => `<tr>
          <td><span class="tag">${escapeHTML(item.itemType || "材料")}</span></td>
          <td>${item.imageFileId ? `<img class="dialogItemThumb" data-secure-file-id="${escapeHTML(item.imageFileId)}" alt="${escapeHTML(item.name)}">` : item.imageUrl ? `<img class="dialogItemThumb" src="${escapeHTML(item.imageUrl)}" alt="${escapeHTML(item.name)}">` : "—"}</td>
          <td>${escapeHTML(item.name || "—")}</td>
          <td>${escapeHTML(item.spec || "—")}</td>
          <td>${item.qty}</td>
          <td>${escapeHTML(item.unit || "—")}</td>
          <td>${money(item.price)}</td>
          <td>${escapeHTML(item.material || "—")}</td>
          <td>${escapeHTML(item.thickness || "—")}</td>
          <td>${escapeHTML(item.fileName || "—")}</td>
          <td>${escapeHTML(item.areaName || "未指定")}<br><small>${escapeHTML(item.areaStatus || "未指定")}</small></td>
          <td><strong>${money(item.subtotal)}</strong></td>
          <td>${escapeHTML(item.note || "—")}</td>
        </tr>`).join("") : '<tr><td colspan="13" class="empty">成本單已建立，但尚無明細</td></tr>'}</tbody>
      </table>
    </div>`;
  hydrateSecureImages(content);
}


function renderDraftItems() {
  $("draftItemRows").innerHTML = state.draftItems.map((item, index) => {
    const isFee = item.itemType === "附加費用";
    return `<tr data-index="${index}" class="${isFee ? "feeRow" : "materialRow"}">
      <td><select class="tableInput itemTypeInput" data-field="itemType"><option value="材料" ${!isFee ? "selected" : ""}>材料</option><option value="附加費用" ${isFee ? "selected" : ""}>附加費用</option></select></td>
      <td><div class="itemImageEditor">
        ${isFee ? '<span class="muted tinyText">不需圖片</span>' : item.image?.dataUrl ? `<img src="${escapeHTML(item.image.dataUrl)}" alt="品項圖片"><button type="button" class="miniClear" data-clear-item-image="${index}">移除</button>` : `<label class="miniUpload">上傳<input type="file" accept="image/jpeg,image/png,image/webp" data-item-image="${index}" hidden></label>`}
      </div></td>
      <td><input class="tableInput itemNameInput" data-field="name" value="${escapeHTML(item.name)}" placeholder="${isFee ? "例如：運費／版費" : "品項名稱"}"></td>
      <td><input class="tableInput specInput" data-field="spec" value="${escapeHTML(item.spec)}" placeholder="規格／包裝" ${isFee ? "disabled" : ""}></td>
      <td><input class="tableInput numberInput" data-field="qty" type="number" min="0" step="0.01" value="${isFee ? 1 : item.qty}" ${isFee ? "disabled" : ""}></td>
      <td><input class="tableInput unitInput" data-field="unit" value="${escapeHTML(item.unit)}" placeholder="可留空" ${isFee ? "disabled" : ""}></td>
      <td><input class="tableInput numberInput" data-field="price" type="number" min="0" step="0.01" value="${item.price || ""}" placeholder="${isFee ? "費用金額" : "單價"}"></td>
      <td><input class="tableInput materialInput" data-field="material" value="${escapeHTML(item.material || "")}" placeholder="材質" ${isFee ? "disabled" : ""}></td>
      <td><input class="tableInput thicknessInput" data-field="thickness" value="${escapeHTML(item.thickness || "")}" placeholder="厚度" ${isFee ? "disabled" : ""}></td>
      <td><input class="tableInput fileNameInput" data-field="fileName" value="${escapeHTML(item.fileName || "")}" placeholder="檔案名稱" ${isFee ? "disabled" : ""}></td>
      <td><input class="tableInput areaInput" data-field="areaName" list="machineAreaOptions" value="${escapeHTML(item.areaName || "未指定")}" placeholder="未指定" ${isFee ? "disabled" : ""}></td>
      <td><select class="tableInput areaStatusInput" data-field="areaStatus" ${isFee ? "disabled" : ""}><option value="未指定" ${item.areaStatus === "未指定" ? "selected" : ""}>未指定</option><option value="AI建議" ${item.areaStatus === "AI建議" ? "selected" : ""}>AI建議</option><option value="已確認" ${item.areaStatus === "已確認" ? "selected" : ""}>已確認</option></select></td>
      <td data-subtotal><strong>${money((isFee ? 1 : item.qty) * item.price)}</strong></td>
      <td><input class="tableInput noteInput" data-field="note" value="${escapeHTML(item.note)}" placeholder="備註"></td>
      <td><button class="removeRow" type="button" data-remove="${index}">刪除</button></td>
    </tr>`;
  }).join("");
  renderDraftSubtotal();
}

function calculateDraftTotals() {
  const materialSubtotal = state.draftItems
    .filter((item) => item.itemType !== "附加費用")
    .reduce((sum, item) => sum + toNumber(item.qty) * toNumber(item.price), 0);
  const additionalTotal = state.draftItems
    .filter((item) => item.itemType === "附加費用")
    .reduce((sum, item) => sum + toNumber(item.price), 0);
  const base = materialSubtotal + additionalTotal;
  const mode = $("quotationMode")?.value || "未稅";
  const rate = Math.max(0, toNumber($("quotationTaxRate")?.value));
  let tax = 0;
  let total = base;
  if (mode === "未稅") {
    tax = base * rate / 100;
    total = base + tax;
  } else if (mode === "含稅" && rate > 0) {
    tax = base * rate / (100 + rate);
  }
  return { materialSubtotal, additionalTotal, base, tax, total, mode, rate };
}

function renderDraftSubtotal() {
  const totals = calculateDraftTotals();
  $("draftSubtotal").textContent = money(totals.materialSubtotal);
  $("draftAdditionalTotal").textContent = money(totals.additionalTotal);
  $("draftTaxTotal").textContent = money(totals.tax);
  $("draftGrandTotal").textContent = money(totals.total);
  $("draftTaxLabel").textContent = totals.mode === "不計稅" ? "稅額" : totals.mode === "含稅" ? `內含稅額 ${totals.rate}%` : `稅額 ${totals.rate}%`;
  $("taxCalculationHint").textContent = totals.mode === "未稅"
    ? "未稅報價：稅額會加在材料與附加費用合計之後。"
    : totals.mode === "含稅"
      ? "含稅報價：階段總成本不會再加一次稅；畫面僅拆出內含稅額供查核。"
      : "不計稅：稅額固定為 0。";
}


function machineById(machineId) {
  return state.machines.find((machine) => machine.id === machineId);
}

function orderTotal(order) {
  return order.total || order.materialSubtotal + order.tax + order.other;
}

function totalsForMachine(machineId) {
  const totals = { sample: 0, test: 0, actual: 0, development: 0 };
  state.costOrders.filter((order) => order.machineId === machineId).forEach((order) => {
    const total = orderTotal(order);
    if (order.type === "打樣版費用") totals.sample += total;
    if (order.type === "測試台費用") totals.test += total;
    if (order.type === "實際費用") totals.actual += total;
    totals.development += total;
  });
  return totals;
}

function latestMachineCostDate(machineId) {
  return state.costOrders
    .filter((order) => order.machineId === machineId)
    .map((order) => order.date)
    .filter(Boolean)
    .sort((a, b) => dateValue(b) - dateValue(a))[0] || "";
}

function stageClass(type) {
  if (type === "打樣版費用") return "sample";
  if (type === "測試台費用") return "test";
  if (type === "實際費用") return "actual";
  return "";
}

function renderBars(container, rows) {
  if (!rows.length) {
    container.innerHTML = '<div class="empty">尚無實際成本資料</div>';
    return;
  }
  const max = Math.max(...rows.map((row) => row.total), 1);
  container.innerHTML = rows.map((row) => `<div class="barItem">
    <div class="barHead"><span>${escapeHTML(row.label)}</span><span>${money(row.total)}</span></div>
    <div class="barTrack"><div class="barFill" style="width:${Math.max(3, (row.total / max) * 100)}%"></div></div>
  </div>`).join("");
}

function setDataStatus(text, type = "") {
  $("dataStatus").textContent = text;
  $("dataStatus").className = `statusDot ${type}`.trim();
}

function showNotice(message, type = "") {
  $("notice").textContent = message;
  $("notice").className = `notice ${type}`.trim();
  $("notice").hidden = false;
}

function hideNotice() {
  $("notice").hidden = true;
}

function unique(values) {
  return [...new Set(values)];
}

function todayValue() {
  const now = new Date();
  const local = new Date(now.getTime() - now.getTimezoneOffset() * 60000);
  return local.toISOString().slice(0, 10);
}

function csvCell(value) {
  const text = String(value ?? "");
  return /[",\n\r]/.test(text) ? `"${text.replaceAll('"', '""')}"` : text;
}

function downloadCsv(rows, filename) {
  const content = "\uFEFF" + rows.map((row) => row.map(csvCell).join(",")).join("\r\n");
  const blob = new Blob([content], { type: "text/csv;charset=utf-8" });
  const url = URL.createObjectURL(blob);
  const link = document.createElement("a");
  link.href = url;
  link.download = filename;
  document.body.appendChild(link);
  link.click();
  link.remove();
  URL.revokeObjectURL(url);
}
