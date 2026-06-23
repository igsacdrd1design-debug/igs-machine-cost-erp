// =====================================================
// IGS 機台材料成本 ERP — 前端 v1
// 目前支援 Apps Script GET：getMachines、getSettings。
// 成本單、成本明細、供應商 API 會自動嘗試讀取；後端尚未建立時保持空白。
// =====================================================

const APPS_SCRIPT_URL = "https://script.google.com/macros/s/AKfycbwwDS05GM-oWngHd2GOslFPTrr0ab8O3kamuoSloY-_1QJJHu7jFDH4hDI_-J3qF9In/exec";
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
  quotationEntry: "上傳估價單圖片並建立材料成本草稿。",
  quickMachine: "快速建立新的機台主檔。",
  suppliers: "查看供應商與成本單金額。",
};

let state = {
  machines: [],
  costOrders: [],
  costItems: [],
  suppliers: [],
  settings: [],
  draftItems: [],
  selectedMachineId: "",
};

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
    materialSubtotal: toNumber(firstValue(row, ["材料小計", "materialSubtotal"])),
    tax: toNumber(firstValue(row, ["稅額", "tax"])),
    other: toNumber(firstValue(row, ["其他費用", "other"])),
    total: toNumber(firstValue(row, ["階段總成本", "含稅總成本", "total"])),
    quotationUrl: String(firstValue(row, ["估價單圖片URL", "原始圖片URL", "quotationUrl"])),
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
    name: String(firstValue(row, ["品項名稱", "品項", "name"])),
    spec: String(firstValue(row, ["規格", "spec"])),
    qty,
    unit: String(firstValue(row, ["單位", "unit"])),
    price,
    subtotal: subtotal || qty * price,
    imageUrl: String(firstValue(row, ["品項圖片URL", "imageUrl"])),
    note: String(firstValue(row, ["備註", "note"])),
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

async function fetchAction(action) {
  if (!APPS_SCRIPT_URL.includes("/exec")) throw new Error("尚未設定 Apps Script 網址");
  const separator = APPS_SCRIPT_URL.includes("?") ? "&" : "?";
  const url = `${APPS_SCRIPT_URL}${separator}action=${encodeURIComponent(action)}&t=${Date.now()}`;
  const response = await fetch(url, { cache: "no-store", redirect: "follow" });
  if (!response.ok) throw new Error(`${action} 讀取失敗：${response.status}`);
  const result = await response.json();
  if (!result.success) throw new Error(result.error || `${action} 讀取失敗`);
  return Array.isArray(result.data) ? result.data : [];
}

async function optionalFetch(action) {
  try {
    return {
      ok: true,
      data: await fetchAction(action),
      error: "",
    };
  } catch (error) {
    console.info(`${action} 尚未啟用：`, error.message);
    return {
      ok: false,
      data: [],
      error: error.message || String(error),
    };
  }
}

document.addEventListener("DOMContentLoaded", () => {
  setupNavigation();
  setupSearch();
  setupFilters();
  setupDialog();
  setupForms();
  setupQuotationPreview();
  setupDraftItems();
  setupExport();
  $("quotationDate").value = todayValue();
  loadData();
});

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
      $("globalSearch").style.display = ["quotationEntry", "quickMachine"].includes(viewId) ? "none" : "block";
      window.scrollTo({ top: 0, behavior: "smooth" });
    });
  });
  $("reloadData").addEventListener("click", loadData);
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
  $("machineForm").addEventListener("submit", (event) => {
    event.preventDefault();
    showNotice("機台草稿已完成。下一步更新 Apps Script 後，這個按鈕才會正式寫入 Google Sheet。", "warn");
  });
  $("resetMachineForm").addEventListener("click", () => $("machineForm").reset());
  $("quotationForm").addEventListener("submit", (event) => {
    event.preventDefault();
    if (!state.draftItems.length) {
      showNotice("請先新增至少一個材料品項。", "warn");
      return;
    }
    showNotice("成本單草稿已整理完成。下一步更新 Apps Script 後即可連同圖片寫入 Google Sheet。", "warn");
  });
}

