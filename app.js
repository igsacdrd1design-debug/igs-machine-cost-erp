// =======================================================
// IGS 機台材料成本 ERP — 前端 v1.4
// 1. ERP密碼登入
// 2. 工作階段驗證
// 3. 私人 Google Sheet 安全讀取
// =======================================================

const APPS_SCRIPT_URL = "https://script.google.com/macros/s/AKfycbwwDS05GM-oWngHd2GOslFPTrr0ab8O3kamuoSloY-_1QJJHu7jFDH4hDI_-J3qF9In/exec";
const AUTH_TOKEN_KEY = "igs-erp-auth-token";
const API_MESSAGE_SOURCE = "igs-erp-api";
const $ = (id) => document.getElementById(id);

const COST_TYPES = ["打樣版費用", "測試台費用", "實際費用"];
const FALLBACK_CATEGORIES = [
  "01_機器模擬", "02_競速類", "03_槍機類", "04_彩券機", "05_推幣推珠機",
  "06_兒童水槍射擊球機", "07_兒童模擬", "08_兒童卡牌", "09_兒童體感",
  "10_音樂機", "11_魚機", "12_VR", "13_禮品機", "14_競技類",
  "15_運動類", "16_中性機", "17_彈珠台", "18_自動兌換機",
];

const pageDescriptions = {
  dashboard: "集中查看機台、材料項目與三級成本。",
  machine: "搜尋機器並查看打樣版、測試台與實際費用。",
  costRecords: "查看各機台的成本單與原始估價單。",
  machineTotals: "彙整每台機台的個別成本總和。",
  quoteEntry: "上傳估價單圖片並建立材料成本草稿。",
  QuickMachine: "快速建立新的機器主檔。",
  供應商: "查看供應商與成本單金額。",
};

let authToken = sessionStorage.getItem(AUTH_TOKEN_KEY) || "";
let authenticationReady = false;

let state = {
  機器：[]，
  costOrders: [],
  costItems: [],
  供應商：[]
  設定: [],
  draftItems: [],
  selectedMachineId: "",
};

const money = (value) => {
  const number = toNumber(value);
  return "$" + number.toLocaleString("zh-TW", { maximumFractionDigits: 2 });
};

function toNumber(value) {
  如果 (typeof value === "number") 回傳 Number.isFinite(value) ? value : 0;
  const number = Number(String(value ?? "").replace(/[$,，\s]/g, ""));
  返回 Number.isFinite(number) ? number : 0;
}

函數 norm(value) {
  return String(value ?? "").toLowerCase().replace(/\s+/g, "");
}