function setupQuotationPreview() {
  $("quotationFile").addEventListener("change", (event) => {
    const file = event.target.files?.[0];
    if (!file) return;
    if (!file.type.startsWith("image/")) {
      showNotice("請選擇圖片檔案。", "error");
      event.target.value = "";
      return;
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
    if (!input || !row) return;
    const item = state.draftItems[Number(row.dataset.index)];
    if (!item) return;
    const field = input.dataset.field;
    item[field] = ["qty", "price"].includes(field) ? toNumber(input.value) : input.value;
    renderDraftSubtotal();
    if (["qty", "price"].includes(field)) {
      const subtotalCell = row.querySelector("[data-subtotal]");
      if (subtotalCell) subtotalCell.textContent = money(item.qty * item.price);
    }
  });
  $("draftItemRows").addEventListener("click", (event) => {
    const button = event.target.closest("[data-remove]");
    if (!button) return;
    state.draftItems.splice(Number(button.dataset.remove), 1);
    renderDraftItems();
  });
  state.draftItems.push({ name: "", spec: "", qty: 1, unit: "件", price: 0, note: "" });
  renderDraftItems();
}

function setupExport() {
  $("exportCostsCsv").addEventListener("click", () => {
    const rows = filteredCostOrders();
    if (!rows.length) {
      showNotice("目前沒有可匯出的成本紀錄。", "warn");
      return;
    }
    const header = ["日期", "機台", "費用類型", "供應商", "專案名稱", "材料小計", "稅額", "其他費用", "階段總成本", "估價單圖片URL"];
    const body = rows.map((order) => {
      const machine = machineById(order.machineId);
      return [order.date, machine?.name || order.machineId, order.type, order.supplier, order.project, order.materialSubtotal, order.tax, order.other, orderTotal(order), order.quotationUrl];
    });
    downloadCsv([header, ...body], "IGS_成本紀錄.csv");
  });
}

async function loadData() {
  setDataStatus("資料讀取中", "");
  showNotice("正在讀取 Google Sheet…");
  try {
    const [machineRows, settingRows] = await Promise.all([
      fetchAction("getMachines"),
      fetchAction("getSettings"),
    ]);
    const [costOrderResult, costItemResult, supplierResult] = await Promise.all([
      optionalFetch("getCostOrders"),
      optionalFetch("getCostItems"),
      optionalFetch("getSuppliers"),
    ]);

    const costOrderRows = costOrderResult.data;
    const costItemRows = costItemResult.data;
    const supplierRows = supplierResult.data;

    const offline = window.IGS_OFFLINE_DATA || {};
    state.machines = (machineRows.length ? machineRows : offline.machines || []).map(normalizeMachine);
    state.settings = settingRows.length ? settingRows : offline.settings || [];
    state.costOrders = (costOrderRows.length ? costOrderRows : offline.costOrders || []).map(normalizeCostOrder);
    state.costItems = (costItemRows.length ? costItemRows : offline.costItems || []).map(normalizeCostItem);
    state.suppliers = (supplierRows.length ? supplierRows : offline.suppliers || []).map(normalizeSupplier);

    populateControls();
    renderAll();
    setDataStatus("Google Sheet 已同步", "ok");

    const unavailableApis = [];
    if (!costOrderResult.ok) unavailableApis.push("成本單");
    if (!costItemResult.ok) unavailableApis.push("成本明細");
    if (!supplierResult.ok) unavailableApis.push("供應商");

    if (unavailableApis.length) {
      showNotice(`機台主檔已連線，但${unavailableApis.join("、")} API 尚未啟用。`, "warn");
    } else {
      hideNotice();
    }
  } catch (error) {
    console.error(error);
    const offline = window.IGS_OFFLINE_DATA || {};
    state.machines = (offline.machines || []).map(normalizeMachine);
    state.costOrders = (offline.costOrders || []).map(normalizeCostOrder);
    state.costItems = (offline.costItems || []).map(normalizeCostItem);
    state.suppliers = (offline.suppliers || []).map(normalizeSupplier);
    state.settings = offline.settings || [];
    populateControls();
    renderAll();
    setDataStatus("資料讀取失敗", "error");
    showNotice(`Google Sheet 讀取失敗：${error.message}`, "error");
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

  const supplierNames = unique([
    ...state.suppliers.map((supplier) => supplier.name),
    ...state.costOrders.map((order) => order.supplier),
  ]).filter(Boolean);
  $("supplierOptions").innerHTML = supplierNames.map((name) => `<option value="${escapeHTML(name)}"></option>`).join("");
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
        <div class="machineImage ${machine.imageUrl ? "hasImage" : ""}">
          ${machine.imageUrl ? `<img src="${escapeHTML(machine.imageUrl)}" alt="${escapeHTML(machine.name)}" loading="lazy">` : `<span>${escapeHTML(machine.name.slice(0, 2).toUpperCase())}</span>`}
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
}

function renderCostRecords() {
  const orders = [...filteredCostOrders()].sort((a, b) => dateValue(b.date) - dateValue(a.date));
  $("costRecordCount").textContent = `共 ${orders.length.toLocaleString("zh-TW")} 筆`;
  $("costRecordRows").innerHTML = orders.length
    ? orders.map((order) => {
      const machine = machineById(order.machineId);
      const link = order.quotationUrl
        ? `<a class="textLink" href="${escapeHTML(order.quotationUrl)}" target="_blank" rel="noopener">查看圖片</a>`
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
  const totals = totalsForMachine(machineId);
  $("machineDialogContent").innerHTML = `
    <div class="dialogHeader">
      <div class="dialogMachineImage ${machine.imageUrl ? "hasImage" : ""}">
        ${machine.imageUrl ? `<img src="${escapeHTML(machine.imageUrl)}" alt="${escapeHTML(machine.name)}">` : `<span>${escapeHTML(machine.name.slice(0, 2).toUpperCase())}</span>`}
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
      <div><span>開發累積投入</span><strong>${money(totals.development)}</strong></div>
    </div>
    <div class="stageTabs" role="tablist">
      ${COST_TYPES.map((type, index) => `<button class="stageTab ${index === 0 ? "active" : ""}" type="button" data-stage="${escapeHTML(type)}">${escapeHTML(type)}</button>`).join("")}
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
  if (!orders.length && !items.length) {
    content.innerHTML = `<div class="empty dialogEmpty">尚未建立「${escapeHTML(type)}」資料</div>`;
    return;
  }
  content.innerHTML = `
    <div class="dialogStageSummary">
      <span>${escapeHTML(type)}共 ${orders.length} 張成本單、${items.length} 個品項</span>
      <strong>${money(total)}</strong>
    </div>
    <div class="tableWrap">
      <table class="dialogTable">
        <thead><tr><th>品項</th><th>規格</th><th>數量</th><th>單位</th><th>單價</th><th>小計</th><th>備註</th></tr></thead>
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
    <td><input class="tableInput itemNameInput" data-field="name" value="${escapeHTML(item.name)}" placeholder="品項名稱"></td>
    <td><input class="tableInput" data-field="spec" value="${escapeHTML(item.spec)}" placeholder="規格"></td>
    <td><input class="tableInput numberInput" data-field="qty" type="number" min="0" step="0.01" value="${item.qty}"></td>
    <td><input class="tableInput unitInput" data-field="unit" value="${escapeHTML(item.unit)}"></td>
    <td><input class="tableInput numberInput" data-field="price" type="number" min="0" step="0.01" value="${item.price || ""}"></td>
    <td data-subtotal><strong>${money(item.qty * item.price)}</strong></td>
    <td><input class="tableInput" data-field="note" value="${escapeHTML(item.note)}" placeholder="備註"></td>
    <td><button class="removeRow" type="button" data-remove="${index}">刪除</button></td>
  </tr>`).join("");
  renderDraftSubtotal();
}

function renderDraftSubtotal() {
  const total = state.draftItems.reduce((sum, item) => sum + toNumber(item.qty) * toNumber(item.price), 0);
  $("draftSubtotal").textContent = money(total);
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