function escapeHTML(value) {
  返回字串(值 ?? "")
    .replaceAll("&", "&")
    .replaceAll("<", "<")
    .replaceAll(">", ">")
    .replaceAll('"', """)
    .replaceAll("'", "'");
}

function firstValue(row, keys, fallback = "") {
  for (const key of keys) {
    const value = row?.[key];
    如果 (value !== undefined && value !== null && String(value).trim() !== "") 回傳 value;
  }
  返回備用方案；
}

function normalizeDate(value) {
  const text = String(value || "").trim();
  const match = text.match(/^(\d{4})[-/.](\d{1,2})[-/.](\d{1,2})/);
  如果 (!match) 返回文字；
  返回 `${match[1]}-${String(match[2]).padStart(2, "0")}-${String(match[3]).padStart(2, "0")}`;
}

function dateValue(value) {
  const timestamp = Date.parse(String(value || "").replace(/\//g, "-"));
  return Number.isFinite(timestamp) ? timestamp : 0;
}

function normalizeMachine(row) {
  返回 {
    id: String(firstValue(row, ["機器ID", "machineId", "id"])),
    code: String(firstValue(row, ["機器碼", "machineCode", "code"])),
    name: String(firstValue(row, ["機器名稱", "machineName", "name"], "未命名機器")),
    category: String(firstValue(row, ["機器分類", "類別"], "未分類")),
    imageUrl: String(firstValue(row, ["機台圖片URL", "圖片URL", "imageUrl"])),
    note: String(firstValue(row, ["備註", "note"])),
    createAt: String(firstValue(row, ["建立時間", "createdAt"])),
    updateAt: String(firstValue(row, ["更新時間", "updatedAt"])),
  };
}

function normalizeCostOrder(row) {
  返回 {
    id: String(firstValue(row, ["成本單ID", "costOrderId", "id"])),
    machineId: String(firstValue(row, ["機器ID", "machineId"])),
    type: String(firstValue(row, ["費用類型", "成本類型", "型別"])),
    日期: normalizeDate(firstValue(row, ["日期", "date"])),
    supplierId: String(firstValue(row, ["供應商ID", "supplierId"])),
    供應商： String(firstValue(row, ["供應商名稱", "供應商", "供應商"])),
    項目: String(firstValue(row, ["專案名稱", "項目"])),
    材料小計: toNumber(firstValue(row, ["材料小計", "材料小計"])),
    稅： toNumber(firstValue(row, ["稅額", "稅額"])),
    other: toNumber(firstValue(row, ["其他費用", "other"])),
    Total: toNumber(firstValue(row, ["階段總成本"​​, "含稅總成本", "總計"])),
    quoteUrl: String(firstValue(row, ["估價單圖片URL", "原圖URL", "quotationUrl"])),
    note: String(firstValue(row, ["備註", "note"])),
    createAt: String(firstValue(row, ["建立時間", "createdAt"])),
    updateAt: String(firstValue(row, ["更新時間", "updatedAt"])),
  };
}

function normalizeCostItem(row) {
  const qty = toNumber(firstValue(row, ["數量", "數量"]));
  const Price = toNumber(firstValue(row, ["單價", "價格"]));
  const subtotal = toNumber(firstValue(row, ["小計", "金額", "小計"]));
  返回 {
    id: String(firstValue(row, ["明細ID", "itemId", "id"])),
    costOrderId: String(firstValue(row, ["成本單元ID", "costOrderId"])),
    index: firstValue(row, ["項次", "index"]),
    name: String(firstValue(row, ["品項名稱", "項目", "名稱"])),
    spec: String(firstValue(row, ["規格", "spec"])),
    數量，
    單位： String(firstValue(行, ["單位", "單位"])),
    價格，
    小計：小計 || 數量 * 單價，
    imageUrl: String(firstValue(row, ["品項圖片URL", "imageUrl"])),
    note: String(firstValue(row, ["備註", "note"])),
  };
}

function normalizeSupplier(row) {
  返回 {
    id: String(firstValue(row, ["供應商ID", "supplierId", "id"])),
    name: String(firstValue(row, ["供應商名稱", "供應商", "名稱"], "未命名供應商")),
    contact: String(firstValue(row, ["聯絡人", "聯絡人"])),
    電話： String(firstValue(row, ["電話", "電話"])),
    email: String(firstValue(row, ["Email", "email"])),
    note: String(firstValue(row, ["備註", "note"])),
  };
}

function secureApiRequest(payload, options = {}) {
  如果 (!APPS_SCRIPT_URL || !APPS_SCRIPT_URL.includes("/exec")) {
    return Promise.reject(new Error("尚未設定 Apps 腳本網址"));
  }

  const requestId = `igs-${Date.now()}-${Math.random().toString(36).slice(2, 9)}`;
  const includeToken = options.includeToken !== false;
  const requestPayload = {
    有效載荷，
    請求 ID，
    來源：window.location.origin，
  };

  如果 (包含令牌) requestPayload.token = authToken;

  傳回一個新的 Promise((resolve, reject) => {
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
    字段類型 = "隱藏";
    字段名 = "有效載荷";
    field.value = JSON.stringify(requestPayload);
    form.appendChild(field);

    let finished = false;

    const cleanup = () => {
      window.removeEventListener("message", onMessage);
      移除表單();
      iframe.remove();
    };

    const finish = (callback) => {
      如果（完成）返回；
      完成 = true；
      清除超時(超時);
      清理（​​）;
      打回來（）;
    };

    const onMessage = (event) => {
      // Apps Script HTML Service 將回應放在額外的沙箱 iframe 中，
      // 因此 event.source 不一定等於外層 iframe.contentWindow。
      // 改以Google回應網域、隨機requestId與固定來源三重驗證。
      let trustedOrigin = false;
      嘗試 {
        const hostname = new URL(event.origin).hostname;
        受信任來源 =
          主機名稱 === "script.google.com" ||
          主機名稱 === "script.googleusercontent.com" ||
          hostname.endsWith(".googleusercontent.com");
      } catch (error) {
        trustedOrigin = false;
      }

      如果 (!trustedOrigin) 返回；

      const data = event.data;
      如果 (!data || data.source !== API_MESSAGE_SOURCE || data.requestId !== requestId) 回傳;

      完成(() => {
        如果 (data.ok) {
          解析(數據)；
          返回;
        }

        如果 (data.code === "AUTH_REQUIRED") {
          處理身份驗證失敗(data.error);
        }

        reject(new Error(data.error || "伺服器沒有完成要求"));
      });
    };

    const timeout = setTimeout(() => {
      finish(() =>拒絕(new Error("連線逾時時，請稍後再試")));
    }, options.timeoutMs || 45000);

    iframe.addEventListener("error", () => {
      finish(() =>拒絕(new Error("無法連線到Apps腳本")));
    });

    window.addEventListener("message", onMessage);
    document.body.append(iframe, form);
    表單提交();
  });
}

document.addEventListener("DOMContentLoaded", () => {
  setupAuthentication();
  設定導航();
  setupSearch();
  setupFilters();
  setupDialog();
  setupForms();
  setupQuotationPreview();
  setupDraftItems();
  setupExport();
  $("quotationDate").value = todayValue();
  恢復身份驗證();
});

function setupAuthentication() {
  $("loginForm").addEventListener("submit", handleLoginSubmit);
  $("logoutButton").addEventListener("click", logoutErp);
}

非同步函數 restoreAuthentication() {
  lockErp();
  setDataStatus("等待登入", "");
  如果 (!authToken) 返回；

  setLoginBusy(true, "正在驗證登錄...");
  嘗試 {
    await secureApiRequest(
      { action: "validateSession" },
      { includeToken: true, timeoutMs: 30000 }
    ）；
    unlockErp();
    await loadData();
  } catch (error) {
    清除身份驗證();
    showLoginError("登錄已失敗，請重新輸入密碼。");
  } 最後 {
    setLoginBusy(false);
  }
}

非同步函數 handleLoginSubmit(event) {
  event.preventDefault();
  const password = $("loginPassword").value;
  如果 (!password) 回傳；

  hideLoginError();
  setLoginBusy(true, "登錄驗證...");

  嘗試 {
    const response = await secureApiRequest(
      { action: "登入", password },
      { includeToken: false, timeoutMs: 30000 }
    ）；

    authToken = String(response.token || "");
    if (!authToken) throw new Error("伺服器沒有回傳登入憑證");

    sessionStorage.setItem(AUTH_TOKEN_KEY, authToken);
    $("loginPassword").value = "";
    unlockErp();
    await loadData();
  } catch (error) {
    清除身份驗證();
    showLoginError(error.message || "登錄失敗");
    $("loginPassword").focus();
  } 最後 {
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

非同步函數 logoutErp() {
  const currentToken = authToken;
  清除身份驗證();
  resetPrivateState();
  lockErp();
  $("loginPassword").value = "";
  隱藏通知();
  setDataStatus("等待登入", "");
  window.scrollTo({ top: 0 });

  如果 (currentToken) {
    嘗試 {
      authToken = currentToken;
      await secureApiRequest({ action: "logout" }, { includeToken: true, timeoutMs: 15000 });
    } catch (error) {
      console.info("扶手登出未完成：", error.message);
    } 最後 {
      清除身份驗證();
    }
  }

  setTimeout(() => $("loginPassword").focus(), 50);
}

function resetPrivateState() {
  狀態機 = [];
  state.costOrders = [];
  state.costItems = [];
  state.suppliers = [];
  state.settings = [];
  state.selectedMachineId = "";
  renderAll();
}

function clearAuthentication() {
  authToken = "";
  authenticationReady = false;
  sessionStorage.removeItem(AUTH_TOKEN_KEY);
}

function setLoginBusy(isBusy, text = "登入 ERP") {
  const button = $("loginButton");
  按鈕已停用 = isBusy;
  按鈕.textContent = isBusy ? text : "登錄ERP";
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
  清除身份驗證();
  resetPrivateState();
  lockErp();
  showLoginError(message || "登錄已失效，請重新輸入密碼。");
  setDataStatus("等待登入", "");
  setTimeout(() => $("loginPassword").focus(), 50);
}

function setupNavigation() {
  document.querySelectorAll(".nav").forEach((button) => {
    button.addEventListener("click", () => {
      document.querySelectorAll(".nav").forEach((item) => item.classList.remove("active"));
      document.querySelectorAll("view").forEach((view) => view.classList.remove("active"));
      button.classList.add("active");
      const viewId = button.dataset.view;
      $(viewId)?.classList.add("active");
      $("pageTitle").textContent = button.dataset.title || button.textContent.trim();
      $("pageDescription").textContent = pageDescriptions[viewId] || “”；
      $("globalSearch").style.display = ["quotationEntry", "quickMachine"].includes(viewId) ? "none" : "block";
      window.scrollTo({ top: 0, behavior: "smooth" });
    });
  });
  $("reloadData").addEventListener("click", () => {
    如果 (authenticationReady && authToken) loadData();
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
    如果 (event.target === $("machineDialog")) $("machineDialog").close();
  });
}

function setupForms() {
  $("machineForm").addEventListener("submit", handleCreateMachine);
  $("resetMachineForm").addEventListener("click", () => $("machineForm").reset());
  $("quotationForm").addEventListener("submit", (event) => {
    event.preventDefault();
    如果 (!state.draftItems.length) {
      showNotice("請先新增至少一個材料品項。", "warn");
      返回;
    }
    showNotice("成本單稿已整理完成。下一步更新 Apps 腳本後即可將圖片寫入 Google Sheet。", "warn");
  });
}

非同步函數 handleCreateMachine(event) {
  event.preventDefault();

  const code = $("machineCode").value.trim();
  const name = $("machineName").value.trim();
  const category = $("machineCategory").value.trim();
  const imageUrl = $("machineImageUrl").value.trim();
  const note = $("machineNote").value.trim();

  如果 (!code || !name || !category) {
    showNotice("請填入機器碼、機器名稱與機器分類。", "警告");
    返回;
  }

  如果 (imageUrl && !imageUrl.startsWith("https://")) {
    showNotice("機器圖片網址必須以 https:// 。", "warn");
    返回;
  }

  const button = $("createMachineButton");
  const OriginalText = 按鈕.textContent;
  按鈕已禁用 = true;
  button.textContent = "建立中...";

  嘗試 {
    const response = await secureApiRequest(
      {
        操作：“創建機器”，
        機器：{代碼，名稱，類別，圖像URL，備註}
      },
      { includeToken: true, timeoutMs: 60000 }
    ）；

    const created = response.result?.machine || {};
    $("machineForm").reset();
    await loadData();
    showNotice(`已建立機器「${created["機器名稱"] || name}」(${created["機器ID"] || ""}）。`);

    const machineNav = document.querySelector('[data-view="machines"]');
    如果 (machineNav) machineNav.click();
  } catch (error) {
    showNotice(`建立機器失敗：${error.message}`, "error");
  } 最後 {
    按鈕已禁用 = false;
    按鈕.textContent = 原始文字;
  }
}

function setupQuotationPreview() {
  $("quotationFile").addEventListener("change", (event) => {
    const file = event.target.files?.[0];
    如果 (!file) 返回；
    如果 (!file.type.startsWith("image/")) {
      showNotice("請選擇圖片檔案。", "錯誤");
      event.target.value = "";
      返回;
    }
    const reader = new FileReader();
    reader.onload = () => {
      $("quotationPreview").src = String(reader.result || "");
      $("quotationFileName").textContent = file.name;
      $("quotationPreviewWrap").hidden = false;
    };
    reader.onerror = () => showNotice("無法讀取圖片。", "error");
    reader.readAsDataURL(file);
  });
  $("clearQuotation").addEventListener("click", () => {
    $("quotationFile").value = "";
    $("quotationPreview").removeAttribute("src");
    $("quotationPreviewWrap").hidden = true;
  });
}

function setupDraftItems() {
  $("addDraftItem").addEventListener("click", () => {
    state.draftItems.push({ name: "", spec: "", qty: 1, unit: "件", price: 0, note: "" });
    renderDraftItems();
  });
  $("draftItemRows").addEventListener("input", (event) => {
    const input = event.target.closest("[data-field]");
    const row = event.target.closest("[data-index]");
    如果（!input || !row）則回傳；
    const item = state.draftItems[Number(row.dataset.index)];
    如果 (!item) 返回；
    const field = input.dataset.field;
    item[field] = ["qty", "price"].includes(field) ? toNumber(input.value) : input.value;
    renderDraftSubtotal();
    如果 (["qty", "price"].includes(field)) {
      const subtotalCell = row.querySelector("[data-subtotal]");
      如果 (subtotalCell) subtotalCell.textContent = money(item.qty * item.price);
    }
  });
  $("draftItemRows").addEventListener("click", (event) => {
    const button = event.target.closest("[data-remove]");
    如果（!button）返回；
    state.draftItems.splice(Number(button.dataset.remove), 1);
    renderDraftItems();
  });
  state.draftItems.push({ name: "", spec: "", qty: 1, unit: "件", price: 0, note: "" });
  renderDraftItems();
}

function setupExport() {
  $("exportCostsCsv").addEventListener("click", () => {
    const rows = filteredCostOrders();
    如果 (!rows.length) {
      showNotice("目前沒有可匯出的成本記錄。", "warn");
      返回;
    }
    const header = ["日期", "機台", "費用類型", "供應商", "專案名稱", "材料小計", "稅額", "其他費用", "階段總成本"​​, "估價單圖片URL"];
    const body = rows.map((order) => {
      const machine = machineById(order.machineId);
      返回 [order.date, machine?.name || order.machineId, order.type, order.supplier, order.project, order.materialSubtotal, order.tax, order.other, orderTotal(order), order.quotationUrl];
    });
    downloadCsv([header, ...body], "IGS_成本記錄.csv");
  });
}

非同步函數 loadData() {
  如果 (!authenticationReady || !authToken) 返回；

  setDataStatus("私人資料讀取中", "");
  showNotice("正在安全讀取 Google Sheet...");

  嘗試 {
    const response = await secureApiRequest(
      { action: "readData" },
      { includeToken: true, timeoutMs: 60000 }
    ）；

    const result = response.result || {};
    state.machines = (Array.isArray(result.machines) ? result.machines : []).map(normalizeMachine);
    state.settings = Array.isArray(result.settings) ? result.settings : [];
    state.costOrders = (Array.isArray(result.costOrders) ? result.costOrders : []).map(normalizeCostOrder);
    state.costItems = (Array.isArray(result.costItems) ? result.costItems : []).map(normalizeCostItem);
    state.suppliers = (Array.isArray(result.suppliers) ? result.suppliers : []).map(normalizeSupplier);

    populateControls();
    renderAll();
    setDataStatus("私人Google表格已同步", "ok");
    隱藏通知();
  } catch (error) {
    如果 (!authenticationReady) 返回；
    console.error(error);
    resetPrivateState();
    populateControls();
    setDataStatus("資料讀取失敗", "error");
    showNotice(`私人Google表格讀取失敗：${error.message}`, "error");
  }
}

function populateControls() {
  const categories = state.settings
    .filter((row) => String(row["設定型別"] || row.type || "") === "機器分類")
    .filter((row) => String(row["使用中"] || row.active || "") !== "否")
    .sort((a, b) => toNumber(a["排序"] || a.order) - toNumber(b["排序"] || b.order))
    .map((row) => String(row["設定值"] || row.value || ""))
    .filter(布林值);
  const categoryList = categories.length ? categories : FALLBACK_CATEGORIES;

  fillSelect("categoryFilter",categoryList,true,"全部分類");
  fillSelect("machineCategory", categoryList, false);

  const machineOptions = state.machines.map((machine) => ({ value: machine.id, label: `${machine.name}${machine.code ? `（${machine.code}）` : ""}` }));
  const quotationMachine = $("quotationMachine");
  quotationMachine.innerHTML = machineOptions.length
    machineOptions.map((item) => `<option value="${escapeHTML(item.value)}">${escapeHTML(item.label)}</option>`).join("")
    : '<option value="">請先建立機器</option>';

  const supplierNames = unique([
    ...state.suppliers.map((supplier) => supplier.name),
    ...state.costOrders.map((order) => order.supplier),
  ]).filter(布林值);
  $("supplierOptions").innerHTML = supplierNames.map((name) => `<option value="${escapeHTML(name)}"></option>`).join("");
}

function fillSelect(id, values, includeAll, allLabel = "全部") {
  const select = $(id);
  const current = select.value;
  const options = includeAll ? [`<option value="">${escapeHTML(allLabel)}</option>`] : [];
  options.push(...values.map((value) => `<option value="${escapeHTML(value)}">${escapeHTML(value)}</option>`));
  select.innerHTML = options.join("");
  如果 ([...select.options].some((option) => option.value === current)) select.value = current;
}

function renderAll() {
  renderDashboard();
  renderMachineCards();
  renderCostRecords();
  renderMachineTotals();
  renderSuppliers();
}

function searchKeyword() {
  返回 norm($("globalSearch").value);
}

function machineSearchText(machine) {
  const orderIds = state.costOrders.filter((order) => order.machineId === machine.id).map((order) => order.id);
  const items = state.costItems.filter((item) => orderIds.includes(item.costOrderId));
  return [machine.id, machine.code, machine.name, machine.category, machine.note, ...items.flatMap((item) => [item.name, item.spec, item.note])].join(" ");
}

function filteredMachines() {
  const keyword = searchKeyword();
  const category = $("categoryFilter")?.value || "";
  返回 state.machines.filter((machine) => {
    const keywordMatch = !keyword || norm(machineSearchText(machine)).includes(keyword);
    const categoryMatch = !category || machine.category === category;
    返回關鍵字匹配和類別匹配；
  });
}

function filteredCostOrders() {
  const keyword = searchKeyword();
  返回 state.costOrders.filter((order) => {
    const machine = machineById(order.machineId);
    const text = [order.date, order.type, order.supplier, order.project, order.note, machine?.name, machine?.code, machine?.category].join(" ");
    返回 !keyword || norm(text).includes(keyword)；
  });
}

function renderDashboard() {
  $("statMachines").textContent = state.machines.length.toLocaleString("zh-TW");
  $("statCostOrders").textContent = state.costOrders.length.toLocaleString("zh-TW");
  $("statItems").textContent = unique(state.costItems.map((item) => item.name).filter(Boolean)).length.toLocaleString("zh-TW");
  $("statSuppliers").textContent = unique([...state.suppliers.map((supplier) => supplier.name), ...state.costOrders.map((order) => order.supplier)].filter(Boolean))。
  const actualTotal = state.costOrders.filter((order) => order.type === "實際費用用").reduce((sum, order) => sum + orderTotal(order), 0);
  $("statActualTotal").textContent = money(actualTotal);

  const recent = [...state.machines]
    .sort((a, b) => dateValue(b.updatedAt || b.createdAt) - dateValue(a.updatedAt || a.createdAt))
    .slice(0, 8);
  $("recentMachines").innerHTML = recent.length
    ? recent.map((machine) => {
      const totals = totalsForMachine(machine.id);
      回傳 `<button class="item itemButton" type="button" data-open-machine="${escapeHTML(machine.id)}">
        <div class="itemMain">
          <strong>${escapeHTML(machine.name)}</strong>
          <small>${escapeHTML(machine.code || "未填碼")}｜${escapeHTML(machine.category)}</small>
        </div>
        <div class="itemAmount">
          <strong>${money(totals.actual)}</strong>
          <小>實際費用</小>
        </div>
      </button>`;
    }）。加入（””）
    : '<div class="empty">尚無機器資料</div>';

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
      返回 `<article class="machineCard">
        <div class="machineImage ${machine.imageUrl ? "hasImage" : ""}">
          ${machine.imageUrl ? `<img src="${escapeHTML(machine.imageUrl)}" alt="${escapeHTML(machine.name)}" loading="lazy">` : `<span>${escapeHTML(machine.name.slice(machine.name.slice)(machine.name.slice)(machine.name.slice)(machine.name.2))上)(2))12))
        </div>
        <div class="machineCardBody">
          <div class="cardTags">
            <span class="tag">${escapeHTML(machine.category)}</span>
            <span class="tag">${orderCount}張成本單</span>
          </div>
          <h3>${escapeHTML(machine.name)}</h3>
          <p class="machineCode">${escapeHTML(machine.code || machine.id || "未填碼")}</p>
          <div class="stageCosts">
            <div><span>打樣版</span><strong>${money(totals.sample)}</strong></div>
            <div><span>測試台</span><strong>${money(totals.test)}</strong></div>
            <div class="actual"><span>實際費用</span><strong>${money(totals.actual)}</strong></div>
          </div>
          <button class="button secondary fullButton" type="button" data-open-machine="${escapeHTML(machine.id)}">查看所有項目</button>
        </div>
      </article>`;
    }）。加入（””）
    : '<div class="empty fullSpan">找不到符合條件的機器</div>';

  $("machineCards").querySelectorAll("[data-open-machine]").forEach((button) => {
    button.addEventListener("click", () => openMachineDialog(button.dataset.openMachine));
  });
}

function renderCostRecords() {
  const orders = [...filteredCostOrders()].sort((a, b) => dateValue(b.date) - dateValue(a.date));
  $("costRecordCount").textContent = `共 ${orders.length.toLocaleString("zh-TW")} 筆`;
  $("costRecordRows").innerHTML = orders.length
    orders.map((order) => {
      const machine = machineById(order.machineId);
      const link = order.quotationUrl
        ？ `<a class="textLink" href="${escapeHTML(order.quotationUrl)}" target="_blank" rel="noopener">查看圖片</a>`
        ："—";
      回傳 `<tr>
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
    }）。加入（””）
    : '<tr><td colspan="10" class="empty">成本單 API 尚未開通或目前沒有資料</td></tr>';
}

function renderMachineTotals() {
  const machines = filteredMachines();
  $("machineTotalRows").innerHTML = machines.length
    ? machines.map((machine) => {
      const totals = totalsForMachine(machine.id);
      const lastDate = latestMachineCostDate(machine.id);
      回傳 `<tr>
        <td><strong>${escapeHTML(machine.name)}</strong><br><small>${escapeHTML(machine.code || machine.id)}</small></td>
        <td>${escapeHTML(machine.category)}</td>
        <td>${money(totals.sample)}</td>
        <td>${money(totals.test)}</td>
        <td><strong>${money(totals.actual)}</strong></td>
        <td>${money(totals.development)}</td>
        <td>${escapeHTML(lastDate || machine.updatedAt || machine.createdAt || "—")}</td>
        <td><button class="tableAction" type="button" data-open-machine="${escapeHTML(machine.id)}">查看</button></td>
      </tr>`;
    }）。加入（””）
    : '<tr><td colspan="8" class="empty">尚無機器資料</td></tr>';
  $("machineTotalRows").querySelectorAll("[data-open-machine]").forEach((button) => {
    button.addEventListener("click", () => openMachineDialog(button.dataset.openMachine));
  });
}

function renderSuppliers() {
  const keyword = searchKeyword();
  const map = new Map();
  state.suppliers.forEach((supplier) => map.set(supplier.name, { ...supplier, total: 0, orderCount: 0, machines: new Set() }));
  state.costOrders.forEach((order) => {
    const 名稱 = order.supplier || "未填供應商";
    if (!map.has(name)) map.set(name, { id: "", name, contact: "", phone: "", email: "", note: "", total: 0, orderCount: 0, machines: new Set() });
    const supplier = map.get(name);
    供應商.total += orderTotal(order);
    供應商訂單數 += 1;
    如果 (訂單.機器 ID) 供應商.機器.新增(訂單.機器 ID);
  });
  const rows = [...map.values()]
    .filter((supplier) => !keyword || norm([supplier.name, supplier.contact, supplier.phone, supplier.email, supplier.note].join(" ")).includes(keyword))
    .sort((a, b) => b.total - a.total);
  $("supplierCards").innerHTML = rows.length
    rows.map((supplier) => `<article class="supplierCard">
      <span class="tag">供應商</span>
      <h3>${escapeHTML(供應商名稱)}</h3>
      <div class="price">${money(supplier.total)}</div>
      <div class="meta">
        <span class="label">成本單數</span><span>${supplier.orderCount}</span>
        <span class="label">機器數</span><span>${supplier.machines.size}</span>
        <span class="label">聯絡人</span><span>${escapeHTML(supplier.contact || "—")}</span>
        <span class="label">電話</span><span>${escapeHTML(supplier.phone || "—")}</span>
        <span class="label">電子郵件</span><span>${escapeHTML(supplier.email || "—")}</span>
      </div>
    </article>`).join("")
    : '<div class="empty fullSpan">供應商 API 尚未開通或目前沒有資料</div>';
}

函數 openMachineDialog(machineId) {
  const machine = machineById(machineId);
  如果（!machine）返回；
  state.selectedMachineId = machineId;
  const totals = totalsForMachine(machineId);
  $("machineDialogContent").innerHTML = `
    <div class="dialogHeader">
      <div class="dialogMachineImage ${machine.imageUrl ? "hasImage" : ""}">
        ${machine.imageUrl ? `<img src="${escapeHTML(machine.imageUrl)}" alt="${escapeHTML(machine.name)}">` : `<span>${escapeHTML(machine.name.slice(0, 2).UpperCase(`pan)>
      </div>
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
      <div><span>開發投入</span><strong>${money(totals.development)}</strong></div>
    </div>
    <div class="stageTabs" role="tablist">
      ${COST_TYPES.map((type, index) => `<button class="stageTab ${index === 0 ? "active" : ""}" type="button" data-stage="${escapeHTML(type)}">${escapeHTML(type)}</button>`).join("")}join(escapeHTML(type)}</button>`).join("")}.
    </div>
    <div id="dialogStageContent"></div>`;
  $("machineDialogContent").querySelectorAll("[data-stage]").forEach((button) => {
    button.addEventListener("click", () => {
      $("machineDialogContent").querySelectorAll("[data-stage]").forEach((item) => item.classList.remove("active"));
      button.classList.add("active");
      renderDialogStage(machineId, button.dataset.stage);
    });
  });
  renderDialogStage(machineId, COST_TYPES[0]);
  $("machineDialog").showModal();
}

function renderDialogStage(machineId, type) {
  const orders = state.costOrders.filter((order) => order.machineId === machineId && order.type === type);
  const orderIds = orders.map((order) => order.id);
  const items = state.costItems.filter((item) => orderIds.includes(item.costOrderId));
  const total = orders.reduce((sum, order) => sum + orderTotal(order), 0);
  const content = $("dialogStageContent");
  如果 (!orders.length && !items.length) {
    content.innerHTML = `<div class="emptydialogEmpty">尚未建立「${escapeHTML(type)}」資料</div>`;
    返回;
  }
  content.innerHTML = `
    <div class="dialogStageSummary">
      <span>${escapeHTML(type)}共${orders.length}張成本單、${items.length}個品項</span>
      <strong>${money(total)}</strong>
    </div>
    <div class="tableWrap">
      <table class="dialogTable">
        <thead><tr><th>項目</th><th>規格</th><th>數量</th><th>單位</th><th>單價</th><th>小計</th><th>備註</th></tr></thead>
        <tbody>${items.length ? items.map((item) => `<tr>
          <td>${escapeHTML(item.name || "—")}</td>
          <td>${escapeHTML(item.spec || "—")}</td>
          <td>${item.qty}</td>
          <td>${escapeHTML(item.unit || "—")}</td>
          <td>${money(item.price)}</td>
          <td><strong>${money(item.subtotal)}</strong></td>
          <td>${escapeHTML(item.note || "—")}</td>
        </tr>`).join("") : '<tr><td colspan="7" class="empty">成本單已建立，但尚無材料明細</td></tr>'}</tbody>
      </table>
    </div>`;
}

function renderDraftItems() {
  $("draftItemRows").innerHTML = state.draftItems.map((item, index) => `<tr data-index="${index}">
    <td>${index + 1}</td>
    <td><input class="tableInput itemNameInput" data-field="name" value="${escapeHTML(item.name)}" placeholder="商品名稱"></td>
    <td><input class="tableInput" data-field="spec" value="${escapeHTML(item.spec)}" placeholder="規格"></td>
    <td><input class="tableInput numberInput" data-field="qty" type="number" min="0" step="0.01" value="${item.qty}"></td>
    <td><input class="tableInput unitInput" data-field="unit" value="${escapeHTML(item.unit)}"></td>
    <td><input class="tableInput numberInput" data-field="price" type="number" min="0" step="0.01" value="${item.price || ""}"></td>
    <td data-subtotal><strong>${money(item.qty * item.price)}</strong></td>
    <td><input class="tableInput" data-field="note" value="${escapeHTML(item.note)}" placeholder="筆記"></td>
    <td><button class="removeRow" type="button" data-remove="${index}">刪除</button></td>
  </tr>`).join("");
  renderDraftSubtotal();
}

function renderDraftSubtotal() {
  const total = state.draftItems.reduce((sum, item) => sum + toNumber(item.qty) * toNumber(item.price), 0);
  $("draftSubtotal").textContent = money(total);
}

function machineById(machineId) {
  返回 state.machines.find((machine) => machine.id === machineId);
}

function orderTotal(order) {
  回訂單總額 || 訂單物料小計 + 訂單稅 + 訂單其他費用；
}

function totalsForMachine(machineId) {
  const totals = { sample: 0, test: 0, actual: 0, development: 0 };
  state.costOrders.filter((order) => order.machineId === machineId).forEach((order) => {
    const 總計 = orderTotal(order);
    if (order.type === "打樣版費用") Totals.sample += 總計;
    if (order.type === "測試台費用") Totals.test += Total;
    if (order.type === "實際費用") Totals.actual += 總計;
    總計.發展 += 總計;
  });
  返回總額；
}

function latestMachineCostDate(machineId) {
  返回狀態.costOrders
    .filter((order) => order.machineId === machineId)
    .map((order) => order.date)
    .filter(布林值)
    .sort((a, b) => dateValue(b) - dateValue(a))[0] || "";
}

function stageClass(type) {
  if (type === "打樣版費用") return "sample";
  if (type === "測試台費用") return "test";
  if (type === "實際費用") return "實際";
  返回 ””;
}

function renderBars(container, rows) {
  如果 (!rows.length) {
    container.innerHTML = '<div class="empty">尚無實際成本資料</div>';
    返回;
  }
  const max = Math.max(...rows.map((row) => row.total), 1);
  container.innerHTML = rows.map((row) => `<div class="barItem">
    <div class="barHead"><span>${escapeHTML(row.label)}</span><span>${money(row.total)}</span></div>
    <div class="barTrack"><div class="barFill" style="width:${Math.max(3, (row.total / max) * 100)}%"></div></div>
  </div>`).join("");
}

function setDataStatus(text, type = "") {
  $("dataStatus").textContent = 文字;
  $("dataStatus").className = `statusDot ${type}`.trim();
}

function showNotice(message, type = "") {
  $("通知").textContent = 訊息;
  $("notice").className = `notice ${type}`.trim();
  $("notice").hidden = false;
}

function hideNotice() {
  $("notice").hidden = true;
}

function unique(values) {
  返回 [...new Set(values)];
}

function todayValue() {
  const now = new Date();
  const local = new Date(now.getTime() - now.getTimezoneOffset() * 60000);
  return local.toISOString().slice(0, 10);
}

函數 csvCell(value) {
  const text = String(value ?? "");
  return /[",\n\r]/.test(text) ? `"${text.replaceAll('"', '""')}"` : text;
}

function downloadCsv(rows, filename) {
  const content = "\uFEFF" + rows.map((row) => row.map(csvCell).join(",")).join("\r\n");
  const blob = new Blob([content], { type: "text/csv;charset=utf-8" });
  const url = URL.createObjectURL(blob);
  const link = document.createElement("a");
  link.href = url;
  連結.下載 = 檔名;
  document.body.appendChild(link);
  連結.點擊();
  連結.移除();
  URL.revokeObjectURL(url);
}
