/* IGS ERP app.js — v3.6 四份資料安全匯入＋機台總覽 */
// =====================================================
// IGS 機台材料成本 ERP — 前端 v3.2 加工分級估價版
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

const STANDARD_MATERIAL_OPTIONS = Object.freeze([
  "透明壓克力", "冬瓜白壓克力", "乳白壓克力", "霧面壓克力", "黑色壓克力", "鏡面壓克力", "導光壓克力", "螢光壓克力",
  "PVC", "透明PVC", "鏡面PVC", "安迪板", "PC", "PET",
  "亞光貼紙", "透明貼紙", "鏡面貼紙", "銀貼紙", "合成貼紙", "地板貼",
  "3D膜", "燈條", "立體字", "其他"
]);

const PROCESS_TAG_GROUPS = Object.freeze([
  { label: "印刷", tags: ["四色直噴", "白色直噴", "黑色直噴", "四色黑", "正面印刷", "背面印刷", "不透光銀底印刷"] },
  { label: "表面效果", tags: ["鏡面貼紙", "亮膜", "霧膜", "3D膜", "七彩雷射膜", "背膠"] },
  { label: "加工", tags: ["裁切外型", "異型切割", "雕刻", "導C角", "導R角", "壓克力折彎", "熱彎成型", "鑽孔", "攻牙", "銑槽／銑溝", "燒光", "烤漆", "蝕刻"] },
  { label: "其他", tags: ["導光", "發光字", "無印刷"] }
]);

const PROCESS_TAG_ALIASES = Object.freeze({
  "四色": "四色直噴", "四色印刷": "四色直噴", "四色直噴": "四色直噴",
  "白色": "白色直噴", "白墨": "白色直噴", "白色印刷": "白色直噴", "白色直噴": "白色直噴",
  "黑色": "黑色直噴", "黑墨": "黑色直噴", "黑色印刷": "黑色直噴", "黑色直噴": "黑色直噴",
  "四色黑": "四色黑", "正面": "正面印刷", "正面印刷": "正面印刷",
  "背面": "背面印刷", "背面印刷": "背面印刷", "背噴": "背面印刷",
  "銀底": "不透光銀底印刷", "不透光銀底": "不透光銀底印刷", "不透光銀底印刷": "不透光銀底印刷",
  "鏡面": "鏡面貼紙", "鏡面貼紙": "鏡面貼紙", "亮膜": "亮膜", "裱亮膜": "亮膜",
  "霧膜": "霧膜", "裱霧膜": "霧膜", "3d膜": "3D膜", "滿天星": "3D膜",
  "七彩雷射膜": "七彩雷射膜", "雷射膜": "七彩雷射膜", "背膠": "背膠",
  "裁切": "裁切外型", "切割": "裁切外型", "切割外型": "裁切外型", "裁切外型": "裁切外型", "異型切割": "異型切割", "異形切割": "異型切割", "複雜切割": "異型切割",
  "雕刻": "雕刻", "導c角": "導C角", "導C角": "導C角", "折彎": "壓克力折彎",
  "壓克力折彎": "壓克力折彎", "熱彎": "熱彎成型", "熱彎成型": "熱彎成型", "鑽孔": "鑽孔", "攻牙": "攻牙", "導r角": "導R角", "導R角": "導R角", "銑槽": "銑槽／銑溝", "銑溝": "銑槽／銑溝",
  "銑槽／銑溝": "銑槽／銑溝", "燒光": "燒光", "拋光": "燒光",
  "烤漆": "烤漆", "蝕刻": "蝕刻", "導光": "導光", "發光字": "發光字", "立體字": "發光字", "無印刷": "無印刷"
});

const pageDescriptions = {
  dashboard: "搜尋歷史價格，或直接進入公式估算器。",
  machines: "未輸入關鍵字時顯示全部機台，也可依名稱、代碼、分類或材料搜尋。",
  costRecords: "查看各機台的成本單與原始估價單。",
  machineTotals: "彙整每台機台的個別成本總和。",
  quotationEntry: "上傳圖片或 PDF，將成本歸入既有機台並確認稅額與安裝區域。",
  quickMachine: "快速建立新的機台主檔。",
  suppliers: "查看供應商與成本單金額。",
  machine360Setup: "上傳一至四張基準角度圖，使用 AI 補中間角度並建立可旋轉的主管成本頁。",
  dataImport: "一次檢查並依序匯入材料、製程、歷史報價與量產參考四份資料。",
  priceCenter: "管理公司材料價格並查詢網路市場浮動。",
  smartEstimate: "硬公式估價：一般板材採整才包價，超大件拆項，特殊製程另外計價。",
  artOptimization: "僅針對美術材料與印刷製程提出降本及視覺概念模擬。",
};



const ESTIMATE_PRICING_CONFIG = Object.freeze({
  TSAI_AREA_MM2: 90000,
  SAMPLE_TWD_TO_RMB_DIVISOR: 4.5,
  SAMPLE_RMB_TO_PRODUCTION_RMB_DIVISOR: 3.3,
  MATERIAL_WASTE_RATE: Object.freeze({
    '壓克力': 15,
    'PVC': 8,
    '貼紙': 10,
    '安迪板': 10,
    '3D膜': 10,
  }),
});


// v3.5 統一估價規格：一般板材採「每才包價」，超大件改用拆項估算。
// 包價已包含材料、四色印刷、白墨與基本矩形切割，因此不可再重複疊加材料倍率、印刷費或材料損耗。
const UNIFIED_BUNDLE_PRICE_PER_TSAI = Object.freeze({
  '透明壓克力_3mm': 350,
  '透明壓克力_5mm': 450,
  '透明壓克力_8mm': 900,
  '透明壓克力_10mm': 750,
  '透明壓克力_12mm': 950,
  '冬瓜白壓克力_10mm': 750,
  '冬瓜白壓克力_12mm': 950,
  '霧面壓克力_3mm': 380,
  '霧面壓克力_5mm': 480,
  '黑色壓克力_3mm': 380,
  '黑色壓克力_5mm': 480,
  'PC_0.5mm': 200,
  'PC_1mm': 250,
  'PVC_1mm': 200,
  '鏡面PVC_1mm': 180,
  '安迪板_5mm': 150,
});

const UNIFIED_RAW_MATERIAL_PER_TSAI = Object.freeze({
  '透明壓克力_3mm': 126,
  '透明壓克力_5mm': 210,
  '透明壓克力_8mm': 340,
  '透明壓克力_10mm': 375,
  '透明壓克力_12mm': 580,
  '冬瓜白壓克力_10mm': 375,
  '冬瓜白壓克力_12mm': 580,
  '霧面壓克力_3mm': 145,
  '霧面壓克力_5mm': 230,
  '黑色壓克力_3mm': 145,
  '黑色壓克力_5mm': 230,
  'PC_0.5mm': 60,
  'PC_1mm': 110,
  'PVC_1mm': 84,
  '鏡面PVC_1mm': 90,
  '安迪板_5mm': 40,
});

const UNIFIED_PER_PIECE_PRICE = Object.freeze({
  '透明貼紙': 50,
  '亞光貼紙': 50,
  '鏡面貼紙': 118,
  '銀貼紙': 100,
  '合成貼紙': 90,
});

const UNIFIED_MINIMUM_CHARGE = Object.freeze({
  '壓克力': 150,
  'PC': 140,
  'PVC': 140,
  '安迪板': 140,
  '貼紙': 50,
});

const UNIFIED_SPECIAL_PROCESS_PRICE = Object.freeze({
  '3D膜': Object.freeze({ type: '每才', price: 200 }),
  '壓克力折彎': Object.freeze({ type: '每件', price: 350 }),
  '雕刻': Object.freeze({ type: '每件', price: 200 }),
  '鏡面貼紙': Object.freeze({ type: '每件', price: 100 }),
  '導C角': Object.freeze({ type: '每件', price: 100 }),
  '燒光': Object.freeze({ type: '每件', price: 150 }),
  '黑色直噴': Object.freeze({ type: '每才', price: 150 }),
  '異型切割': Object.freeze({ type: '每件', price: 100 }),
  '鑽孔': Object.freeze({ type: '每孔', price: 15 }),
});

const UNIFIED_INCLUDED_PROCESS_TAGS = Object.freeze(new Set([
  '四色直噴', '白色直噴', '裁切外型', '背膠', '正面印刷', '背面印刷'
]));

const UNIFIED_LARGE_ITEM_THRESHOLD_TSAI = 10;
const UNIFIED_LARGE_PRINT_RATE_TWD = 140;
const UNIFIED_LARGE_BASIC_PROCESSING_TWD = 100;
const UNIFIED_STAGE_CONVERSION = Object.freeze({
  productionTwd: 1 / 3.2,
  sampleRmb: 1 / 4.5,
  productionRmb: 1 / (4.5 * 3.2),
});

// L1～L4 僅保留舊資料相容；AUTO 不再自動加價。
// 新估價以「四色＋白墨包價＋逐項特殊製程」為主。
const PROCESSING_LEVEL_CONFIG = Object.freeze({
  NONE: Object.freeze({ code: 'NONE', label: '不計舊版加工等級', ruleName: '', base: 0, low: 0, high: 0 }),
  L1: Object.freeze({ code: 'L1', label: 'L1 舊版基本加工', ruleName: 'L1 基本加工', base: 120, low: 100, high: 180 }),
  L2: Object.freeze({ code: 'L2', label: 'L2 舊版一般異形', ruleName: 'L2 一般異形', base: 340, low: 280, high: 400 }),
  L3: Object.freeze({ code: 'L3', label: 'L3 舊版複雜異形', ruleName: 'L3 複雜異形', base: 410, low: 350, high: 480 }),
  L4: Object.freeze({ code: 'L4', label: 'L4 舊版高複雜加工', ruleName: 'L4 高複雜加工', base: 610, low: 520, high: 700 }),
});

const PROCESSING_LEVEL_OPTIONS = Object.freeze([
  ['AUTO', '自動（新版包價模式，不另加 L1～L4）'],
  ['NONE', '不計舊版加工等級'],
  ['L1', '人工套用 L1 舊版加工費'],
  ['L2', '人工套用 L2 舊版加工費'],
  ['L3', '人工套用 L3 舊版加工費'],
  ['L4', '人工套用 L4 舊版加工費'],
]);

function makeBuiltinRule(id,type,name,category,thicknessMm,sizeTier,pricingMethod,rawTwd,sampleTwd,productionTwd=0,source='使用者確認基準',certification='已確認基準',active='是',note=''){
  return Object.freeze({
    id,type,name,category,thicknessMm,sizeTier,pricingMethod,
    rawTwd,sampleTwd,productionTwd,sampleRmb:0,productionRmb:0,
    priceDate:'2026-06-24',source,certification,active,note
  });
}

const BUILTIN_INTERNAL_PRICE_RULES = Object.freeze([
  makeBuiltinRule('IPR001','材料','透明壓克力','壓克力',12,'100×100最低價','固定最低價',580,580),
  makeBuiltinRule('IPR002','材料','透明壓克力','壓克力',12,'300×300最低價','固定最低價',580,580),
  makeBuiltinRule('IPR003','材料','透明壓克力','壓克力',12,'面積才數','每才',580,580),
  makeBuiltinRule('IPR004','材料','透明壓克力','壓克力',8,'100×100最低價','固定最低價',340,340),
  makeBuiltinRule('IPR005','材料','透明壓克力','壓克力',8,'300×300最低價','固定最低價',340,340),
  makeBuiltinRule('IPR006','材料','透明壓克力','壓克力',8,'面積才數','每才',340,340),
  makeBuiltinRule('IPR007','材料','透明壓克力','壓克力',5,'100×100最低價','固定最低價',210,420),
  makeBuiltinRule('IPR008','材料','透明壓克力','壓克力',5,'300×300最低價','固定最低價',210,420),
  makeBuiltinRule('IPR009','材料','透明壓克力','壓克力',5,'面積才數','每才',210,420),
  makeBuiltinRule('IPR010','材料','透明壓克力','壓克力',3,'100×100最低價','固定最低價',126,163.8),
  makeBuiltinRule('IPR011','材料','透明壓克力','壓克力',3,'300×300最低價','固定最低價',126,163.8),
  makeBuiltinRule('IPR012','材料','透明壓克力','壓克力',3,'面積才數','每才',126,163.8),
  makeBuiltinRule('IPR013','材料','PVC','PVC',1,'100×100最低價','固定最低價',84,84),
  makeBuiltinRule('IPR014','材料','PVC','PVC',1,'300×300最低價','固定最低價',84,84),
  makeBuiltinRule('IPR015','材料','PVC','PVC',1,'面積才數','每才',84,84),
  makeBuiltinRule('IPR016','材料','安迪板','安迪板',5,'100×100最低價','固定最低價',40,40),
  makeBuiltinRule('IPR017','材料','安迪板','安迪板',5,'300×300最低價','固定最低價',40,40),
  makeBuiltinRule('IPR018','材料','安迪板','安迪板',5,'面積才數','每才',40,40),
  makeBuiltinRule('IPR019','材料','亞光貼紙','貼紙',0,'100×100最低價','固定最低價',66,66),
  makeBuiltinRule('IPR020','材料','亞光貼紙','貼紙',0,'300×300最低價','固定最低價',66,66),
  makeBuiltinRule('IPR021','材料','亞光貼紙','貼紙',0,'面積才數','每才',66,66),
  makeBuiltinRule('IPR022','材料','透明貼紙','貼紙',0,'100×100最低價','固定最低價',66,66),
  makeBuiltinRule('IPR023','材料','透明貼紙','貼紙',0,'300×300最低價','固定最低價',66,66),
  makeBuiltinRule('IPR024','材料','透明貼紙','貼紙',0,'面積才數','每才',66,66),
  makeBuiltinRule('IPR025','材料','鏡面貼紙','貼紙',0,'100×100最低價','固定最低價',118,118),
  makeBuiltinRule('IPR026','材料','鏡面貼紙','貼紙',0,'300×300最低價','固定最低價',118,118),
  makeBuiltinRule('IPR027','材料','鏡面貼紙','貼紙',0,'面積才數','每才',118,118),
  makeBuiltinRule('IPR028','印刷加工','四色印刷＋白墨','印刷',0,'100×100最低價','每才',0,200,0,'公司成交價'),
  makeBuiltinRule('IPR029','印刷加工','四色印刷＋白墨','印刷',0,'300×300最低價','每才',0,200,0,'公司成交價'),
  makeBuiltinRule('IPR030','印刷加工','四色印刷＋白墨','印刷',0,'面積才數','每才',0,200,0,'公司成交價'),
  makeBuiltinRule('IPR031','印刷加工','雕刻','加工',0,'每件一次','每件',0,0,0,'待詢價','待補','是','未定義單價時顯示待補'),
  makeBuiltinRule('IPR032','印刷加工','導C角','加工',0,'每件一次','每件',0,0,0,'待詢價','待補','是','未定義單價時顯示待補'),
  makeBuiltinRule('IPR033','印刷加工','燒光(火拋光)','加工',0,'每件一次','每件',0,0,0,'待詢價','待補','是','未定義單價時顯示待補'),
  makeBuiltinRule('IPR034','印刷加工','壓克力折彎','加工',0,'每件一次','每件',0,0,0,'待詢價','待補','是','未定義單價時顯示待補'),
  makeBuiltinRule('IPR035','印刷加工','3D膜','貼合',0,'面積才數','每才',0,0,0,'待詢價','待補','是','建議另行詢價；可填每才單價'),
  makeBuiltinRule('IPR036','印刷加工','切割外型(異型)','加工',0,'每件一次','每件',0,0,0,'待詢價','待補','是','基本切割含在四色白墨包價，異型切割另計'),
  makeBuiltinRule('IPR037','印刷加工','鑽孔','加工',0,'每件一次','每件',0,0,0,'待詢價','待補','是'),
  makeBuiltinRule('IPR038','印刷加工','銑槽／銑溝','加工',0,'每件一次','每件',0,0,0,'待詢價','待補','是'),
  makeBuiltinRule('IPR039','印刷加工','亮膜','貼合',0,'面積才數','每才',0,0,0,'待詢價','待補','是'),
  makeBuiltinRule('IPR040','印刷加工','霧膜','貼合',0,'面積才數','每才',0,0,0,'待詢價','待補','是'),
  makeBuiltinRule('IPR041','印刷加工','黑色直噴','印刷',0,'面積才數','每才',0,0,0,'待詢價','待補','是'),
  makeBuiltinRule('IPR042','印刷加工','不透光銀底印刷','印刷',0,'面積才數','每才',0,0,0,'待詢價','待補','是'),
  makeBuiltinRule('IPR043','加工等級','L1 基本加工','加工',0,'每件一次','每件',0,120,0,'舊版相容','舊版候選','否'),
  makeBuiltinRule('IPR044','加工等級','L2 一般異形','加工',0,'每件一次','每件',0,340,0,'舊版相容','舊版候選','否'),
  makeBuiltinRule('IPR045','加工等級','L3 複雜異形','加工',0,'每件一次','每件',0,410,0,'舊版相容','舊版候選','否'),
  makeBuiltinRule('IPR046','加工等級','L4 高複雜加工','加工',0,'每件一次','每件',0,610,0,'舊版相容','舊版候選','否'),
  makeBuiltinRule('IPR047','包價包含','基本切割','加工',0,'不限','包價包含',0,0,0,'公司規則','已確認基準','是','四色印刷＋白墨包價已含基本切割'),
  makeBuiltinRule('IPR048','包價包含','背膠加工','貼合',0,'不限','包價包含',0,0,0,'公司規則','已確認基準','是','背膠加工包含在基本費'),
]);


function mergedInternalPriceRules(){
  const merged=new Map();
  BUILTIN_INTERNAL_PRICE_RULES.forEach((rule,index)=>{
    const key=String(rule.id||`BUILTIN-${index}`).trim();
    merged.set(key,{...rule});
  });
  (state.internalPriceRules||[]).forEach((rule,index)=>{
    const key=String(rule.id||`SHEET-${index}`).trim();
    const prior=merged.get(key)||{};
    merged.set(key,{...prior,...rule});
  });
  return [...merged.values()];
}

let authToken = sessionStorage.getItem(AUTH_TOKEN_KEY) || "";
let authenticationReady = false;
let aiCredentialStatus = { configured: false, source: "none", label: "尚未設定 AI 額度", maskedKey: "" };

let state = {
  machines: [],
  costOrders: [],
  costItems: [],
  suppliers: [],
  settings: [],
  machineAreas: [],
  machine360Views: [],
  machine360Frames: [],
  materialPrices: [],
  lightStripPrices: [],
  marketIndexes: [],
  estimateProjects: [],
  estimateItems: [],
  artRecommendations: [],
  artSimulations: [],
  termDictionary: [],
  sizeRules: [],
  internalPriceRules: [],
  priceReviews: [],
  productionPriceReferences: [],
  referenceImportFiles: { material: null, process: null, history: null, production: null },
  referenceImportValidation: {},
  priceReviewProcessImagePayload: null,
  estimateDraftItems: [],
  currentMarketResearch: null,
  currentOptimization: null,
  currentEstimateId: "",
  machine360Draft: {},
  draftItems: [],
  stagedMachines: loadStagedMachines(),
  selectedMachineId: "",
  machineImagePayload: null,
  quotationDocumentPayload: null,
  quotationAiStatus: "未辨識",
  quotationRawText: "",
  estimateDocumentPayload: null,
  estimateAiRawText: "",
  selectedMachineStage: COST_TYPES[0],
  selectedMachineArea: "",
  machine360ViewerIndex: 0,
  machine360ViewerPointerX: null,
  machine360ViewerLastX: null,
  machine360ViewerAutoTimer: null,
  dialogMachine360Index: 0,
  dialogMachine360PointerX: null,
  dialogMachine360LastX: null,
  dialogMachine360AutoTimer: null,
  machine360AiGenerating: false,
  machineMarkerDraft: {
    areaId: "",
    viewKey: "FRONT",
    name: "",
    x: 44,
    y: 44,
    width: 12,
    height: 10,
    itemIds: [],
  },
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

function roundCurrency(value) {
  return Math.round((toNumber(value) + Number.EPSILON) * 100) / 100;
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

function canonicalProcessTag(value) {
  const text = standardizeErpText ? standardizeErpText(value) : String(value || "");
  const trimmed = String(text || "").trim();
  if (!trimmed) return "";
  return PROCESS_TAG_ALIASES[trimmed] || PROCESS_TAG_ALIASES[trimmed.toLowerCase()] || trimmed;
}

function normalizeProcessTags(value) {
  const source = Array.isArray(value) ? value : String(value || "").split(/[、,，＋+;；\n]/);
  return unique(source.map(canonicalProcessTag).filter(Boolean));
}

function processTagsText(value) {
  return normalizeProcessTags(value).join("、");
}

function processTagButtonsHtml(value, attributeName, attributeValue) {
  const selected = new Set(normalizeProcessTags(value));
  return PROCESS_TAG_GROUPS.map((group) => `<div class="processTagGroup"><span>${escapeHTML(group.label)}</span><div>${group.tags.map((tag) => `<button type="button" class="processTagButton ${selected.has(tag) ? "selected" : ""}" ${attributeName}="${escapeHTML(attributeValue)}" data-process-tag="${escapeHTML(tag)}" aria-pressed="${selected.has(tag) ? "true" : "false"}">${escapeHTML(tag)}</button>`).join("")}</div></div>`).join("");
}

function standardMaterialList() {
  const dynamic = [
    ...state.materialPrices.map((row) => row.name),
    ...state.internalPriceRules.filter((row) => row.type === "材料").map((row) => row.name),
    ...state.priceReviews.map((row) => row.material),
    ...state.costItems.map((row) => row.material),
  ];
  return unique([...STANDARD_MATERIAL_OPTIONS, ...dynamic].map((value) => String(value || "").trim()).filter(Boolean));
}

function standardMaterialOptionsHtml(selectedValue, includeBlank = true) {
  const selected = String(selectedValue || "").trim();
  const options = standardMaterialList();
  if (selected && !options.includes(selected)) options.unshift(selected);
  return `${includeBlank ? '<option value="">請選擇標準材質</option>' : ""}${options.map((option) => `<option value="${escapeHTML(option)}" ${option === selected ? "selected" : ""}>${escapeHTML(option)}</option>`).join("")}`;
}

function setSelectOptions(select, selectedValue) {
  if (!select) return;
  select.innerHTML = standardMaterialOptionsHtml(selectedValue);
  select.value = String(selectedValue || "");
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
    processTags: String(firstValue(row, ["製程標籤", "processTags"])),
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
    viewKey: String(firstValue(row, ["視角代碼", "viewKey"], "FRONT")) || "FRONT",
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

function normalizeMachine360Frame(row) {
  const angle = toNumber(firstValue(row, ["角度", "angle"]));
  return {
    id: String(firstValue(row, ["影格ID", "frameId", "id"])),
    machineId: String(firstValue(row, ["機台ID", "machineId"])),
    angle,
    viewKey: `AI_${String(angle).replace(".", "_").padStart(3, "0")}`,
    viewName: String(firstValue(row, ["視角名稱", "viewName"], `AI ${angle}°`)),
    sourceType: String(firstValue(row, ["來源類型", "sourceType"], "AI生成")),
    sourceViews: String(firstValue(row, ["基準來源", "sourceViews"])),
    imageUrl: String(firstValue(row, ["圖片URL", "imageUrl"])),
    imageFileId: String(firstValue(row, ["圖片檔案ID", "imageFileId"])),
    model: String(firstValue(row, ["AI模型", "model"])),
    aiStatus: String(firstValue(row, ["AI狀態", "aiStatus"])),
    reviewStatus: String(firstValue(row, ["審核狀態", "reviewStatus"], "待審核")),
    prompt: String(firstValue(row, ["提示詞", "prompt"])),
    createdAt: String(firstValue(row, ["建立時間", "createdAt"])),
    updatedAt: String(firstValue(row, ["更新時間", "updatedAt"])),
    isAiFrame: true,
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
  setupV20();
  setupReferenceDataImport();
  setupExport();
  setupSecureImageActions();
  $("quotationDate").value = todayValue();
  if ($("materialPriceDate")) $("materialPriceDate").value = todayValue();
  if ($("estimateDate")) $("estimateDate").value = todayValue();
  restoreAuthentication();
});

function setupAuthentication() {
  $("loginForm").addEventListener("submit", handleLoginSubmit);
  $("logoutButton").addEventListener("click", logoutErp);
  $("aiAccountButton").addEventListener("click", openAiCredentialDialog);
  $("closeAiCredentialDialog").addEventListener("click", closeAiCredentialDialog);
  $("aiCredentialForm").addEventListener("submit", savePersonalGeminiKey);
  $("clearPersonalGeminiKey").addEventListener("click", clearPersonalGeminiKey);
  $("aiCredentialDialog").addEventListener("click", (event) => {
    if (event.target === $("aiCredentialDialog")) closeAiCredentialDialog();
  });
}

async function restoreAuthentication() {
  lockErp();
  setDataStatus("等待登入", "");
  if (!authToken) return;

  setLoginBusy(true, "正在驗證登入…");
  try {
    const response = await secureApiRequest(
      { action: "validateSession" },
      { includeToken: true, timeoutMs: 30000 }
    );
    updateAiCredentialUi(response.result?.aiCredential);
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
  const geminiApiKey = $("loginGeminiApiKey").value.trim();
  if (!password) return;

  hideLoginError();
  setLoginBusy(true, "登入驗證中…");

  try {
    const response = await secureApiRequest(
      { action: "login", password, geminiApiKey },
      { includeToken: false, timeoutMs: 30000 }
    );

    authToken = String(response.token || "");
    if (!authToken) throw new Error("伺服器沒有回傳登入憑證");

    sessionStorage.setItem(AUTH_TOKEN_KEY, authToken);
    updateAiCredentialUi(response.aiCredential);
    $("loginPassword").value = "";
    $("loginGeminiApiKey").value = "";
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
  $("loginGeminiApiKey").value = "";
  updateAiCredentialUi(null);
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
  state.machine360Frames = [];
  state.materialPrices = [];
  state.lightStripPrices = [];
  state.marketIndexes = [];
  state.estimateProjects = [];
  state.estimateItems = [];
  state.artRecommendations = [];
  state.artSimulations = [];
  state.termDictionary = [];
  state.sizeRules = [];
  state.internalPriceRules = [];
  state.priceReviews = [];
  state.productionPriceReferences = [];
  state.referenceImportFiles = { material: null, process: null, history: null, production: null };
  state.referenceImportValidation = {};
  state.priceReviewProcessImagePayload = null;
  state.estimateDraftItems = [];
  state.currentMarketResearch = null;
  state.currentOptimization = null;
  state.currentEstimateId = "";
  state.machine360Draft = {};
  state.selectedMachineId = "";
  state.machineImagePayload = null;
  state.quotationDocumentPayload = null;
  state.selectedMachineStage = COST_TYPES[0];
  state.selectedMachineArea = "";
  stopMachine360AutoRotate();
  stopDialogMachine360AutoRotate();
  state.machineMarkerDraft = createEmptyMachineMarkerDraft();
  state.quotationAiStatus = "未辨識";
  state.quotationRawText = "";
  secureImageCache.clear();
  renderAll();
}

function clearAuthentication() {
  authToken = "";
  authenticationReady = false;
  aiCredentialStatus = { configured: false, source: "none", label: "尚未設定 AI 額度", maskedKey: "" };
  sessionStorage.removeItem(AUTH_TOKEN_KEY);
}

function updateAiCredentialUi(status) {
  aiCredentialStatus = status && typeof status === "object"
    ? status
    : { configured: false, source: "none", label: "尚未設定 AI 額度", maskedKey: "" };

  const button = $("aiAccountButton");
  if (!button) return;
  button.classList.remove("personal", "company", "missing");
  button.classList.add(aiCredentialStatus.source === "personal"
    ? "personal"
    : aiCredentialStatus.source === "company"
      ? "company"
      : "missing");
  button.textContent = `AI 額度：${aiCredentialStatus.label || "尚未設定"}`;
  button.title = aiCredentialStatus.maskedKey
    ? `目前使用 ${aiCredentialStatus.maskedKey}`
    : (aiCredentialStatus.label || "設定 AI 額度");
}

async function refreshAiCredentialStatus() {
  const response = await secureApiRequest(
    { action: "getAiCredentialStatus" },
    { includeToken: true, timeoutMs: 30000 }
  );
  updateAiCredentialUi(response.result?.aiCredential);
  return aiCredentialStatus;
}

async function openAiCredentialDialog() {
  const dialog = $("aiCredentialDialog");
  $("personalGeminiApiKey").value = "";
  $("aiCredentialError").hidden = true;
  dialog.showModal();
  $("aiCredentialCurrent").textContent = "正在讀取目前狀態…";
  try {
    const status = await refreshAiCredentialStatus();
    renderAiCredentialDialogStatus(status);
  } catch (error) {
    showAiCredentialError(error.message || "無法讀取 AI 額度狀態");
  }
}

function closeAiCredentialDialog() {
  const dialog = $("aiCredentialDialog");
  if (dialog.open) dialog.close();
  $("personalGeminiApiKey").value = "";
  $("aiCredentialError").hidden = true;
}

function renderAiCredentialDialogStatus(status) {
  const box = $("aiCredentialCurrent");
  if (!status || !status.configured) {
    box.className = "aiCredentialCurrent missing";
    box.textContent = "目前沒有可用的 AI 額度。請設定個人 Gemini API Key。";
    $("clearPersonalGeminiKey").disabled = true;
    return;
  }
  const suffix = status.maskedKey ? `（${status.maskedKey}）` : "";
  box.className = `aiCredentialCurrent ${status.source || "company"}`;
  box.textContent = `目前使用：${status.label || "AI 額度"}${suffix}`;
  $("clearPersonalGeminiKey").disabled = status.source !== "personal";
}

function setAiCredentialBusy(isBusy, text) {
  $("savePersonalGeminiKey").disabled = isBusy;
  $("clearPersonalGeminiKey").disabled = isBusy || aiCredentialStatus.source !== "personal";
  $("personalGeminiApiKey").disabled = isBusy;
  $("savePersonalGeminiKey").textContent = isBusy ? text : "驗證並使用個人額度";
}

function showAiCredentialError(message) {
  const box = $("aiCredentialError");
  box.textContent = message;
  box.hidden = false;
}

async function savePersonalGeminiKey(event) {
  event.preventDefault();
  const geminiApiKey = $("personalGeminiApiKey").value.trim();
  if (!geminiApiKey) {
    showAiCredentialError("請貼上自己的 Gemini API Key。");
    return;
  }
  $("aiCredentialError").hidden = true;
  setAiCredentialBusy(true, "正在驗證…");
  try {
    const response = await secureApiRequest(
      { action: "setPersonalGeminiKey", geminiApiKey },
      { includeToken: true, timeoutMs: 60000 }
    );
    updateAiCredentialUi(response.result?.aiCredential);
    renderAiCredentialDialogStatus(aiCredentialStatus);
    $("personalGeminiApiKey").value = "";
    showNotice("已切換為個人 Gemini API 額度。", "");
  } catch (error) {
    showAiCredentialError(error.message || "Gemini API Key 驗證失敗");
  } finally {
    setAiCredentialBusy(false, "");
  }
}

async function clearPersonalGeminiKey() {
  $("aiCredentialError").hidden = true;
  setAiCredentialBusy(true, "正在切換…");
  try {
    const response = await secureApiRequest(
      { action: "clearPersonalGeminiKey" },
      { includeToken: true, timeoutMs: 30000 }
    );
    updateAiCredentialUi(response.result?.aiCredential);
    renderAiCredentialDialogStatus(aiCredentialStatus);
    showNotice(aiCredentialStatus.source === "company"
      ? "已改用公司共用 Gemini 額度。"
      : "已移除個人 Gemini API Key。", "");
  } catch (error) {
    showAiCredentialError(error.message || "無法移除個人 Gemini API Key");
  } finally {
    setAiCredentialBusy(false, "");
  }
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

function activateView(viewId, title = "") {
  document.querySelectorAll(".nav").forEach((item) => item.classList.toggle("active", item.dataset.view === viewId));
  document.querySelectorAll(".view").forEach((view) => view.classList.toggle("active", view.id === viewId));
  const nav = document.querySelector(`.nav[data-view="${viewId}"]`);
  $("pageTitle").textContent = title || nav?.dataset.title || nav?.textContent.trim() || "IGS ERP";
  $("pageDescription").textContent = pageDescriptions[viewId] || "";
  $("globalSearch").style.display = ["quotationEntry", "quickMachine", "machine360Setup", "dataImport", "priceCenter", "smartEstimate", "artOptimization"].includes(viewId) ? "none" : "block";
  window.scrollTo({ top: 0, behavior: "smooth" });
}

function setupNavigation() {
  document.querySelectorAll(".nav").forEach((button) => {
    button.addEventListener("click", () => activateView(button.dataset.view, button.dataset.title || button.textContent.trim()));
  });
  document.querySelectorAll('[data-home-view]').forEach((button)=>{
    button.addEventListener('click',()=>activateView(button.dataset.homeView));
  });
  document.querySelectorAll('[data-open-view]').forEach((button)=>{
    button.addEventListener('click',()=>activateView(button.dataset.openView, button.dataset.openTitle || '進階價格中心'));
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
  $("closeMachineDialog").addEventListener("click", () => {
    stopDialogMachine360AutoRotate();
    $("machineDialog").close();
  });
  $("machineDialog").addEventListener("click", (event) => {
    if (event.target === $("machineDialog")) {
      stopDialogMachine360AutoRotate();
      $("machineDialog").close();
    }
  });
  $("machineDialog").addEventListener("close", stopDialogMachine360AutoRotate);
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
      processTags: processTagsText([item.printMethod, item.printSide, item.whiteInk, item.specialEffect, item.processTags].filter(Boolean).join("、")),
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
    const processToggle = event.target.closest("[data-toggle-draft-process]");
    if (processToggle) {
      const index = Number(processToggle.dataset.toggleDraftProcess);
      const item = state.draftItems[index];
      if (item) {
        const tags = new Set(normalizeProcessTags(item.processTags));
        const tag = canonicalProcessTag(processToggle.dataset.processTag);
        if (tags.has(tag)) tags.delete(tag); else tags.add(tag);
        item.processTags = [...tags].join("、");
        renderDraftItems();
      }
      return;
    }
    const analyzeImage = event.target.closest("[data-analyze-item-image]");
    if (analyzeImage) {
      analyzeDraftItemImage(Number(analyzeImage.dataset.analyzeItemImage));
      return;
    }
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
    item.processTags = "";
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
    processTags: "",
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
        processTags: processTagsText(item.processTags),
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
  if ($("materialPriceDate")) $("materialPriceDate").value = todayValue();
  if ($("estimateDate")) $("estimateDate").value = todayValue();
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

function createEmptyMachineMarkerDraft() {
  return {
    areaId: "",
    viewKey: "FRONT",
    name: "",
    x: 44,
    y: 44,
    width: 12,
    height: 10,
    itemIds: [],
  };
}

function setupMachine360() {
  const machineSelect = $("machine360Machine");
  if (!machineSelect) return;
  machineSelect.addEventListener("change", () => {
    stopMachine360AutoRotate();
    state.machine360Draft = {};
    state.machine360ViewerIndex = 0;
    state.machineMarkerDraft = createEmptyMachineMarkerDraft();
    renderMachine360Setup();
  });
  document.querySelectorAll("[data-machine360-view]").forEach((input) => {
    input.addEventListener("change", handleMachine360FileSelection);
  });
  document.querySelectorAll("[data-clear-360]").forEach((button) => {
    button.addEventListener("click", () => clearMachine360Draft(button.dataset.clear360));
  });
  document.querySelectorAll("[data-replace-360]").forEach((button) => {
    button.addEventListener("click", () => openMachine360FilePicker(button.dataset.replace360));
  });
  document.querySelectorAll("[data-delete-360]").forEach((button) => {
    button.addEventListener("click", () => deleteStoredMachine360View(button.dataset.delete360));
  });
  $("saveMachine360Views").addEventListener("click", saveMachine360Views);
  $("machine360AutoRotate")?.addEventListener("click", toggleMachine360AutoRotate);
  $("generateMachine360Frames")?.addEventListener("click", generateMachine360Frames);
  $("approveAllMachine360Frames")?.addEventListener("click", approveAllMachine360Frames);
  $("machine360AiFrameGrid")?.addEventListener("click", handleMachine360AiFrameAction);

  $("machineMarkerView")?.addEventListener("change", () => {
    state.machineMarkerDraft = createEmptyMachineMarkerDraft();
    state.machineMarkerDraft.viewKey = $("machineMarkerView").value || "FRONT";
    renderMachineMarkerEditor();
  });
  $("machineMarkerStage")?.addEventListener("change", renderMachineMarkerEditor);
  $("machineMarkerAreaName")?.addEventListener("input", () => {
    state.machineMarkerDraft.name = $("machineMarkerAreaName").value.trim();
    renderMachineMarkerOverlay();
  });
  $("machineMarkerWidth")?.addEventListener("input", () => {
    state.machineMarkerDraft.width = Math.max(4, Math.min(40, toNumber($("machineMarkerWidth").value) || 12));
    renderMachineMarkerOverlay();
  });
  $("machineMarkerHeight")?.addEventListener("input", () => {
    state.machineMarkerDraft.height = Math.max(4, Math.min(40, toNumber($("machineMarkerHeight").value) || 10));
    renderMachineMarkerOverlay();
  });
  $("machineMarkerCanvas")?.addEventListener("click", handleMachineMarkerCanvasClick);
  $("saveMachineMarker")?.addEventListener("click", saveMachineMarker);
  $("deleteMachineMarker")?.addEventListener("click", deleteMachineMarker);
  $("resetMachineMarker")?.addEventListener("click", resetMachineMarkerEditor);
  $("machineMarkerSavedList")?.addEventListener("click", handleMachineMarkerSavedListClick);

  setupAdaptiveMachine360Viewer();
  renderMachine360Setup();
}

function machine360ViewsForMachine(machineId) {
  return state.machine360Views.filter((view) => view.machineId === machineId);
}

function existingMachine360View(machineId, viewKey) {
  return state.machine360Views.find((view) => view.machineId === machineId && view.viewKey === viewKey) || null;
}

function machine360FramesForMachine(machineId) {
  return state.machine360Frames.filter((frame) => frame.machineId === machineId && frame.imageFileId);
}

function sortedMachine360Views(machineId, includePending = false) {
  const byAngle = new Map();
  machine360FramesForMachine(machineId)
    .filter((frame) => includePending ? frame.reviewStatus !== "已停用" : frame.reviewStatus === "已核准")
    .forEach((frame) => byAngle.set(toNumber(frame.angle).toFixed(1), { ...frame, status: "AI生成" }));
  machine360ViewsForMachine(machineId)
    .filter((view) => view.imageFileId)
    .forEach((view) => byAngle.set(toNumber(view.angle).toFixed(1), { ...view, isAiFrame: false }));
  return [...byAngle.values()].sort((a, b) => toNumber(a.angle) - toNumber(b.angle));
}

function setupAdaptiveMachine360Viewer() {
  const viewer = $("machine360Viewer");
  if (!viewer) return;
  $("machine360Prev")?.addEventListener("click", () => stepMachine360Viewer(-1));
  $("machine360Next")?.addEventListener("click", () => stepMachine360Viewer(1));
  viewer.addEventListener("pointerdown", (event) => {
    state.machine360ViewerPointerX = event.clientX;
    state.machine360ViewerLastX = event.clientX;
    viewer.classList.add("dragging");
    viewer.setPointerCapture?.(event.pointerId);
  });
  viewer.addEventListener("pointermove", (event) => {
    if (state.machine360ViewerPointerX === null) return;
    const last = state.machine360ViewerLastX ?? event.clientX;
    const delta = event.clientX - last;
    if (Math.abs(delta) >= 36) {
      stepMachine360Viewer(delta < 0 ? 1 : -1);
      state.machine360ViewerLastX = event.clientX;
    }
  });
  const release = () => {
    state.machine360ViewerPointerX = null;
    state.machine360ViewerLastX = null;
    viewer.classList.remove("dragging");
  };
  viewer.addEventListener("pointerup", release);
  viewer.addEventListener("pointercancel", release);
  viewer.addEventListener("keydown", (event) => {
    if (event.key === "ArrowLeft") stepMachine360Viewer(-1);
    if (event.key === "ArrowRight") stepMachine360Viewer(1);
    if (event.key === " ") {
      event.preventDefault();
      toggleMachine360AutoRotate();
    }
  });
}

function stopMachine360AutoRotate() {
  if (state.machine360ViewerAutoTimer) {
    clearInterval(state.machine360ViewerAutoTimer);
    state.machine360ViewerAutoTimer = null;
  }
  const button = $("machine360AutoRotate");
  if (button) {
    button.textContent = "自動旋轉";
    button.classList.remove("active");
  }
}

function toggleMachine360AutoRotate() {
  const machineId = $("machine360Machine")?.value || "";
  const views = sortedMachine360Views(machineId, true);
  if (views.length < 2) {
    showNotice("至少需要兩張已儲存或 AI 生成的角度圖，才能啟用自動旋轉。", "warn");
    return;
  }
  if (state.machine360ViewerAutoTimer) {
    stopMachine360AutoRotate();
    return;
  }
  state.machine360ViewerAutoTimer = setInterval(() => stepMachine360Viewer(1), 1200);
  const button = $("machine360AutoRotate");
  if (button) {
    button.textContent = "停止旋轉";
    button.classList.add("active");
  }
}

function stepMachine360Viewer(delta) {
  const machineId = $("machine360Machine")?.value || "";
  const views = sortedMachine360Views(machineId, true);
  if (views.length < 2) return;
  state.machine360ViewerIndex = (state.machine360ViewerIndex + delta + views.length) % views.length;
  renderAdaptiveMachine360Viewer();
}

async function renderAdaptiveMachine360Viewer() {
  const viewer = $("machine360Viewer");
  const image = $("machine360ViewerImage");
  const empty = $("machine360ViewerEmpty");
  const dots = $("machine360ViewerDots");
  const badge = $("machine360ViewerBadge");
  if (!viewer || !image || !empty || !dots || !badge) return;
  const machineId = $("machine360Machine")?.value || "";
  const views = sortedMachine360Views(machineId, true);
  state.machine360ViewerIndex = Math.max(0, Math.min(state.machine360ViewerIndex, Math.max(0, views.length - 1)));
  const prev = $("machine360Prev");
  const next = $("machine360Next");
  const canSwitch = views.length >= 2;
  if (prev) prev.hidden = !canSwitch;
  if (next) next.hidden = !canSwitch;
  const autoButton = $("machine360AutoRotate");
  if (autoButton) autoButton.disabled = !canSwitch;
  if (!views.length) {
    stopMachine360AutoRotate();
    viewer.classList.add("empty"); image.hidden = true; empty.hidden = false;
    empty.textContent = machineId ? "尚未儲存基準圖" : "請先選擇機台";
    badge.textContent = "尚無可預覽圖片";
    $("machine360ViewerAngle").textContent = "—";
    $("machine360ViewerHint").textContent = "先儲存至少一張圖片";
    dots.innerHTML = "";
    return;
  }
  const view = views[state.machine360ViewerIndex];
  viewer.classList.remove("empty"); empty.hidden = true; image.hidden = false;
  image.classList.remove("frameReady");
  try {
    image.src = await getPrivateImageDataUrl(view.imageFileId);
    requestAnimationFrame(() => image.classList.add("frameReady"));
  }
  catch (error) { image.hidden = true; empty.hidden = false; empty.textContent = "圖片讀取失敗"; }
  const frameState = view.isAiFrame ? `｜${view.reviewStatus || "待審核"}` : "｜基準圖";
  $("machine360ViewerAngle").textContent = `${view.viewName || MACHINE_360_VIEW_CONFIG[view.viewKey]?.label || view.viewKey}｜${toNumber(view.angle)}°${frameState}`;
  $("machine360ViewerHint").textContent = canSwitch ? "按住左右拖曳即可旋轉切換；AI 影格需核准後才會發布到主管頁" : "目前為單圖檢視；可使用 AI 補中間角度";
  const aiCount = views.filter((item) => item.isAiFrame).length;
  badge.textContent = views.length === 1 ? "單圖檢視模式" : `${views.length} 圖旋轉模式${aiCount ? `｜AI ${aiCount} 張` : ""}`;
  badge.classList.toggle("connected", views.length > 0);
  dots.innerHTML = views.map((item, index) => `<button type="button" class="viewerDot ${index === state.machine360ViewerIndex ? "active" : ""}" data-viewer-index="${index}" title="${escapeHTML(item.viewName || item.viewKey)}"></button>`).join("");
  dots.querySelectorAll("[data-viewer-index]").forEach((button) => button.addEventListener("click", () => {
    state.machine360ViewerIndex = Number(button.dataset.viewerIndex) || 0;
    renderAdaptiveMachine360Viewer();
  }));
}

function markerViewsForMachine(machineId) {
  const stored = sortedMachine360Views(machineId);
  if (stored.length) return stored;
  const machine = machineById(machineId);
  if (!machine || (!machine.imageFileId && !machine.imageUrl)) return [];
  return [{
    id: "MAIN_IMAGE",
    machineId,
    viewKey: "FRONT",
    viewName: "正面／代表圖",
    angle: 0,
    imageFileId: machine.imageFileId,
    imageUrl: machine.imageUrl,
  }];
}

function costItemsForMachineStage(machineId, stageType) {
  const orderIds = state.costOrders
    .filter((order) => order.machineId === machineId && order.type === stageType)
    .map((order) => order.id);
  return state.costItems.filter((item) => orderIds.includes(item.costOrderId) && item.itemType !== "附加費用");
}

async function renderMachineMarkerEditor() {
  const machineId = $("machine360Machine")?.value || "";
  const viewSelect = $("machineMarkerView");
  const stage = $("machineMarkerStage")?.value || COST_TYPES[0];
  const views = markerViewsForMachine(machineId);
  if (!viewSelect) return;

  const currentViewKey = state.machineMarkerDraft.viewKey || viewSelect.value || views[0]?.viewKey || "FRONT";
  viewSelect.innerHTML = views.length
    ? views.map((view) => `<option value="${escapeHTML(view.viewKey)}">${escapeHTML(view.viewName || view.viewKey)}｜${toNumber(view.angle)}°</option>`).join("")
    : '<option value="">尚無圖片</option>';
  if ([...viewSelect.options].some((option) => option.value === currentViewKey)) viewSelect.value = currentViewKey;
  else if (views[0]) {
    viewSelect.value = views[0].viewKey;
    state.machineMarkerDraft.viewKey = views[0].viewKey;
  }

  const view = views.find((item) => item.viewKey === viewSelect.value) || views[0];
  const image = $("machineMarkerImage");
  const frame = $("machineMarkerMediaFrame");
  const empty = $("machineMarkerEmpty");
  if (!machineId || !view) {
    if (frame) frame.hidden = true;
    if (empty) {
      empty.hidden = false;
      empty.textContent = machineId ? "請先儲存至少一張角度圖或機台代表圖" : "請先選擇機台";
    }
  } else {
    if (frame) frame.hidden = false;
    if (empty) empty.hidden = true;
    try {
      image.src = view.imageFileId ? await getPrivateImageDataUrl(view.imageFileId) : view.imageUrl;
      image.hidden = false;
    } catch (error) {
      image.hidden = true;
      if (frame) frame.hidden = true;
      if (empty) {
        empty.hidden = false;
        empty.textContent = "標記底圖讀取失敗";
      }
    }
  }

  const items = costItemsForMachineStage(machineId, stage);
  const list = $("machineMarkerItemList");
  if (list) {
    list.innerHTML = items.length
      ? items.map((item) => {
        const checked = state.machineMarkerDraft.itemIds.includes(item.id);
        return `<label class="markerItemChoice">
          <input type="checkbox" value="${escapeHTML(item.id)}" ${checked ? "checked" : ""}>
          <span><strong>${escapeHTML(item.name || "未命名品項")}</strong><small>${escapeHTML([item.material, item.spec, item.thickness].filter(Boolean).join("｜") || "未填規格")}</small></span>
          <em>${money(item.subtotal)}</em>
        </label>`;
      }).join("")
      : '<div class="empty">這個費用階段尚無材料明細。</div>';
  }

  const areaNames = unique([
    ...areasForMachine(machineId),
    ...state.machineAreas.filter((area) => area.machineId === machineId).map((area) => area.name),
  ]).filter(Boolean);
  if ($("machineMarkerAreaOptions")) {
    $("machineMarkerAreaOptions").innerHTML = areaNames.map((name) => `<option value="${escapeHTML(name)}"></option>`).join("");
  }
  if ($("machineMarkerAreaName")) $("machineMarkerAreaName").value = state.machineMarkerDraft.name || "";
  if ($("machineMarkerWidth")) $("machineMarkerWidth").value = state.machineMarkerDraft.width || 12;
  if ($("machineMarkerHeight")) $("machineMarkerHeight").value = state.machineMarkerDraft.height || 10;
  if ($("deleteMachineMarker")) $("deleteMachineMarker").hidden = !state.machineMarkerDraft.areaId;

  const saved = state.machineAreas
    .filter((area) => area.machineId === machineId)
    .sort((a, b) => String(a.viewKey).localeCompare(String(b.viewKey)) || a.name.localeCompare(b.name));
  if ($("machineMarkerSavedList")) {
    $("machineMarkerSavedList").innerHTML = saved.length
      ? saved.map((area) => {
        const itemCount = state.costItems.filter((item) => item.areaId === area.id || (norm(item.areaName) === norm(area.name) && item.areaName !== "未指定")).length;
        return `<button type="button" class="savedMarkerRow ${state.machineMarkerDraft.areaId === area.id ? "active" : ""}" data-edit-marker="${escapeHTML(area.id)}">
          <span><strong>${escapeHTML(area.name)}</strong><small>${escapeHTML(area.viewKey || "FRONT")}｜${itemCount} 筆品項</small></span>
          <em>編輯</em>
        </button>`;
      }).join("")
      : '<div class="empty">尚未建立成本位置標記。</div>';
  }
  renderMachineMarkerOverlay();
}

function renderMachineMarkerOverlay() {
  const overlay = $("machineMarkerOverlay");
  const machineId = $("machine360Machine")?.value || "";
  const viewKey = $("machineMarkerView")?.value || state.machineMarkerDraft.viewKey || "FRONT";
  if (!overlay) return;
  const saved = state.machineAreas.filter((area) =>
    area.machineId === machineId &&
    (area.viewKey || "FRONT") === viewKey &&
    isValidMachineArea(area)
  );
  const savedMarkup = saved.map((area) => `<button type="button" class="machineHotspot confirmed ${state.machineMarkerDraft.areaId === area.id ? "active" : ""}" data-edit-marker="${escapeHTML(area.id)}" style="left:${area.x}%;top:${area.y}%;width:${area.width}%;height:${area.height}%"><span>${escapeHTML(area.name)}</span></button>`).join("");
  const draft = state.machineMarkerDraft;
  const draftMarkup = draft.name && draft.viewKey === viewKey
    ? `<div class="machineHotspot markerDraft active" style="left:${draft.x}%;top:${draft.y}%;width:${draft.width}%;height:${draft.height}%"><span>${escapeHTML(draft.name)}</span></div>`
    : "";
  overlay.innerHTML = savedMarkup + draftMarkup;
  overlay.querySelectorAll("[data-edit-marker]").forEach((button) => button.addEventListener("click", (event) => {
    event.stopPropagation();
    editMachineMarker(button.dataset.editMarker);
  }));
}

function handleMachineMarkerCanvasClick(event) {
  const frame = $("machineMarkerMediaFrame");
  if (!frame || frame.hidden || event.target.closest("[data-edit-marker]")) return;
  const rect = frame.getBoundingClientRect();
  if (!rect.width || !rect.height) return;
  const width = Math.max(4, Math.min(40, toNumber($("machineMarkerWidth")?.value) || state.machineMarkerDraft.width || 12));
  const height = Math.max(4, Math.min(40, toNumber($("machineMarkerHeight")?.value) || state.machineMarkerDraft.height || 10));
  const centerX = ((event.clientX - rect.left) / rect.width) * 100;
  const centerY = ((event.clientY - rect.top) / rect.height) * 100;
  state.machineMarkerDraft.viewKey = $("machineMarkerView")?.value || "FRONT";
  state.machineMarkerDraft.name = $("machineMarkerAreaName")?.value.trim() || state.machineMarkerDraft.name;
  state.machineMarkerDraft.width = width;
  state.machineMarkerDraft.height = height;
  state.machineMarkerDraft.x = Math.max(0, Math.min(100 - width, centerX - width / 2));
  state.machineMarkerDraft.y = Math.max(0, Math.min(100 - height, centerY - height / 2));
  renderMachineMarkerOverlay();
  if ($("machineMarkerStatus")) {
    $("machineMarkerStatus").textContent = "位置已更新。勾選對應品項後按「儲存位置標記」。";
    $("machineMarkerStatus").className = "photoStatus ready";
  }
}

function handleMachineMarkerSavedListClick(event) {
  const button = event.target.closest("[data-edit-marker]");
  if (button) editMachineMarker(button.dataset.editMarker);
}

function editMachineMarker(areaId) {
  const area = state.machineAreas.find((item) => item.id === areaId);
  if (!area) return;
  const machineId = $("machine360Machine")?.value || "";
  const stage = $("machineMarkerStage")?.value || COST_TYPES[0];
  const stageItems = costItemsForMachineStage(machineId, stage);
  state.machineMarkerDraft = {
    areaId: area.id,
    viewKey: area.viewKey || "FRONT",
    name: area.name,
    x: area.x,
    y: area.y,
    width: area.width,
    height: area.height,
    itemIds: stageItems.filter((item) => item.areaId === area.id || norm(item.areaName) === norm(area.name)).map((item) => item.id),
  };
  renderMachineMarkerEditor();
}

function resetMachineMarkerEditor() {
  const currentView = $("machineMarkerView")?.value || "FRONT";
  state.machineMarkerDraft = createEmptyMachineMarkerDraft();
  state.machineMarkerDraft.viewKey = currentView;
  if ($("machineMarkerStatus")) {
    $("machineMarkerStatus").textContent = "先輸入區域名稱，再點擊圖片放置標記。";
    $("machineMarkerStatus").className = "photoStatus muted";
  }
  renderMachineMarkerEditor();
}

async function saveMachineMarker() {
  const machineId = $("machine360Machine")?.value || "";
  const name = $("machineMarkerAreaName")?.value.trim() || "";
  const stageType = $("machineMarkerStage")?.value || COST_TYPES[0];
  const itemIds = [...document.querySelectorAll('#machineMarkerItemList input[type="checkbox"]:checked')].map((input) => input.value);
  if (!machineId) return showNotice("請先選擇機台。", "warn");
  if (!name) return showNotice("請輸入區域名稱。", "warn");
  if (!itemIds.length) return showNotice("請至少勾選一筆要綁定的成本品項。", "warn");
  const marker = {
    ...state.machineMarkerDraft,
    machineId,
    name,
    viewKey: $("machineMarkerView")?.value || "FRONT",
    width: Math.max(4, Math.min(40, toNumber($("machineMarkerWidth")?.value) || 12)),
    height: Math.max(4, Math.min(40, toNumber($("machineMarkerHeight")?.value) || 10)),
    status: "已確認",
  };
  const button = $("saveMachineMarker");
  button.disabled = true;
  button.textContent = "儲存中…";
  try {
    await secureApiRequest({ action: "saveMachineAreaMarker", marker, itemIds, stageType }, { timeoutMs: 60000 });
    const selectedMachine = machineId;
    await loadData();
    if ($("machine360Machine")) $("machine360Machine").value = selectedMachine;
    state.machineMarkerDraft = createEmptyMachineMarkerDraft();
    state.machineMarkerDraft.viewKey = marker.viewKey;
    await renderMachine360Setup();
    showNotice("成本位置標記已儲存，主管頁可直接點擊查看金額。", "success");
  } catch (error) {
    showNotice(`位置標記儲存失敗：${error.message}`, "error");
  } finally {
    button.disabled = false;
    button.textContent = "儲存位置標記";
  }
}

async function deleteMachineMarker() {
  const areaId = state.machineMarkerDraft.areaId;
  if (!areaId) return;
  if (!window.confirm("確定刪除此成本位置標記嗎？對應品項會改回未指定區域。")) return;
  const button = $("deleteMachineMarker");
  button.disabled = true;
  try {
    await secureApiRequest({ action: "deleteMachineAreaMarker", areaId }, { timeoutMs: 60000 });
    const selectedMachine = $("machine360Machine")?.value || "";
    await loadData();
    if ($("machine360Machine")) $("machine360Machine").value = selectedMachine;
    resetMachineMarkerEditor();
    showNotice("位置標記已刪除。", "success");
  } catch (error) {
    showNotice(`刪除失敗：${error.message}`, "error");
  } finally {
    button.disabled = false;
  }
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

function openMachine360FilePicker(viewKey) {
  const config = MACHINE_360_VIEW_CONFIG[viewKey];
  const input = config ? $(config.inputId) : null;
  if (input) input.click();
}

async function deleteStoredMachine360View(viewKey) {
  const machineId = $("machine360Machine")?.value || "";
  const config = MACHINE_360_VIEW_CONFIG[viewKey];
  const existing = existingMachine360View(machineId, viewKey);
  if (!machineId || !config || !existing) {
    showNotice("找不到要刪除的已存圖片。", "warn");
    return;
  }
  const confirmed = window.confirm(`確定要刪除「${config.label}」已存圖片嗎？

此操作會移除 Google Sheet 紀錄，並將私人 Drive 圖片移到垃圾桶。`);
  if (!confirmed) return;

  const button = document.querySelector(`[data-delete-360="${viewKey}"]`);
  if (button) button.disabled = true;
  try {
    await secureApiRequest(
      { action: "deleteMachine360View", machineId, viewKey },
      { includeToken: true, timeoutMs: 60000 }
    );
    state.machine360Views = state.machine360Views.filter(
      (view) => !(view.machineId === machineId && view.viewKey === viewKey)
    );
    const preview = $(config.previewId);
    if (preview) {
      preview.removeAttribute("src");
      delete preview.dataset.fileId;
    }
    await renderMachine360Setup();
    showNotice(`已刪除「${config.label}」基準圖。`, "success");
  } catch (error) {
    showNotice(`刪除失敗：${error.message}`, "error");
  } finally {
    if (button) button.disabled = false;
  }
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
    const clearButton = card?.querySelector(`[data-clear-360="${viewKey}"]`);
    const replaceButton = card?.querySelector(`[data-replace-360="${viewKey}"]`);
    const deleteButton = card?.querySelector(`[data-delete-360="${viewKey}"]`);
    const draft = state.machine360Draft[viewKey];
    const existing = existingViews.find((view) => view.viewKey === viewKey);
    card?.classList.toggle("hasImage", Boolean(draft || existing));
    if (clearButton) clearButton.hidden = !draft;
    if (replaceButton) replaceButton.hidden = Boolean(draft) || !existing;
    if (deleteButton) deleteButton.hidden = Boolean(draft) || !existing;

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
  const modeLabel = completed >= 4
    ? "完整四視圖模式"
    : completed >= 2
      ? "雙圖交叉偵測模式"
      : completed === 1
        ? "單圖偵測模式"
        : "尚未選擇圖片";
  badge.textContent = machineId ? `${modeLabel}｜${completed} / 4` : "尚未選擇機台";
  badge.classList.toggle("connected", completed >= 1);

  let statusText = "請先選擇機台，再上傳至少一張基準圖。";
  if (machineId && completed === 1) {
    statusText = "單圖模式可用：AI 可偵測目前畫面看得到的區域；未出現在圖片中的背面與側面只能標示為未知或推測。";
  } else if (machineId && completed === 2) {
    statusText = "雙圖模式可用：AI 可交叉比對兩個視角，辨識與標記會比單圖更可靠；其餘角度仍屬推測。";
  } else if (machineId && completed === 3) {
    statusText = "三視圖模式可用：大部分外觀可交叉比對，仍可日後補上最後一張。";
  } else if (machineId && completed >= 4) {
    statusText = "四張基準角度已齊全，可進入 AI 標記與旋轉草稿階段。";
  } else if (machineId) {
    statusText = "可先儲存目前已有的圖片，之後再補上其他角度。";
  }
  $("machine360Status").textContent = statusText;
  await renderAdaptiveMachine360Viewer();
  await renderMachine360AiFrames();
  await renderMachineMarkerEditor();
}


function requestedMachine360Angles() {
  const frameCount = Number($("machine360FrameCount")?.value || 8);
  const count = frameCount === 16 ? 16 : 8;
  return Array.from({ length: count }, (_, index) => Number((((360 / count) * index) % 360).toFixed(1)));
}

function missingMachine360Angles(machineId) {
  const existingAngles = new Set(sortedMachine360Views(machineId, true).map((item) => toNumber(item.angle).toFixed(1)));
  return requestedMachine360Angles().filter((angle) => !existingAngles.has(toNumber(angle).toFixed(1)));
}

async function generateMachine360Frames() {
  const machineId = $("machine360Machine")?.value || "";
  const button = $("generateMachine360Frames");
  if (!machineId) {
    showNotice("請先選擇機台。", "warn");
    return;
  }
  const bases = machine360ViewsForMachine(machineId).filter((view) => view.imageFileId);
  if (!bases.length) {
    showNotice("至少先儲存一張基準角度圖。", "warn");
    return;
  }
  const angles = missingMachine360Angles(machineId);
  if (!angles.length) {
    showNotice("目前選擇的角度數已經沒有缺少影格。", "success");
    return;
  }
  const confirmed = window.confirm(`將使用 Gemini 依 ${bases.length} 張基準圖產生 ${angles.length} 張 AI 角度草稿。\n\n生成圖片可能消耗付費額度，且所有影格都必須人工審核。確定繼續嗎？`);
  if (!confirmed) return;

  state.machine360AiGenerating = true;
  if (button) {
    button.disabled = true;
    button.textContent = "AI 生成中…";
  }
  const progress = $("machine360AiProgress");
  let success = 0;
  const failures = [];

  try {
    for (let index = 0; index < angles.length; index += 1) {
      const angle = angles[index];
      if (progress) progress.textContent = `正在生成 ${angle}°｜${index + 1} / ${angles.length}`;
      try {
        const response = await secureApiRequest(
          { action: "generateMachine360Frame", machineId, angle, force: false },
          { includeToken: true, timeoutMs: 190000 }
        );
        if (response.result?.frame) {
          const frame = normalizeMachine360Frame(response.result.frame);
          state.machine360Frames = state.machine360Frames.filter((item) => item.id !== frame.id && !(item.machineId === machineId && toNumber(item.angle).toFixed(1) === toNumber(frame.angle).toFixed(1)));
          state.machine360Frames.push(frame);
          success += 1;
          await renderAdaptiveMachine360Viewer();
          await renderMachine360AiFrames();
        }
      } catch (error) {
        failures.push(`${angle}°：${error.message}`);
      }
    }
    if (progress) progress.textContent = failures.length ? `完成 ${success} 張，失敗 ${failures.length} 張` : `已完成 ${success} 張 AI 草稿`;
    if (failures.length) showNotice(`AI 角度生成部分完成。${failures.slice(0, 2).join("；")}`, "warn");
    else showNotice("AI 中間角度草稿已完成，請逐張核准後再發布。", "success");
  } finally {
    state.machine360AiGenerating = false;
    if (button) {
      button.disabled = false;
      button.textContent = "AI 產生缺少角度";
    }
    await renderMachine360AiFrames();
  }
}

async function renderMachine360AiFrames() {
  const grid = $("machine360AiFrameGrid");
  const approveButton = $("approveAllMachine360Frames");
  const progress = $("machine360AiProgress");
  if (!grid) return;
  const machineId = $("machine360Machine")?.value || "";
  const frames = machine360FramesForMachine(machineId).slice().sort((a, b) => a.angle - b.angle);
  if (approveButton) approveButton.disabled = !frames.some((frame) => frame.reviewStatus !== "已核准");
  if (!state.machine360AiGenerating && progress) {
    const approved = frames.filter((frame) => frame.reviewStatus === "已核准").length;
    progress.textContent = frames.length ? `AI 影格 ${frames.length} 張｜已核准 ${approved} 張` : "尚未產生 AI 影格";
  }
  if (!frames.length) {
    grid.innerHTML = '<div class="empty fullSpan">尚無 AI 中間角度。先選擇 8 或 16 角度，再按「AI 產生缺少角度」。</div>';
    return;
  }
  grid.innerHTML = frames.map((frame) => `
    <article class="aiFrameCard ${frame.reviewStatus === "已核准" ? "approved" : "pending"}">
      <div class="aiFrameImage"><img data-secure-file-id="${escapeHTML(frame.imageFileId)}" alt="${escapeHTML(frame.viewName)}"></div>
      <div class="aiFrameMeta">
        <div><strong>${escapeHTML(frame.viewName)}｜${frame.angle}°</strong><span class="statusPill ${frame.reviewStatus === "已核准" ? "ok" : "warn"}">${escapeHTML(frame.reviewStatus)}</span></div>
        <small>${escapeHTML(frame.model || "Gemini AI")}</small>
        <div class="aiFrameActions">
          <button class="button secondary" type="button" data-ai-frame-action="approve" data-frame-id="${escapeHTML(frame.id)}" ${frame.reviewStatus === "已核准" ? "disabled" : ""}>核准</button>
          <button class="button secondary" type="button" data-ai-frame-action="regenerate" data-frame-id="${escapeHTML(frame.id)}" data-angle="${frame.angle}">重新生成</button>
          <button class="button secondary dangerText" type="button" data-ai-frame-action="delete" data-frame-id="${escapeHTML(frame.id)}">刪除</button>
        </div>
      </div>
    </article>`).join("");
  await hydrateSecureImages(grid);
}

async function handleMachine360AiFrameAction(event) {
  const button = event.target.closest("[data-ai-frame-action]");
  if (!button) return;
  const action = button.dataset.aiFrameAction;
  const frameId = button.dataset.frameId || "";
  const frame = state.machine360Frames.find((item) => item.id === frameId);
  if (!frame) return;
  button.disabled = true;
  try {
    if (action === "approve") {
      const response = await secureApiRequest({ action: "reviewMachine360Frame", frameId, status: "已核准" }, { timeoutMs: 60000 });
      const updated = normalizeMachine360Frame(response.result.frame);
      state.machine360Frames = state.machine360Frames.map((item) => item.id === frameId ? updated : item);
      showNotice(`${updated.angle}° 影格已核准並發布。`, "success");
    } else if (action === "regenerate") {
      const confirmed = window.confirm(`確定重新生成 ${frame.angle}° 嗎？舊影格會移到 Drive 垃圾桶。`);
      if (!confirmed) return;
      const response = await secureApiRequest({ action: "generateMachine360Frame", machineId: frame.machineId, angle: frame.angle, force: true }, { timeoutMs: 190000 });
      const updated = normalizeMachine360Frame(response.result.frame);
      state.machine360Frames = state.machine360Frames.map((item) => item.id === frameId ? updated : item);
      secureImageCache.delete(frame.imageFileId);
      showNotice(`${updated.angle}° 已重新生成，請再次審核。`, "success");
    } else if (action === "delete") {
      const confirmed = window.confirm(`確定刪除 ${frame.angle}° AI 影格嗎？`);
      if (!confirmed) return;
      await secureApiRequest({ action: "deleteMachine360Frame", frameId }, { timeoutMs: 60000 });
      state.machine360Frames = state.machine360Frames.filter((item) => item.id !== frameId);
      secureImageCache.delete(frame.imageFileId);
      showNotice(`${frame.angle}° AI 影格已刪除。`, "success");
    }
    state.machine360ViewerIndex = 0;
    await renderAdaptiveMachine360Viewer();
    await renderMachine360AiFrames();
  } catch (error) {
    showNotice(`AI 影格操作失敗：${error.message}`, "error");
  } finally {
    button.disabled = false;
  }
}

async function approveAllMachine360Frames() {
  const machineId = $("machine360Machine")?.value || "";
  if (!machineId) return;
  const frames = machine360FramesForMachine(machineId).filter((frame) => frame.reviewStatus !== "已核准");
  if (!frames.length) return;
  const confirmed = window.confirm(`確定一次核准目前 ${frames.length} 張 AI 影格嗎？\n\n建議先逐張檢查外型、Logo、按鈕、螢幕與左右方向。`);
  if (!confirmed) return;
  const button = $("approveAllMachine360Frames");
  if (button) button.disabled = true;
  try {
    await secureApiRequest({ action: "approveAllMachine360Frames", machineId }, { timeoutMs: 60000 });
    state.machine360Frames = state.machine360Frames.map((frame) => frame.machineId === machineId ? { ...frame, reviewStatus: "已核准" } : frame);
    await renderMachine360AiFrames();
    await renderAdaptiveMachine360Viewer();
    showNotice("此機台的 AI 影格已全部核准並發布。", "success");
  } catch (error) {
    showNotice(`批次核准失敗：${error.message}`, "error");
  } finally {
    if (button) button.disabled = false;
  }
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
    state.machine360Frames = (Array.isArray(result.machine360Frames) ? result.machine360Frames : []).map(normalizeMachine360Frame);
    state.materialPrices = (Array.isArray(result.materialPrices) ? result.materialPrices : []).map(normalizeMaterialPrice);
    state.lightStripPrices = (Array.isArray(result.lightStripPrices) ? result.lightStripPrices : []).map(normalizeLightStripPrice);
    state.marketIndexes = (Array.isArray(result.marketIndexes) ? result.marketIndexes : []).map(normalizeMarketIndex);
    state.estimateProjects = (Array.isArray(result.estimateProjects) ? result.estimateProjects : []).map(normalizeEstimateProject);
    state.estimateItems = (Array.isArray(result.estimateItems) ? result.estimateItems : []).map(normalizeEstimateItem);
    state.artRecommendations = (Array.isArray(result.artRecommendations) ? result.artRecommendations : []).map(normalizeArtRecommendation);
    state.artSimulations = (Array.isArray(result.artSimulations) ? result.artSimulations : []).map(normalizeArtSimulation);
    state.termDictionary = Array.isArray(result.termDictionary) ? result.termDictionary : [];
    state.sizeRules = Array.isArray(result.sizeRules) ? result.sizeRules : [];
    state.internalPriceRules = (Array.isArray(result.internalPriceRules) ? result.internalPriceRules : []).map(normalizeInternalPriceRule);
    state.priceReviews = (Array.isArray(result.priceReviews) ? result.priceReviews : []).map(normalizePriceReview);
    state.productionPriceReferences = (Array.isArray(result.productionPriceReferences) ? result.productionPriceReferences : []).map(normalizeProductionPriceReference);

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

  const estimateMachine = $("estimateMachine");
  const optimizationMachine = $("optimizationMachine");
  [estimateMachine, optimizationMachine].filter(Boolean).forEach((select) => {
    const current = select.value;
    select.innerHTML = '<option value="">未指定機台</option>' + machineOptions.map((item) => `<option value="${escapeHTML(item.value)}">${escapeHTML(item.label)}</option>`).join("");
    if ([...select.options].some((option) => option.value === current)) select.value = current;
  });
  populateOptimizationEstimateOptions();

  const supplierNames = unique([
    ...state.suppliers.map((supplier) => supplier.name),
    ...state.costOrders.map((order) => order.supplier),
    ...state.materialPrices.map((price) => price.supplier),
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
  populateEstimateProcessDatalists();
  renderDashboard();
  renderMachineCards();
  renderCostRecords();
  renderMachineTotals();
  renderSuppliers();
  renderMaterialPrices();
  renderProcessPriceRules();
  renderPriceReviews();
  renderDataImportSummary();
  renderProductionPriceReferences();
  renderMarketIndexes();
  renderEstimateProjects();
  renderEstimateDraft();
  renderOptimizationHistory();
  renderCurrentOptimization();
  renderSimulationViewOptions();
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

function renderHomePriceSearchResults(){
  const box=$("homePriceSearchResults");
  if(!box)return;
  const keyword=searchKeyword();
  const rows=(state.priceReviews||[])
    .filter((row)=>toNumber(row.unitPrice)>0)
    .filter((row)=>{
      if(!keyword)return true;
      const text=[row.itemName,row.itemCode,row.project,row.material,row.thicknessMm,row.processTags,row.supplier,row.note].join(' ');
      return norm(text).includes(keyword);
    })
    .sort((a,b)=>{
      const certified=(b.status==='已認證')-(a.status==='已認證');
      return certified||dateValue(b.quoteDate)-dateValue(a.quoteDate);
    })
    .slice(0,20);
  if(!rows.length){
    box.innerHTML=`<div class="empty">${keyword?'找不到符合的歷史價格，可改用公式估算器。':'尚無可搜尋的歷史報價。'}</div>`;
    return;
  }
  box.innerHTML=rows.map((row)=>`<article class="homePriceRow">
    <div><strong>${escapeHTML(row.itemName||'未命名品項')}</strong><small>${escapeHTML([row.project,row.material,row.thicknessMm?`${row.thicknessMm}mm`:'',row.processTags].filter(Boolean).join('｜'))}</small></div>
    <div class="homePriceMeta"><strong>${money(row.unitPrice)}</strong><small>${escapeHTML(row.status||'待認證')}｜${escapeHTML(row.supplier||'未填供應商')}｜${escapeHTML(row.quoteDate||'未填日期')}</small></div>
  </article>`).join('');
}

function renderDashboard() {
  renderHomePriceSearchResults();
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
    : '<tr><td colspan="11" class="empty">成本單 API 尚未開通或目前沒有資料</td></tr>';
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

function dialogViewsForMachine(machine) {
  const stored = sortedMachine360Views(machine.id);
  if (stored.length) return stored;
  if (!machine.imageFileId && !machine.imageUrl) return [];
  return [{
    id: "MAIN_IMAGE",
    machineId: machine.id,
    viewKey: "FRONT",
    viewName: "正面／代表圖",
    angle: 0,
    imageFileId: machine.imageFileId,
    imageUrl: machine.imageUrl,
  }];
}

function openMachineDialog(machineId) {
  const machine = machineById(machineId);
  if (!machine) return;
  stopDialogMachine360AutoRotate();
  state.selectedMachineId = machineId;
  state.selectedMachineStage = COST_TYPES[0];
  state.selectedMachineArea = "";
  const totals = totalsForMachine(machineId);
  const machineViews = dialogViewsForMachine(machine);
  state.dialogMachine360Index = 0;
  const headerImageMarkup = machine.imageFileId
    ? `<img data-secure-file-id="${escapeHTML(machine.imageFileId)}" alt="${escapeHTML(machine.name)}">`
    : machine.imageUrl
      ? `<img src="${escapeHTML(machine.imageUrl)}" alt="${escapeHTML(machine.name)}">`
      : `<span>${escapeHTML(machine.name.slice(0, 2).toUpperCase())}</span>`;

  $("machineDialogContent").innerHTML = `
    <div class="dialogHeader">
      <div class="dialogMachineImage ${(machine.imageFileId || machine.imageUrl) ? "hasImage" : ""}">${headerImageMarkup}</div>
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
    ${machineViews.length ? `
      <section class="dialog360Section">
        <div class="dialog360Head">
          <div>
            <h3>多角度機台與成本位置</h3>
            <p>拖曳或自動旋轉切換已上傳的角度圖；點擊圖上的標記可查看該區域費用。</p>
          </div>
          <div class="viewerHeadActions">
            <span id="dialogMachine360Badge" class="apiBadge connected">${machineViews.length === 1 ? "單圖模式" : `${machineViews.length} 圖旋轉`}</span>
            <button id="dialogMachine360AutoRotate" class="button secondary viewerAutoButton" type="button" ${machineViews.length < 2 ? "disabled" : ""}>自動旋轉</button>
          </div>
        </div>
        <div class="dialogInteractiveGrid">
          <div>
            <div id="dialogMachine360Viewer" class="machine360Viewer dialogMachine360Viewer" tabindex="0" aria-label="機台多角度預覽">
              <div id="dialogMachine360MediaFrame" class="viewerMediaFrame" hidden>
                <img id="dialogMachine360Image" alt="${escapeHTML(machine.name)} 多角度預覽" hidden>
                <div id="dialogMachine360Hotspots" class="viewerHotspots"></div>
              </div>
              <div id="dialogMachine360Empty" class="viewerEmpty">正在載入圖片…</div>
              <button id="dialogMachine360Prev" class="viewerArrow prev" type="button" aria-label="上一個角度" ${machineViews.length < 2 ? "hidden" : ""}>‹</button>
              <button id="dialogMachine360Next" class="viewerArrow next" type="button" aria-label="下一個角度" ${machineViews.length < 2 ? "hidden" : ""}>›</button>
              <div class="viewerOverlay">
                <strong id="dialogMachine360Angle">—</strong>
                <span id="dialogMachine360Hint">${machineViews.length < 2 ? "目前為單圖檢視" : "按住左右拖曳即可旋轉切換"}</span>
              </div>
            </div>
            <div id="dialogMachine360Dots" class="viewerDots" aria-label="角度選擇"></div>
          </div>
          <div id="machineAreaCostPanel" class="machineAreaCostPanel">
            尚未選擇成本位置。若圖上沒有標記，請到「360° 機台建置」建立成本位置並綁定品項。
          </div>
        </div>
      </section>` : `
      <div class="machineAreaCostPanel">這台機台尚未上傳代表圖或角度圖，暫時無法建立可點擊成本位置。</div>`}
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
  renderDialogStage(machineId, state.selectedMachineStage);
  if (machineViews.length) setupDialogMachine360Viewer(machineId);
  $("machineDialog").showModal();
  hydrateSecureImages($("machineDialogContent"));
}

function setupDialogMachine360Viewer(machineId) {
  const viewer = $("dialogMachine360Viewer");
  if (!viewer) return;
  $("dialogMachine360Prev")?.addEventListener("click", () => stepDialogMachine360Viewer(machineId, -1));
  $("dialogMachine360Next")?.addEventListener("click", () => stepDialogMachine360Viewer(machineId, 1));
  $("dialogMachine360AutoRotate")?.addEventListener("click", () => toggleDialogMachine360AutoRotate(machineId));
  viewer.addEventListener("pointerdown", (event) => {
    if (event.target.closest("[data-machine-hotspot]")) return;
    state.dialogMachine360PointerX = event.clientX;
    state.dialogMachine360LastX = event.clientX;
    viewer.classList.add("dragging");
    viewer.setPointerCapture?.(event.pointerId);
  });
  viewer.addEventListener("pointermove", (event) => {
    if (state.dialogMachine360PointerX === null) return;
    const last = state.dialogMachine360LastX ?? event.clientX;
    const delta = event.clientX - last;
    if (Math.abs(delta) >= 36) {
      stepDialogMachine360Viewer(machineId, delta < 0 ? 1 : -1);
      state.dialogMachine360LastX = event.clientX;
    }
  });
  const release = () => {
    state.dialogMachine360PointerX = null;
    state.dialogMachine360LastX = null;
    viewer.classList.remove("dragging");
  };
  viewer.addEventListener("pointerup", release);
  viewer.addEventListener("pointercancel", release);
  viewer.addEventListener("keydown", (event) => {
    if (event.key === "ArrowLeft") stepDialogMachine360Viewer(machineId, -1);
    if (event.key === "ArrowRight") stepDialogMachine360Viewer(machineId, 1);
    if (event.key === " ") {
      event.preventDefault();
      toggleDialogMachine360AutoRotate(machineId);
    }
  });
  renderDialogMachine360Viewer(machineId);
}

function stopDialogMachine360AutoRotate() {
  if (state.dialogMachine360AutoTimer) {
    clearInterval(state.dialogMachine360AutoTimer);
    state.dialogMachine360AutoTimer = null;
  }
  const button = $("dialogMachine360AutoRotate");
  if (button) {
    button.textContent = "自動旋轉";
    button.classList.remove("active");
  }
}

function toggleDialogMachine360AutoRotate(machineId) {
  const machine = machineById(machineId);
  const views = machine ? dialogViewsForMachine(machine) : [];
  if (views.length < 2) return;
  if (state.dialogMachine360AutoTimer) {
    stopDialogMachine360AutoRotate();
    return;
  }
  state.dialogMachine360AutoTimer = setInterval(() => stepDialogMachine360Viewer(machineId, 1), 1200);
  const button = $("dialogMachine360AutoRotate");
  if (button) {
    button.textContent = "停止旋轉";
    button.classList.add("active");
  }
}

function stepDialogMachine360Viewer(machineId, delta) {
  const machine = machineById(machineId);
  const views = machine ? dialogViewsForMachine(machine) : [];
  if (views.length < 2) return;
  state.dialogMachine360Index = (state.dialogMachine360Index + delta + views.length) % views.length;
  state.selectedMachineArea = "";
  renderDialogMachine360Viewer(machineId);
}

async function renderDialogMachine360Viewer(machineId) {
  const image = $("dialogMachine360Image");
  const frame = $("dialogMachine360MediaFrame");
  const empty = $("dialogMachine360Empty");
  const dots = $("dialogMachine360Dots");
  if (!image || !frame || !empty || !dots) return;
  const machine = machineById(machineId);
  const views = machine ? dialogViewsForMachine(machine) : [];
  if (!views.length) return;
  state.dialogMachine360Index = Math.max(0, Math.min(state.dialogMachine360Index, views.length - 1));
  const view = views[state.dialogMachine360Index];
  frame.hidden = true;
  image.hidden = true;
  empty.hidden = false;
  empty.textContent = "正在載入圖片…";
  try {
    image.src = view.imageFileId ? await getPrivateImageDataUrl(view.imageFileId) : view.imageUrl;
    image.hidden = false;
    frame.hidden = false;
    empty.hidden = true;
    requestAnimationFrame(() => image.classList.add("frameReady"));
  } catch (error) {
    empty.textContent = "圖片讀取失敗";
  }
  const label = view.viewName || MACHINE_360_VIEW_CONFIG[view.viewKey]?.label || view.viewKey;
  if ($("dialogMachine360Angle")) $("dialogMachine360Angle").textContent = `${label}｜${toNumber(view.angle)}°`;
  if ($("dialogMachine360Hint")) $("dialogMachine360Hint").textContent = views.length > 1 ? "按住左右拖曳、方向鍵或自動旋轉切換角度" : "目前為單圖檢視";
  dots.innerHTML = views.map((item, index) => `<button type="button" class="viewerDot ${index === state.dialogMachine360Index ? "active" : ""}" data-dialog-viewer-index="${index}" title="${escapeHTML(item.viewName || item.viewKey)}"></button>`).join("");
  dots.querySelectorAll("[data-dialog-viewer-index]").forEach((button) => button.addEventListener("click", () => {
    state.dialogMachine360Index = Number(button.dataset.dialogViewerIndex) || 0;
    state.selectedMachineArea = "";
    renderDialogMachine360Viewer(machineId);
  }));
  renderDialogMachineHotspots(machineId, view.viewKey || "FRONT");
}

function renderDialogMachineHotspots(machineId, viewKey) {
  const overlay = $("dialogMachine360Hotspots");
  const panel = $("machineAreaCostPanel");
  if (!overlay) return;
  const areas = state.machineAreas.filter((area) =>
    area.machineId === machineId &&
    (area.viewKey || "FRONT") === viewKey &&
    isValidMachineArea(area)
  );
  overlay.innerHTML = areas.map((area) => `<button class="machineHotspot ${area.status === "已確認" ? "confirmed" : "suggested"}" type="button" data-machine-hotspot="${escapeHTML(area.name)}" style="left:${area.x}%;top:${area.y}%;width:${area.width}%;height:${area.height}%"><span>${escapeHTML(area.name)}</span></button>`).join("");
  overlay.querySelectorAll("[data-machine-hotspot]").forEach((button) => {
    button.addEventListener("click", (event) => {
      event.stopPropagation();
      state.selectedMachineArea = button.dataset.machineHotspot;
      overlay.querySelectorAll("[data-machine-hotspot]").forEach((item) => item.classList.remove("active"));
      button.classList.add("active");
      renderMachineAreaCostPanel(machineId, state.selectedMachineArea, state.selectedMachineStage);
    });
  });
  if (panel && !state.selectedMachineArea) {
    panel.innerHTML = areas.length
      ? "點擊機台圖上的成本標記，查看目前費用階段的區域金額與品項。"
      : "此角度尚未建立成本位置標記。請到「360° 機台建置」新增標記並綁定品項。";
  }
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
        <thead><tr><th>類型</th><th>圖片</th><th>品項</th><th>規格／包裝</th><th>數量</th><th>單位</th><th>單價</th><th>材質</th><th>厚度</th><th>製程標籤</th><th>檔案名稱</th><th>安裝區域</th><th>小計</th><th>備註</th></tr></thead>
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
          <td>${escapeHTML(item.processTags || "—")}</td>
          <td>${escapeHTML(item.fileName || "—")}</td>
          <td>${escapeHTML(item.areaName || "未指定")}<br><small>${escapeHTML(item.areaStatus || "未指定")}</small></td>
          <td><strong>${money(item.subtotal)}</strong></td>
          <td>${escapeHTML(item.note || "—")}</td>
        </tr>`).join("") : '<tr><td colspan="14" class="empty">成本單已建立，但尚無明細</td></tr>'}</tbody>
      </table>
    </div>`;
  hydrateSecureImages(content);
}


function renderDraftItems() {
  $("draftItemRows").innerHTML = state.draftItems.map((item, index) => {
    const isFee = item.itemType === "附加費用";
    const tags = normalizeProcessTags(item.processTags);
    return `<tr data-index="${index}" class="${isFee ? "feeRow" : "materialRow"}">
      <td><select class="tableInput itemTypeInput" data-field="itemType"><option value="材料" ${!isFee ? "selected" : ""}>材料</option><option value="附加費用" ${isFee ? "selected" : ""}>附加費用</option></select></td>
      <td><div class="itemImageEditor">
        ${isFee ? '<span class="muted tinyText">不需圖片</span>' : item.image?.dataUrl ? `<img src="${escapeHTML(item.image.dataUrl)}" alt="品項圖片"><div class="itemImageActions"><button type="button" class="miniAi" data-analyze-item-image="${index}">AI看圖</button><button type="button" class="miniClear" data-clear-item-image="${index}">移除</button></div>` : `<label class="miniUpload">上傳<input type="file" accept="image/jpeg,image/png,image/webp" data-item-image="${index}" hidden></label>`}
      </div></td>
      <td><input class="tableInput itemNameInput" data-field="name" value="${escapeHTML(item.name)}" placeholder="${isFee ? "例如：運費／版費" : "品項名稱"}"></td>
      <td><input class="tableInput specInput" data-field="spec" value="${escapeHTML(item.spec)}" placeholder="規格／包裝" ${isFee ? "disabled" : ""}></td>
      <td><input class="tableInput numberInput" data-field="qty" type="number" min="0" step="0.01" value="${isFee ? 1 : item.qty}" ${isFee ? "disabled" : ""}></td>
      <td><input class="tableInput unitInput" data-field="unit" value="${escapeHTML(item.unit)}" placeholder="可留空" ${isFee ? "disabled" : ""}></td>
      <td><input class="tableInput numberInput" data-field="price" type="number" min="0" step="0.01" value="${item.price || ""}" placeholder="${isFee ? "費用金額" : "單價"}"></td>
      <td><select class="tableInput materialInput" data-field="material" ${isFee ? "disabled" : ""}>${standardMaterialOptionsHtml(item.material)}</select></td>
      <td><input class="tableInput thicknessInput" data-field="thickness" value="${escapeHTML(item.thickness || "")}" placeholder="厚度" ${isFee ? "disabled" : ""}></td>
      <td><details class="tableProcessPicker" ${tags.length ? "" : ""}><summary>${tags.length ? `${tags.length}項製程` : "選擇製程"}</summary><div class="processTagButtons compactTags">${isFee ? '<span class="muted">附加費用不需製程</span>' : processTagButtonsHtml(tags, "data-toggle-draft-process", index)}</div></details><small class="processTagSummary">${escapeHTML(tags.join("、") || "尚未選擇")}</small></td>
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

async function analyzeDraftItemImage(index) {
  const item = state.draftItems[index];
  if (!item?.image) { showNotice("請先上傳品項發包圖。", "warn"); return; }
  showNotice(`正在辨識「${item.name || `品項 ${index + 1}`}」的材質與製程…`);
  try {
    const response = await secureApiRequest({ action: "analyzeProcessImage", image: stripDataUrl(item.image) }, { timeoutMs: 180000 });
    const result = response.result || {};
    if (result.itemName && !item.name) item.name = result.itemName;
    if (result.normalizedMaterial) item.material = result.normalizedMaterial;
    if (toNumber(result.thicknessMm) > 0) item.thickness = `${toNumber(result.thicknessMm)}mm`;
    if (toNumber(result.widthMm) > 0 && toNumber(result.heightMm) > 0) item.spec = `W${toNumber(result.widthMm)} × H${toNumber(result.heightMm)} mm`;
    item.processTags = processTagsText([...normalizeProcessTags(item.processTags), ...(result.processTags || [])]);
    if (result.rawText) item.note = [item.note, `AI原文：${result.rawText}`].filter(Boolean).join("｜");
    renderDraftItems();
    showNotice(`AI 已帶入 ${normalizeProcessTags(item.processTags).length} 個製程標籤，請人工確認。`, "success");
  } catch (error) {
    showNotice(`AI 看圖辨識失敗：${error.message}`, "error");
  }
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
  setTimeout(() => URL.revokeObjectURL(url), 200);
}

/* =====================================================
 * v2.0 價格中心、智能估價、AI 美術降本
 * ===================================================== */

function normalizeMaterialPrice(row) {
  return {
    id: String(firstValue(row, ["價格ID", "id"])),
    code: String(firstValue(row, ["材料代碼", "code"])),
    name: String(firstValue(row, ["材料名稱", "name"])),
    category: String(firstValue(row, ["材質分類", "category"])),
    spec: String(firstValue(row, ["規格", "spec"])),
    thickness: String(firstValue(row, ["厚度", "thickness"])),
    unit: String(firstValue(row, ["計價單位", "unit"], "件")),
    basePrice: toNumber(firstValue(row, ["基準單價", "basePrice"])),
    currency: String(firstValue(row, ["幣別", "currency"], "TWD")),
    minimumQty: toNumber(firstValue(row, ["最低採購量", "minimumQty"])),
    qtyMin: toNumber(firstValue(row, ["數量下限", "qtyMin"])),
    qtyMax: toNumber(firstValue(row, ["數量上限", "qtyMax"])),
    supplierId: String(firstValue(row, ["供應商ID", "supplierId"])),
    supplier: String(firstValue(row, ["供應商名稱", "supplier"])),
    priceDate: normalizeDate(firstValue(row, ["價格日期", "priceDate"])),
    expiryDate: normalizeDate(firstValue(row, ["有效期限", "expiryDate"])),
    source: String(firstValue(row, ["價格來源", "source"], "公司成交價")),
    confidence: String(firstValue(row, ["信心等級", "confidence"], "中")),
    processingFee: toNumber(firstValue(row, ["加工費", "processingFee"])),
    minimumFee: toNumber(firstValue(row, ["最低費用", "minimumFee"])),
    conversionFactor: toNumber(firstValue(row, ["單位換算係數", "conversionFactor"], 1)) || 1,
    note: String(firstValue(row, ["備註", "note"])),
    active: String(firstValue(row, ["使用中", "active"], "是")),
    createdAt: String(firstValue(row, ["建立時間", "createdAt"])),
    updatedAt: String(firstValue(row, ["更新時間", "updatedAt"])),
  };
}

function normalizePriceReview(row) {
  return {
    id: String(firstValue(row, ["價格紀錄ID", "id"])),
    sourceFile: String(firstValue(row, ["來源文件", "sourceFile"])),
    sourceRow: toNumber(firstValue(row, ["來源列", "sourceRow"])),
    fileSavedDate: normalizeDate(firstValue(row, ["檔案最後儲存日", "fileSavedDate"])),
    quoteDate: normalizeDate(firstValue(row, ["正式報價日期", "quoteDate"])),
    supplier: String(firstValue(row, ["供應商", "supplier"])),
    project: String(firstValue(row, ["專案／機台", "project"])),
    itemCode: String(firstValue(row, ["品項代碼", "itemCode"])),
    itemName: String(firstValue(row, ["繁中品項名稱", "itemName"])),
    material: String(firstValue(row, ["標準材質", "material"])),
    thicknessMm: toNumber(firstValue(row, ["厚度mm", "thicknessMm"])),
    widthMm: toNumber(firstValue(row, ["Wmm", "widthMm"])),
    heightMm: toNumber(firstValue(row, ["Hmm", "heightMm"])),
    qty: toNumber(firstValue(row, ["數量", "qty"], 1)) || 1,
    unit: String(firstValue(row, ["計價單位", "unit"], "件")),
    unitPrice: toNumber(firstValue(row, ["實際單價TWD", "unitPrice"])),
    processTags: String(firstValue(row, ["製程標籤", "processTags"])),
    taxType: String(firstValue(row, ["稅別", "taxType"])),
    status: String(firstValue(row, ["認證狀態", "status"], "待認證")),
    includeBaseline: String(firstValue(row, ["是否納入基準", "includeBaseline"], "否")),
    note: String(firstValue(row, ["來源備註", "note"])),
    createdAt: String(firstValue(row, ["建立時間", "createdAt"])),
    updatedAt: String(firstValue(row, ["更新時間", "updatedAt"])),
  };
}



function normalizeProductionPriceReference(row, index = 0) {
  return {
    id: String(firstValue(row, ["參考ID", "id"], `PDR-${index + 1}`)),
    itemName: String(firstValue(row, ["品項名稱", "itemName"])),
    project: String(firstValue(row, ["專案／機台", "project"])),
    material: String(firstValue(row, ["材質", "material"])),
    thickness: String(firstValue(row, ["厚度", "thickness"])),
    widthMm: toNumber(firstValue(row, ["寬mm", "widthMm"])),
    heightMm: toNumber(firstValue(row, ["高mm", "heightMm"])),
    unitPriceRmb: toNumber(firstValue(row, ["單價RMB", "unitPriceRmb"])),
    unitPriceTwd: toNumber(firstValue(row, ["單價TWD", "unitPriceTwd"])),
    processTags: String(firstValue(row, ["製程標籤", "processTags"])),
    source: String(firstValue(row, ["資料來源", "source"], "量產價格參考")),
    active: String(firstValue(row, ["使用中", "active"], "是")),
    createdAt: String(firstValue(row, ["建立時間", "createdAt"])),
    updatedAt: String(firstValue(row, ["更新時間", "updatedAt"])),
  };
}

function normalizeInternalPriceRule(row) {
  return {
    id: String(firstValue(row, ["規則ID", "id"])),
    type: String(firstValue(row, ["規則類型", "type"])),
    name: String(firstValue(row, ["標準名稱", "name"])),
    category: String(firstValue(row, ["材質分類", "category"])),
    thicknessMm: toNumber(firstValue(row, ["厚度mm", "thicknessMm"])),
    sizeTier: String(firstValue(row, ["尺寸級距", "sizeTier"])),
    pricingMethod: String(firstValue(row, ["計價方式", "pricingMethod"])),
    rawTwd: toNumber(firstValue(row, ["原材TWD", "rawTwd"])),
    sampleTwd: toNumber(firstValue(row, ["打樣TWD", "sampleTwd"])),
    productionTwd: toNumber(firstValue(row, ["量產TWD", "productionTwd"])),
    sampleRmb: toNumber(firstValue(row, ["打樣RMB", "sampleRmb"])),
    productionRmb: toNumber(firstValue(row, ["量產RMB", "productionRmb"])),
    priceDate: normalizeDate(firstValue(row, ["價格日期", "priceDate"])),
    source: String(firstValue(row, ["資料來源", "source"])),
    certification: String(firstValue(row, ["認證狀態", "certification"])),
    active: String(firstValue(row, ["使用中", "active"], "是")),
    note: String(firstValue(row, ["備註", "note"])),
  };
}

function normalizeLightStripPrice(row, index = 0) {
  const source = String(firstValue(row, ["資料來源", "source", "供應商"], "")).trim();
  const type = standardizeErpText(firstValue(row, ["IC／燈條類型", "IC/燈條類型", "燈條類型", "type", "name"], ""));
  const densityText = standardizeErpText(firstValue(row, ["每米燈數", "密度", "density"], ""));
  const widthText = String(firstValue(row, ["寬度", "寬度mm", "width", "widthMm"], "")).trim();
  const voltageProtection = standardizeErpText(firstValue(row, ["電壓／防護規格", "電壓/防護規格", "電壓防護", "voltageProtection", "spec"], ""));
  const tenCmRmb = toNumber(firstValue(row, ["10cm_RMB", "10cmRmb"]));
  const tenCmTwd = toNumber(firstValue(row, ["10cm_TWD", "10cmTwd"]));
  const oneMeterRmb = toNumber(firstValue(row, ["1m_RMB", "1mRmb"]));
  const oneMeterTwd = toNumber(firstValue(row, ["1m_TWD", "1mTwd"])) || tenCmTwd * 10;
  const fiveMeterRmb = toNumber(firstValue(row, ["5m_RMB", "5mRmb"]));
  const fiveMeterTwd = toNumber(firstValue(row, ["5m_TWD", "5mTwd"]));
  return {
    id: String(firstValue(row, ["資料ID", "id"], `LIGHT-${index + 1}`)),
    source, type, densityText,
    ledsPerMeter: toNumber((densityText.match(/(\d+(?:\.\d+)?)/) || [])[1]),
    widthMm: toNumber((widthText.match(/(\d+(?:\.\d+)?)/) || [])[1]),
    voltageProtection,
    tenCmRmb, tenCmTwd, oneMeterRmb, oneMeterTwd, fiveMeterRmb, fiveMeterTwd,
    quoteDate: normalizeDate(firstValue(row, ["報價日期", "quoteDate"])),
    status: String(firstValue(row, ["資料狀態", "status"], "待確認")),
    active: String(firstValue(row, ["使用中", "active"], "是")),
  };
}

function normalizeMarketIndex(row) {
  return {
    id: String(firstValue(row, ["指數ID", "id"])),
    name: String(firstValue(row, ["指數名稱", "name"])),
    category: String(firstValue(row, ["材料分類", "category"])),
    query: String(firstValue(row, ["查詢關鍵字", "query"])),
    date: normalizeDate(firstValue(row, ["日期", "date"])),
    indexValue: toNumber(firstValue(row, ["指數值", "indexValue"], 100)),
    baseValue: toNumber(firstValue(row, ["基準值", "baseValue"], 100)) || 100,
    changePercent: toNumber(firstValue(row, ["變動率", "changePercent"])),
    currency: String(firstValue(row, ["幣別", "currency"], "TWD")),
    unit: String(firstValue(row, ["單位", "unit"], "趨勢指數")),
    source: String(firstValue(row, ["資料來源", "source"])),
    sourceUrls: String(firstValue(row, ["來源網址", "sourceUrls"])),
    summary: String(firstValue(row, ["AI摘要", "summary"])),
    autoUpdate: String(firstValue(row, ["自動更新", "autoUpdate"], "否")),
    active: String(firstValue(row, ["使用中", "active"], "是")),
    lastQueriedAt: String(firstValue(row, ["最後查詢時間", "lastQueriedAt"])),
  };
}

function normalizeEstimateProject(row) {
  return {
    id: String(firstValue(row, ["估價ID", "id"])),
    machineId: String(firstValue(row, ["機台ID", "machineId"])),
    name: String(firstValue(row, ["估價名稱", "name"])),
    version: String(firstValue(row, ["估價版本", "version"], "V1")),
    date: normalizeDate(firstValue(row, ["估價日期", "date"])),
    status: String(firstValue(row, ["估價狀態", "status"], "草稿")),
    optimisticTotal: toNumber(firstValue(row, ["樂觀總額", "optimisticTotal"])),
    baselineTotal: toNumber(firstValue(row, ["基準總額", "baselineTotal"])),
    conservativeTotal: toNumber(firstValue(row, ["保守總額", "conservativeTotal"])),
    confidence: toNumber(firstValue(row, ["信心度", "confidence"])),
    marketDate: normalizeDate(firstValue(row, ["市場調整日期", "marketDate"])),
    note: String(firstValue(row, ["備註", "note"])),
    createdAt: String(firstValue(row, ["建立時間", "createdAt"])),
    updatedAt: String(firstValue(row, ["更新時間", "updatedAt"])),
  };
}

function normalizeEstimateItem(row) {
  return {
    id: String(firstValue(row, ["估價明細ID", "id"])),
    estimateId: String(firstValue(row, ["估價ID", "estimateId"])),
    index: toNumber(firstValue(row, ["項次", "index"])),
    code: String(firstValue(row, ["品項代碼", "code"])),
    name: String(firstValue(row, ["品項名稱", "name"])),
    material: String(firstValue(row, ["材質", "material"])),
    spec: String(firstValue(row, ["規格", "spec"])),
    thickness: String(firstValue(row, ["厚度", "thickness"])),
    qty: toNumber(firstValue(row, ["數量", "qty"], 1)) || 1,
    unit: String(firstValue(row, ["單位", "unit"], "件")),
    widthMm: toNumber(firstValue(row, ["寬mm", "widthMm"])),
    heightMm: toNumber(firstValue(row, ["高mm", "heightMm"])),
    usage: toNumber(firstValue(row, ["用量", "usage"])),
    wasteRate: toNumber(firstValue(row, ["損耗率", "wasteRate"], 0)),
    wasteRateManuallySet: true,
    priceId: String(firstValue(row, ["價格ID", "priceId"])),
    baseUnitPrice: toNumber(firstValue(row, ["基準單價", "baseUnitPrice"])),
    marketAdjustment: toNumber(firstValue(row, ["市場調整率", "marketAdjustment"])),
    processingFee: toNumber(firstValue(row, ["加工費", "processingFee"])),
    processingLevel: String(firstValue(row, ["加工等級", "processingLevel"], "AUTO")) || "AUTO",
    processingLevelSource: String(firstValue(row, ["加工等級來源", "processingLevelSource"], "自動判斷")),
    processingLevelReason: String(firstValue(row, ["加工判斷理由", "processingLevelReason"])),
    otherFee: toNumber(firstValue(row, ["其他費用", "otherFee"])),
    optimisticCost: toNumber(firstValue(row, ["樂觀成本", "optimisticCost"])),
    baselineCost: toNumber(firstValue(row, ["基準成本", "baselineCost"])),
    conservativeCost: toNumber(firstValue(row, ["保守成本", "conservativeCost"])),
    priceSource: String(firstValue(row, ["價格來源", "priceSource"])),
    confidenceScore: toNumber(firstValue(row, ["信心度", "confidenceScore"], 50)),
    printMethod: String(firstValue(row, ["印刷方式", "printMethod"])),
    printSide: String(firstValue(row, ["印刷面", "printSide"])),
    whiteInk: String(firstValue(row, ["白墨範圍", "whiteInk"])),
    specialEffect: String(firstValue(row, ["特殊效果", "specialEffect"])),
    isArtItem: String(firstValue(row, ["是否美術件", "isArtItem"], "是")),
    allowMaterialOptimization: String(firstValue(row, ["允許材質優化", "allowMaterialOptimization"], "是")),
    allowPrintOptimization: String(firstValue(row, ["允許印刷優化", "allowPrintOptimization"], "是")),
    constraints: String(firstValue(row, ["不可變更條件", "constraints"])),
    originalName: String(firstValue(row, ["原始品名", "originalName"])),
    normalizedName: String(firstValue(row, ["標準品名", "normalizedName", "品項名稱", "name"])),
    originalMaterial: String(firstValue(row, ["原始材質", "originalMaterial"])),
    normalizedMaterial: String(firstValue(row, ["標準材質", "normalizedMaterial", "材質", "material"])),
    originalSpec: String(firstValue(row, ["原始規格", "originalSpec"])),
    originalUnit: String(firstValue(row, ["原始尺寸單位", "originalUnit"], "mm")),
    dimensionDetailsJson: String(firstValue(row, ["尺寸明細JSON", "dimensionDetailsJson"])),
    exactAreaMm2: toNumber(firstValue(row, ["精確面積mm2", "exactAreaMm2"])),
    singleExactTsai: toNumber(firstValue(row, ["單件精確才數", "singleExactTsai"])),
    totalExactTsai: toNumber(firstValue(row, ["總精確才數", "totalExactTsai"])),
    billingTsai: toNumber(firstValue(row, ["計價才數", "billingTsai"])),
    sizeTier: String(firstValue(row, ["尺寸級距", "sizeTier"])),
    dimensionStatus: String(firstValue(row, ["尺寸解析狀態", "dimensionStatus"])),
    dimensionConfidence: toNumber(firstValue(row, ["尺寸信心度", "dimensionConfidence"])),
    longStripWarning: String(firstValue(row, ["長條件提醒", "longStripWarning"])),
    manualPrice: !String(firstValue(row, ["價格ID", "priceId"])) && toNumber(firstValue(row, ["基準單價", "baseUnitPrice"])) > 0 && /文件單價|人工輸入單價|機台實際成本|AI市場參考價|AI內部資料參考價/.test(String(firstValue(row, ["價格來源", "priceSource"]))),
    manualPriceConfidence: toNumber(firstValue(row, ["信心度", "confidenceScore"], 75)),
    priceManuallySelected: Boolean(firstValue(row, ["價格ID", "priceId"])),
  };
}

function normalizeArtRecommendation(row) {
  return {
    id: String(firstValue(row, ["建議ID", "id"])),
    estimateId: String(firstValue(row, ["估價ID", "estimateId"])),
    machineId: String(firstValue(row, ["機台ID", "machineId"])),
    itemCode: String(firstValue(row, ["品項代碼", "itemCode"])),
    itemName: String(firstValue(row, ["品項名稱", "itemName"])),
    type: String(firstValue(row, ["建議類型", "type"])),
    originalPlan: String(firstValue(row, ["原始方案", "originalPlan"])),
    optimizedPlan: String(firstValue(row, ["優化方案", "optimizedPlan"])),
    originalCost: toNumber(firstValue(row, ["原始成本", "originalCost"])),
    optimizedLow: toNumber(firstValue(row, ["優化成本下限", "optimizedLow"])),
    optimizedHigh: toNumber(firstValue(row, ["優化成本上限", "optimizedHigh"])),
    savingLow: toNumber(firstValue(row, ["節省下限", "savingLow"])),
    savingHigh: toNumber(firstValue(row, ["節省上限", "savingHigh"])),
    appearanceImpact: String(firstValue(row, ["外觀影響", "appearanceImpact"])),
    colorRisk: String(firstValue(row, ["色彩風險", "colorRisk"])),
    weatherRisk: String(firstValue(row, ["耐候風險", "weatherRisk"])),
    sampleRequired: String(firstValue(row, ["打樣需求", "sampleRequired"])),
    evidence: String(firstValue(row, ["依據來源", "evidence"])),
    confidence: String(firstValue(row, ["信心度", "confidence"], "中")),
    confirmDepartment: String(firstValue(row, ["確認部門", "confirmDepartment"])),
    status: String(firstValue(row, ["處理狀態", "status"], "待確認")),
    createdAt: String(firstValue(row, ["建立時間", "createdAt"])),
  };
}

function normalizeArtSimulation(row) {
  return {
    id: String(firstValue(row, ["模擬圖片ID", "id"])),
    recommendationIds: String(firstValue(row, ["建議ID", "recommendationIds"])),
    estimateId: String(firstValue(row, ["估價ID", "estimateId"])),
    machineId: String(firstValue(row, ["機台ID", "machineId"])),
    viewKey: String(firstValue(row, ["視角代碼", "viewKey"])),
    sourceFileId: String(firstValue(row, ["原始圖片檔案ID", "sourceFileId"])),
    imageFileId: String(firstValue(row, ["模擬圖片檔案ID", "imageFileId"])),
    imageUrl: String(firstValue(row, ["模擬圖片URL", "imageUrl"])),
    prompt: String(firstValue(row, ["提示詞", "prompt"])),
    status: String(firstValue(row, ["審核狀態", "status"], "待美術確認")),
    createdAt: String(firstValue(row, ["建立時間", "createdAt"])),
  };
}

function setupV20() {
  if (!$('materialPriceForm')) return;
  $('materialPriceForm').addEventListener('submit', saveMaterialPriceFromForm);
  $('resetMaterialPrice').addEventListener('click', resetMaterialPriceForm);
  $('materialPriceRows').addEventListener('click', handleMaterialPriceTableClick);
  $('materialPriceSearch').addEventListener('input', renderMaterialPrices);
  $('materialPriceCsv').addEventListener('change', importMaterialPriceCsv);
  $('exportMaterialPrices').addEventListener('click', exportMaterialPricesCsv);
  $('priceReviewCsv')?.addEventListener('change', importPriceReviewCsv);
  $('processRuleCsv')?.addEventListener('change', importProcessRuleCsv);
  $('exportPriceReviews')?.addEventListener('click', exportPriceReviewsCsv);
  $('priceReviewSearch')?.addEventListener('input', renderPriceReviews);
  $('priceReviewStatusFilter')?.addEventListener('change', renderPriceReviews);
  $('priceReviewRows')?.addEventListener('click', handlePriceReviewRowsClick);
  $('priceReviewForm')?.addEventListener('submit', savePriceReviewFromDialog);
  $('closePriceReviewDialog')?.addEventListener('click', closePriceReviewDialog);
  $('priceReviewProcessTagButtons')?.addEventListener('click', handlePriceReviewProcessTagClick);
  $('priceReviewProcessImage')?.addEventListener('change', handlePriceReviewProcessImageChange);
  $('analyzePriceReviewProcessImage')?.addEventListener('click', analyzePriceReviewProcessImage);
  $('clearPriceReviewProcessImage')?.addEventListener('click', clearPriceReviewProcessImage);
  $('marketResearchForm').addEventListener('submit', researchMarketFromForm);
  $('marketResearchResult').addEventListener('click', handleMarketResearchClick);
  $('marketIndexRows').addEventListener('click', handleMarketIndexClick);
  $('enableMarketAutoUpdate').addEventListener('click', enableWeeklyMarketUpdate);

  $('estimateSourceFile').addEventListener('change', handleEstimateSourceFile);
  $('analyzeEstimateSource').addEventListener('click', analyzeEstimateSourceDocument);
  $('clearEstimateSource').addEventListener('click', clearEstimateSourceDocument);
  $('newEstimate').addEventListener('click', resetEstimateEditor);
  $('loadMachineActualItems').addEventListener('click', loadActualItemsIntoEstimate);
  $('addEstimateItem').addEventListener('click', () => { state.estimateDraftItems.push(emptyEstimateItem()); renderEstimateDraft(); });
  $('estimateMissingPrices').addEventListener('click', () => estimateMissingPricesWithAi({ manual: true }));
  $('recalculateEstimate').addEventListener('click', () => { recalculateAllEstimateItems(); renderEstimateDraft(); });
  $('estimateItemRows').addEventListener('input', handleEstimateItemInput);
  $('estimateItemRows').addEventListener('change', handleEstimateItemInput);
  $('estimateItemRows').addEventListener('click', handleEstimateItemClick);
  $('saveEstimate').addEventListener('click', saveCurrentEstimate);
  $('saveEstimateAndOptimize').addEventListener('click', saveEstimateAndOpenOptimization);
  $('estimateProjectRows').addEventListener('click', handleEstimateProjectClick);
  $('estimateTargetType').addEventListener('change', updateEstimateTargetMode);
  $('estimatePriceBasis')?.addEventListener('change', () => { recalculateAllEstimateItems(); renderEstimateDraft(); });
  $('estimateOrderType')?.addEventListener('change', () => { recalculateAllEstimateItems(); renderEstimateDraft(); });
  $('estimateSampleTwdRmbDivisor')?.addEventListener('input', () => { recalculateAllEstimateItems(); renderEstimateDraft(); });
  $('estimateProductionRmbDivisor')?.addEventListener('input', () => { recalculateAllEstimateItems(); renderEstimateDraft(); });
  $('estimateMachine').addEventListener('change', () => { if ($('estimateTargetType').value === 'existing' && !$('estimateName').value) { const m = machineById($('estimateMachine').value); if (m) $('estimateName').value = `${m.name} 美術材料估價`; } });
  $('parseEstimateText')?.addEventListener('click', parseEstimateTextIntoDraft);
  $('loadEstimateTextExample')?.addEventListener('click', loadEstimateTextExample);
  $('clearEstimateText')?.addEventListener('click', clearEstimateTextInput);
  $('estimateCnyRate')?.addEventListener('input', () => { recalculateAllEstimateItems(); renderEstimateDraft(); });

  $('optimizationSource').addEventListener('change', updateOptimizationSourceMode);
  $('optimizationMachine').addEventListener('change', renderSimulationViewOptions);
  $('optimizationEstimate').addEventListener('change', renderSimulationViewOptions);
  $('optimizationForm').addEventListener('submit', generateOptimizationFromForm);
  $('optimizationRecommendations').addEventListener('click', handleOptimizationRecommendationClick);
  $('optimizationHistoryRows').addEventListener('click', handleOptimizationHistoryClick);
  $('generateSimulation').addEventListener('click', generateCurrentSimulation);
  $('simulationView').addEventListener('change', renderSimulationPreview);

  if (!$('materialPriceDate').value) $('materialPriceDate').value = todayValue();
  if (!$('estimateDate').value) $('estimateDate').value = todayValue();
  updateEstimateTargetMode();
  updateOptimizationSourceMode();
}


function materialPriceFormRecord() {
  return {
    id: $('materialPriceId').value.trim(),
    code: $('materialCode').value.trim(),
    name: $('materialName').value.trim(),
    category: $('materialCategory').value.trim(),
    spec: $('materialSpec').value.trim(),
    thickness: $('materialThickness').value.trim(),
    unit: $('materialUnit').value,
    basePrice: toNumber($('materialBasePrice').value),
    currency: $('materialCurrency').value.trim() || 'TWD',
    supplier: $('materialSupplier').value.trim(),
    priceDate: $('materialPriceDate').value,
    processingFee: toNumber($('materialProcessingFee').value),
    minimumFee: toNumber($('materialMinimumFee').value),
    minimumQty: toNumber($('materialMinimumQty').value),
    confidence: $('materialConfidence').value,
    source: $('materialSource').value,
    note: $('materialNote').value.trim(),
    active: '是',
  };
}

async function saveMaterialPriceFromForm(event) {
  event.preventDefault();
  const record = materialPriceFormRecord();
  if (!record.name || !record.category || !record.unit) { showNotice('請填寫材料名稱、材質分類與計價單位。', 'warn'); return; }
  const button = $('saveMaterialPrice');
  button.disabled = true; button.textContent = '儲存中…';
  try {
    const response = await secureApiRequest({ action: 'saveMaterialPrices', records: [record] }, { timeoutMs: 60000 });
    const saved = (response.result?.records || []).map(normalizeMaterialPrice);
    saved.forEach((item) => {
      const index = state.materialPrices.findIndex((row) => row.id === item.id);
      if (index >= 0) state.materialPrices[index] = item; else state.materialPrices.push(item);
    });
    resetMaterialPriceForm(); renderMaterialPrices(); renderEstimateDraft();
    showNotice('材料價格已儲存。', 'success');
  } catch (error) { showNotice(`材料價格儲存失敗：${error.message}`, 'error'); }
  finally { button.disabled = false; button.textContent = '儲存價格'; }
}

function resetMaterialPriceForm() {
  $('materialPriceForm').reset();
  $('materialPriceId').value = '';
  $('materialCurrency').value = 'TWD';
  $('materialPriceDate').value = todayValue();
  $('materialProcessingFee').value = 0;
  $('materialMinimumFee').value = 0;
  $('materialMinimumQty').value = 0;
  $('materialConfidence').value = '中';
}

function fillMaterialPriceForm(price) {
  $('materialPriceId').value = price.id;
  $('materialCode').value = price.code;
  $('materialName').value = price.name;
  $('materialCategory').value = price.category;
  $('materialSpec').value = price.spec;
  $('materialThickness').value = price.thickness;
  $('materialUnit').value = price.unit || '件';
  $('materialBasePrice').value = price.basePrice;
  $('materialCurrency').value = price.currency || 'TWD';
  $('materialSupplier').value = price.supplier;
  $('materialPriceDate').value = price.priceDate || todayValue();
  $('materialProcessingFee').value = price.processingFee;
  $('materialMinimumFee').value = price.minimumFee;
  $('materialMinimumQty').value = price.minimumQty;
  $('materialConfidence').value = price.confidence || '中';
  $('materialSource').value = price.source || '公司成交價';
  $('materialNote').value = price.note;
  $('priceCenter').scrollIntoView({ behavior: 'smooth', block: 'start' });
}

async function handleMaterialPriceTableClick(event) {
  const edit = event.target.closest('[data-edit-price]');
  if (edit) { const price = state.materialPrices.find((row) => row.id === edit.dataset.editPrice); if (price) fillMaterialPriceForm(price); return; }
  const del = event.target.closest('[data-delete-price]');
  if (!del) return;
  const id = del.dataset.deletePrice;
  const price = state.materialPrices.find((row) => row.id === id);
  if (!window.confirm(`確定刪除「${price?.name || id}」的價格資料嗎？`)) return;
  try {
    await secureApiRequest({ action: 'deleteMaterialPrice', id }, { timeoutMs: 30000 });
    state.materialPrices = state.materialPrices.filter((row) => row.id !== id);
    renderMaterialPrices(); renderEstimateDraft(); showNotice('價格資料已刪除。', 'success');
  } catch (error) { showNotice(`刪除失敗：${error.message}`, 'error'); }
}

function processPriceRules(){
  const rows=mergedInternalPriceRules();
  return rows.filter((row)=>row.active!=='否'&&row.type!=='材料');
}

function renderProcessPriceRules(){
  const body=$('processPriceRuleRows');
  if(!body)return;
  const rows=processPriceRules().sort((a,b)=>String(a.name).localeCompare(String(b.name),'zh-Hant')||String(a.sizeTier).localeCompare(String(b.sizeTier),'zh-Hant'));
  if($('processPriceRuleCount'))$('processPriceRuleCount').textContent=`共 ${rows.length} 筆，智能估價已同步`;
  body.innerHTML=rows.length?rows.map((rule)=>`<tr>
    <td><strong>${escapeHTML(rule.name)}</strong><br><small>${escapeHTML(rule.category||'印刷／加工')}</small></td>
    <td>${escapeHTML(rule.sizeTier||'—')}</td>
    <td>${escapeHTML(rule.pricingMethod||'—')}</td>
    <td>${rule.rawTwd?money(rule.rawTwd):'—'}</td>
    <td>${rule.sampleTwd?money(rule.sampleTwd):'—'}</td>
    <td>${rule.productionTwd?money(rule.productionTwd):'—'}</td>
    <td>${rule.sampleRmb?`¥${Number(rule.sampleRmb).toLocaleString('zh-TW',{maximumFractionDigits:2})}`:'—'}</td>
    <td>${rule.productionRmb?`¥${Number(rule.productionRmb).toLocaleString('zh-TW',{maximumFractionDigits:2})}`:'—'}</td>
    <td>${escapeHTML(rule.priceDate||'—')}</td>
    <td>${escapeHTML(rule.source||'內部規則')}</td>
    <td>${escapeHTML(rule.certification||'—')}</td>
  </tr>`).join(''):'<tr><td colspan="11" class="empty">尚未建立製程價格。請在 Google Sheet「內部估價規則」新增規則。</td></tr>';
}

function populateEstimateProcessDatalists(){
  const rules=processPriceRules().filter((row)=>row.type==='印刷加工').map((row)=>row.name).filter(Boolean);
  const printMethods=unique(['四色直噴','白色直噴','黑色直噴','四色印刷＋白','無印刷',...rules.filter((name)=>/印刷|直噴|白墨|黑墨|四色/.test(name))]);
  const printSides=['正面印刷','背面印刷','雙面印刷'];
  const whiteInk=['無白墨','滿版白墨','局部白墨','白色直噴'];
  const effects=unique(['不透光銀底印刷','鏡面貼紙','亮膜','霧膜','3D膜','七彩雷射膜','背膠','裁切外型','雕刻','導C角','壓克力折彎','鑽孔','銑槽／銑溝','燒光',...rules]);
  const fill=(id,values)=>{const el=$(id);if(el)el.innerHTML=values.map((value)=>`<option value="${escapeHTML(value)}"></option>`).join('');};
  fill('estimatePrintMethodOptions',printMethods);
  fill('estimatePrintSideOptions',printSides);
  fill('estimateWhiteInkOptions',whiteInk);
  fill('estimateSpecialEffectOptions',effects);
}

function renderMaterialPrices() {
  if (!$('materialPriceRows')) return;
  const keyword = norm($('materialPriceSearch')?.value || '');
  const rows = [...state.materialPrices]
    .filter((p) => p.active !== '否')
    .filter((p) => !keyword || norm([p.code,p.name,p.category,p.spec,p.thickness,p.supplier,p.source].join(' ')).includes(keyword))
    .sort((a,b) => dateValue(b.priceDate || b.updatedAt) - dateValue(a.priceDate || a.updatedAt));
  $('materialPriceCount').textContent = `共 ${rows.length} 筆`;
  $('materialPriceRows').innerHTML = rows.length ? rows.map((p) => `<tr>
    <td><strong>${escapeHTML(p.name)}</strong><br><small>${escapeHTML(p.code || '—')}</small></td>
    <td>${escapeHTML(p.category)}</td>
    <td>${escapeHTML([p.thickness,p.spec].filter(Boolean).join('｜') || '—')}</td>
    <td>${escapeHTML(p.unit)}</td>
    <td><strong>${money(p.basePrice)}</strong><br><small>${escapeHTML(p.currency)}</small></td>
    <td>${escapeHTML(p.supplier || '—')}</td><td>${escapeHTML(p.priceDate || '—')}</td>
    <td>${escapeHTML(p.source)}</td><td><span class="${confidenceClass(p.confidence)}">${escapeHTML(p.confidence)}</span></td>
    <td><div class="rowActions"><button class="linkButton" data-edit-price="${escapeHTML(p.id)}">修改</button><button class="linkButton dangerText" data-delete-price="${escapeHTML(p.id)}">刪除</button></div></td>
  </tr>`).join('') : '<tr><td colspan="10" class="empty">尚未建立材料價格。</td></tr>';
}


function priceReviewToRecord(review) {
  return {
    id: review.id,
    sourceFile: review.sourceFile,
    sourceRow: review.sourceRow,
    fileSavedDate: review.fileSavedDate,
    quoteDate: review.quoteDate,
    supplier: review.supplier,
    project: review.project,
    itemCode: review.itemCode,
    itemName: review.itemName,
    material: review.material,
    thicknessMm: review.thicknessMm,
    widthMm: review.widthMm,
    heightMm: review.heightMm,
    qty: review.qty,
    unit: review.unit,
    unitPrice: review.unitPrice || "",
    processTags: review.processTags,
    taxType: review.taxType,
    status: review.status,
    includeBaseline: review.includeBaseline,
    note: review.note,
  };
}

function approvedPriceReviews() {
  return state.priceReviews.filter((row) =>
    row.status === '已認證' &&
    row.includeBaseline === '是' &&
    toNumber(row.unitPrice) > 0
  );
}

function medianNumber(values) {
  const nums = values.map(toNumber).filter((value) => Number.isFinite(value) && value > 0).sort((a,b)=>a-b);
  if (!nums.length) return 0;
  const middle = Math.floor(nums.length / 2);
  return nums.length % 2 ? nums[middle] : (nums[middle - 1] + nums[middle]) / 2;
}

function reviewSimilarityScore(review, target) {
  let score = 0;
  const targetCode = norm(target.itemCode || target.code || '');
  const targetName = norm(target.itemName || target.name || '');
  const targetMaterial = target.material || '';
  const reviewMaterial = review.material || '';
  const reviewCode = norm(review.itemCode || '');
  const reviewName = norm(review.itemName || '');

  if(targetMaterial&&reviewMaterial&&!strictMaterialCompatibility(targetMaterial,reviewMaterial))return -999;

  const targetThickness = numericThickness(target.thickness || target.thicknessMm || target.spec);
  const reviewThickness = toNumber(review.thicknessMm);
  const descriptor=materialDescriptor(targetMaterial||reviewMaterial);
  if(descriptor.requiresThickness){
    if(!(targetThickness>0&&reviewThickness>0&&Math.abs(targetThickness-reviewThickness)<=0.11))return -999;
  }else if(targetThickness>0&&reviewThickness>0&&Math.abs(targetThickness-reviewThickness)>0.11){
    return -999;
  }

  if (targetCode && reviewCode && targetCode === reviewCode) score += 45;
  if (targetName && reviewName) {
    if (targetName === reviewName) score += 35;
    else if (targetName.includes(reviewName) || reviewName.includes(targetName)) score += 18;
  }
  if (targetMaterial && reviewMaterial) score += 35;
  if(targetThickness>0&&reviewThickness>0)score+=20;

  const targetW = toNumber(target.widthMm);
  const targetH = toNumber(target.heightMm);
  if (targetW && targetH && review.widthMm && review.heightMm) {
    const direct = Math.max(Math.abs(targetW-review.widthMm)/review.widthMm, Math.abs(targetH-review.heightMm)/review.heightMm);
    const rotated = Math.max(Math.abs(targetW-review.heightMm)/review.heightMm, Math.abs(targetH-review.widthMm)/review.widthMm);
    const ratioDiff = Math.min(direct, rotated);
    if(ratioDiff>0.20)return -999;
    if (ratioDiff <= 0.03) score += 35;
    else if (ratioDiff <= 0.10) score += 25;
    else score += 12;
  }

  const targetTagsArr=normalizeProcessTags(target.processTags || extractEstimateProcessTags(target));
  const reviewTags=normalizeProcessTags(review.processTags || '');
  if(targetTagsArr.length&&reviewTags.length){
    const reviewSet=new Set(reviewTags.map(norm));
    const unmatched=targetTagsArr.filter((tag)=>!reviewSet.has(norm(tag)));
    if(unmatched.length)return -999;
    score+=Math.min(20,targetTagsArr.length*5);
  }else if(targetTagsArr.length&&!reviewTags.length){
    return -999;
  }

  return score;
}

function priceReviewBaselineFor(review) {
  const candidates = approvedPriceReviews()
    .filter((row) => row.id !== review.id)
    .map((row) => ({ row, score: reviewSimilarityScore(row, review) }))
    .filter((entry) => entry.score >= 55)
    .sort((a,b)=>b.score-a.score);
  if (!candidates.length) return null;
  const maxScore = candidates[0].score;
  const peers = candidates.filter((entry) => entry.score >= maxScore - 5).slice(0, 8);
  return {
    value: medianNumber(peers.map((entry)=>entry.row.unitPrice)),
    count: peers.length,
    score: maxScore,
  };
}

function priceReviewStatusClass(status) {
  if (status === '已認證') return 'ready';
  if (status === '待補價格' || status === '異常價格') return 'missing';
  if (status === '僅保存' || status === '規格配對錯誤') return 'muted';
  return 'pending';
}

function renderPriceReviews() {
  if (!$('priceReviewRows')) return;
  const keyword = norm($('priceReviewSearch')?.value || '');
  const statusFilter = $('priceReviewStatusFilter')?.value || '';
  const rows = [...state.priceReviews]
    .filter((row) => !statusFilter || row.status === statusFilter)
    .filter((row) => !keyword || norm([
      row.sourceFile,row.project,row.itemCode,row.itemName,row.material,row.processTags,row.supplier,row.note
    ].join(' ')).includes(keyword))
    .sort((a,b)=>dateValue(b.quoteDate || b.fileSavedDate || b.updatedAt)-dateValue(a.quoteDate || a.fileSavedDate || a.updatedAt));

  const pending = state.priceReviews.filter((row)=>row.status==='待認證').length;
  const approved = state.priceReviews.filter((row)=>row.status==='已認證'&&row.includeBaseline==='是').length;
  const missing = state.priceReviews.filter((row)=>row.status==='待補價格').length;
  if ($('priceReviewCount')) $('priceReviewCount').textContent = String(state.priceReviews.length);
  if ($('priceReviewPendingCount')) $('priceReviewPendingCount').textContent = String(pending);
  if ($('priceReviewApprovedCount')) $('priceReviewApprovedCount').textContent = String(approved);
  if ($('priceReviewMissingCount')) $('priceReviewMissingCount').textContent = String(missing);

  $('priceReviewRows').innerHTML = rows.length ? rows.map((row)=>{
    const baseline = priceReviewBaselineFor(row);
    const difference = baseline?.value && row.unitPrice ? (row.unitPrice-baseline.value)/baseline.value*100 : null;
    const dimensions = row.widthMm && row.heightMm ? `${roundDisplay(row.widthMm)} × ${roundDisplay(row.heightMm)}mm` : '尺寸待補';
    return `<article class="priceReviewCard">
      <div class="priceReviewMain">
        <div class="priceReviewTitle">
          <span class="priceReviewStatus ${priceReviewStatusClass(row.status)}">${escapeHTML(row.status)}</span>
          <strong>${escapeHTML(row.itemName || '未命名品項')}</strong>
          <small>${escapeHTML([row.itemCode,row.project].filter(Boolean).join('｜') || row.sourceFile || '—')}</small>
        </div>
        <div class="priceReviewSpec">
          <span>${escapeHTML(row.material || '材質待補')}${row.thicknessMm?` ${roundDisplay(row.thicknessMm)}mm`:''}</span>
          <span>${escapeHTML(dimensions)}</span>
          <span>${escapeHTML(row.processTags || '製程待補')}</span>
        </div>
      </div>
      <div class="priceReviewPrice">
        <small>實際單價</small>
        <strong>${row.unitPrice ? money(row.unitPrice) : '待補'}</strong>
        <span>${escapeHTML(row.unit || '件')}｜數量 ${roundDisplay(row.qty||1)}</span>
      </div>
      <div class="priceReviewCompare">
        <small>內部相似基準</small>
        <strong>${baseline?.value ? money(baseline.value) : '尚無基準'}</strong>
        <span>${baseline ? `${baseline.count}筆｜${difference===null?'':`${difference>=0?'+':''}${difference.toFixed(1)}%`}` : '認證後開始累積'}</span>
      </div>
      <div class="priceReviewMeta">
        <span>報價日：${escapeHTML(row.quoteDate || '待補')}</span>
        <span>供應商：${escapeHTML(row.supplier || '待補')}</span>
        <span>稅別：${escapeHTML(row.taxType || '待補')}</span>
      </div>
      <div class="priceReviewActions">
        <button class="button ghost compact" type="button" data-edit-review="${escapeHTML(row.id)}">檢視／修改</button>
        ${row.unitPrice?`<button class="button primary compact" type="button" data-certify-review="${escapeHTML(row.id)}">認證並納入</button>`:''}
        <button class="linkButton dangerText" type="button" data-delete-review="${escapeHTML(row.id)}">刪除</button>
      </div>
    </article>`;
  }).join('') : '<div class="empty">沒有符合條件的待認證價格。</div>';
}

function renderPriceReviewProcessTags() {
  const input = $('priceReviewProcessTags');
  const container = $('priceReviewProcessTagButtons');
  if (!input || !container) return;
  const tags = normalizeProcessTags(input.value);
  input.value = tags.join('、');
  container.innerHTML = processTagButtonsHtml(tags, 'data-toggle-review-process', '1');
  const summary = $('priceReviewProcessTagSummary');
  if (summary) summary.textContent = tags.length ? `已選擇：${tags.join('、')}` : '尚未選擇製程';
}

function handlePriceReviewProcessTagClick(event) {
  const button = event.target.closest('[data-toggle-review-process]');
  if (!button) return;
  const tags = new Set(normalizeProcessTags($('priceReviewProcessTags').value));
  const tag = canonicalProcessTag(button.dataset.processTag);
  if (tags.has(tag)) tags.delete(tag); else tags.add(tag);
  $('priceReviewProcessTags').value = [...tags].join('、');
  renderPriceReviewProcessTags();
}

async function handlePriceReviewProcessImageChange(event) {
  const file = event.target.files?.[0];
  if (!file) return;
  try {
    state.priceReviewProcessImagePayload = await compressImageFile(file, 1800, 0.86);
    $('priceReviewProcessImagePreview').src = state.priceReviewProcessImagePayload.dataUrl;
    $('priceReviewProcessImageName').textContent = file.name;
    $('priceReviewProcessImagePreviewWrap').hidden = false;
    $('analyzePriceReviewProcessImage').disabled = false;
    $('clearPriceReviewProcessImage').disabled = false;
    $('priceReviewProcessAiStatus').textContent = '圖片已準備完成，可讓 AI 辨識材質、尺寸與製程。';
    $('priceReviewProcessAiStatus').className = 'photoStatus muted ready';
  } catch (error) {
    clearPriceReviewProcessImage();
    showNotice(`發包圖處理失敗：${error.message}`, 'error');
  }
}

function clearPriceReviewProcessImage() {
  state.priceReviewProcessImagePayload = null;
  if ($('priceReviewProcessImage')) $('priceReviewProcessImage').value = '';
  if ($('priceReviewProcessImagePreview')) $('priceReviewProcessImagePreview').removeAttribute('src');
  if ($('priceReviewProcessImagePreviewWrap')) $('priceReviewProcessImagePreviewWrap').hidden = true;
  if ($('priceReviewProcessImageName')) $('priceReviewProcessImageName').textContent = '';
  if ($('analyzePriceReviewProcessImage')) $('analyzePriceReviewProcessImage').disabled = true;
  if ($('clearPriceReviewProcessImage')) $('clearPriceReviewProcessImage').disabled = true;
  if ($('priceReviewProcessAiStatus')) {
    $('priceReviewProcessAiStatus').textContent = '尚未選擇發包圖';
    $('priceReviewProcessAiStatus').className = 'photoStatus muted';
  }
}

async function analyzePriceReviewProcessImage() {
  if (!state.priceReviewProcessImagePayload) { showNotice('請先選擇發包圖。', 'warn'); return; }
  const button = $('analyzePriceReviewProcessImage');
  button.disabled = true;
  button.textContent = 'AI 辨識中…';
  $('priceReviewProcessAiStatus').textContent = 'Gemini 正在讀取材質、尺寸與印刷加工說明…';
  $('priceReviewProcessAiStatus').className = 'photoStatus muted loading';
  try {
    const response = await secureApiRequest({ action: 'analyzeProcessImage', image: stripDataUrl(state.priceReviewProcessImagePayload) }, { timeoutMs: 180000 });
    const result = response.result || {};
    if (result.itemName && !$('priceReviewItemName').value.trim()) $('priceReviewItemName').value = result.itemName;
    if (result.itemCode && !$('priceReviewItemCode').value.trim()) $('priceReviewItemCode').value = result.itemCode;
    if (result.normalizedMaterial) setSelectOptions($('priceReviewMaterial'), result.normalizedMaterial);
    if (toNumber(result.thicknessMm) > 0) $('priceReviewThickness').value = toNumber(result.thicknessMm);
    if (toNumber(result.widthMm) > 0) $('priceReviewWidth').value = toNumber(result.widthMm);
    if (toNumber(result.heightMm) > 0) $('priceReviewHeight').value = toNumber(result.heightMm);
    $('priceReviewProcessTags').value = processTagsText([...normalizeProcessTags($('priceReviewProcessTags').value), ...(result.processTags || [])]);
    renderPriceReviewProcessTags();
    if (result.rawText) $('priceReviewNote').value = [$('priceReviewNote').value.trim(), `AI原文：${result.rawText}`].filter(Boolean).join('\n');
    const issues = Array.isArray(result.issues) ? result.issues.filter(Boolean) : [];
    $('priceReviewProcessAiStatus').textContent = `辨識完成：${normalizeProcessTags(result.processTags).length} 個製程標籤${issues.length ? `；提醒：${issues.join('、')}` : ''}`;
    $('priceReviewProcessAiStatus').className = 'photoStatus muted success';
    showNotice('AI 已帶入材質、尺寸與製程，請人工確認後儲存。', 'success');
  } catch (error) {
    $('priceReviewProcessAiStatus').textContent = `辨識失敗：${error.message}`;
    $('priceReviewProcessAiStatus').className = 'photoStatus muted error';
    showNotice(`AI 看圖辨識失敗：${error.message}`, 'error');
  } finally {
    button.disabled = false;
    button.textContent = 'AI 看圖選擇';
  }
}

function openPriceReviewDialog(review) {
  if (!review || !$('priceReviewDialog')) return;
  $('priceReviewId').value = review.id || '';
  $('priceReviewItemName').value = review.itemName || '';
  $('priceReviewItemCode').value = review.itemCode || '';
  setSelectOptions($('priceReviewMaterial'), review.material || '');
  $('priceReviewThickness').value = review.thicknessMm || '';
  $('priceReviewWidth').value = review.widthMm || '';
  $('priceReviewHeight').value = review.heightMm || '';
  $('priceReviewQty').value = review.qty || 1;
  $('priceReviewUnit').value = review.unit || '件';
  $('priceReviewUnitPrice').value = review.unitPrice || '';
  $('priceReviewProject').value = review.project || '';
  $('priceReviewSupplier').value = review.supplier || '';
  $('priceReviewQuoteDate').value = review.quoteDate || '';
  $('priceReviewTaxType').value = review.taxType || '';
  $('priceReviewProcessTags').value = processTagsText(review.processTags || '');
  renderPriceReviewProcessTags();
  clearPriceReviewProcessImage();
  $('priceReviewStatus').value = review.status || '待認證';
  $('priceReviewIncludeBaseline').checked = review.includeBaseline === '是';
  $('priceReviewSourceFile').value = review.sourceFile || '';
  $('priceReviewNote').value = review.note || '';
  $('priceReviewDialog').showModal();
}

function closePriceReviewDialog() {
  clearPriceReviewProcessImage();
  $('priceReviewDialog')?.close();
}

function priceReviewFromDialog() {
  const existing = state.priceReviews.find((row)=>row.id===$('priceReviewId').value) || {};
  const status = $('priceReviewStatus').value;
  return {
    ...priceReviewToRecord(existing),
    id: $('priceReviewId').value,
    itemName: $('priceReviewItemName').value.trim(),
    itemCode: $('priceReviewItemCode').value.trim(),
    material: $('priceReviewMaterial').value.trim(),
    thicknessMm: toNumber($('priceReviewThickness').value),
    widthMm: toNumber($('priceReviewWidth').value),
    heightMm: toNumber($('priceReviewHeight').value),
    qty: toNumber($('priceReviewQty').value) || 1,
    unit: $('priceReviewUnit').value.trim() || '件',
    unitPrice: $('priceReviewUnitPrice').value === '' ? '' : toNumber($('priceReviewUnitPrice').value),
    project: $('priceReviewProject').value.trim(),
    supplier: $('priceReviewSupplier').value.trim(),
    quoteDate: $('priceReviewQuoteDate').value,
    taxType: $('priceReviewTaxType').value.trim(),
    processTags: $('priceReviewProcessTags').value.trim(),
    status,
    includeBaseline: $('priceReviewIncludeBaseline').checked || status === '已認證' ? '是' : '否',
    sourceFile: $('priceReviewSourceFile').value.trim(),
    note: $('priceReviewNote').value.trim(),
  };
}

async function savePriceReviewRecords(records, successMessage='待認證價格已儲存。', options = {}) {
  const response = await secureApiRequest({action:'savePriceReviews',records},{timeoutMs:90000});
  const saved = (response.result?.records || []).map(normalizePriceReview);
  saved.forEach((item)=>{
    const index = state.priceReviews.findIndex((row)=>row.id===item.id);
    if (index >= 0) state.priceReviews[index]=item; else state.priceReviews.push(item);
  });
  renderPriceReviews();
  renderEstimateDraft();
  if(successMessage && !options.silent)showNotice(successMessage,'success');
  return { saved, result: response.result || {} };
}

async function savePriceReviewFromDialog(event) {
  event.preventDefault();
  const record = priceReviewFromDialog();
  if (!record.itemName) { showNotice('請輸入品項名稱。','warn'); return; }
  if (record.status === '已認證' && (!record.unitPrice || !record.quoteDate || !record.supplier)) {
    showNotice('正式認證前，請補齊單價、正式報價日期與供應商。','warn');
    return;
  }
  const button = $('savePriceReviewDialog');
  button.disabled = true;
  try {
    await savePriceReviewRecords([record], record.status==='已認證'?'價格已認證並納入智能估價。':'待認證價格已更新。');
    closePriceReviewDialog();
  } catch(error) {
    showNotice(`儲存失敗：${error.message}`,'error');
  } finally {
    button.disabled = false;
  }
}

async function handlePriceReviewRowsClick(event) {
  const edit = event.target.closest('[data-edit-review]');
  if (edit) {
    openPriceReviewDialog(state.priceReviews.find((row)=>row.id===edit.dataset.editReview));
    return;
  }
  const certify = event.target.closest('[data-certify-review]');
  if (certify) {
    const review = state.priceReviews.find((row)=>row.id===certify.dataset.certifyReview);
    if (!review) return;
    if (!review.quoteDate || !review.supplier) {
      openPriceReviewDialog({...review,status:'已認證',includeBaseline:'是'});
      showNotice('請補齊正式報價日期與供應商後再認證。','warn');
      return;
    }
    if (!confirm(`確定將「${review.itemName}」認證並納入智能估價基準嗎？`)) return;
    try {
      await savePriceReviewRecords([{...priceReviewToRecord(review),status:'已認證',includeBaseline:'是'}],'價格已認證並納入智能估價。');
    } catch(error) { showNotice(`認證失敗：${error.message}`,'error'); }
    return;
  }
  const del = event.target.closest('[data-delete-review]');
  if (!del) return;
  const review = state.priceReviews.find((row)=>row.id===del.dataset.deleteReview);
  if (!confirm(`確定刪除「${review?.itemName || del.dataset.deleteReview}」嗎？`)) return;
  try {
    await secureApiRequest({action:'deletePriceReview',id:del.dataset.deleteReview},{timeoutMs:30000});
    state.priceReviews=state.priceReviews.filter((row)=>row.id!==del.dataset.deleteReview);
    renderPriceReviews(); renderEstimateDraft();
    showNotice('待認證價格已刪除。','success');
  } catch(error) { showNotice(`刪除失敗：${error.message}`,'error'); }
}

function mapPriceReviewCsvRow(headers, row) {
  const map = {};
  headers.forEach((header,index)=>{map[String(header||'').trim()]=row[index] ?? '';});
  return {
    id: map['價格紀錄ID'],
    sourceFile: map['來源文件'],
    sourceRow: map['來源列'],
    fileSavedDate: map['檔案最後儲存日'],
    quoteDate: map['正式報價日期'] || map['報價日期'],
    supplier: map['供應商'],
    project: map['專案／機台'] || map['專案/機台'],
    itemCode: map['品項代碼'],
    itemName: map['繁中品項名稱'] || map['品項名稱'],
    material: map['標準材質'] || map['材質'],
    thicknessMm: map['厚度mm'] || map['厚度'],
    widthMm: map['Wmm'] || map['寬mm'],
    heightMm: map['Hmm'] || map['高mm'],
    qty: map['數量'] || 1,
    unit: map['計價單位'] || '件',
    unitPrice: map['實際單價TWD'],
    processTags: map['製程標籤'],
    taxType: map['稅別'],
    status: map['認證狀態'] || (map['實際單價TWD'] ? '待認證' : '待補價格'),
    includeBaseline: map['是否納入基準'] || '否',
    note: map['來源備註'],
  };
}

function normalizeCsvHeaders(rows) {
  return (rows[0] || []).map((value) => String(value || '').replace(/^\uFEFF/, '').trim());
}

function isPriceReviewCsv(headers) {
  const set = new Set(headers);
  return set.has('繁中品項名稱') || set.has('品項名稱') || ((set.has('標準材質')||set.has('材質')) && set.has('實際單價TWD')) || set.has('價格紀錄ID');
}

function isMaterialPriceCsv(headers) {
  const set = new Set(headers);
  return set.has('材料名稱') && set.has('材質分類');
}

async function savePriceReviewCsvRows(rows, successPrefix = '', options = {}) {
  if (rows.length < 2) throw new Error('CSV 沒有可匯入的資料。');
  const headers = normalizeCsvHeaders(rows);
  const records = rows.slice(1).map((row) => mapPriceReviewCsvRow(headers, row)).filter((row) => row.itemName);
  if (!records.length) throw new Error('找不到「繁中品項名稱」欄位或有效資料。');
  const prefix = successPrefix ? `${successPrefix}，` : '';
  const result = await savePriceReviewRecords(records, options.silent ? '' : `${prefix}已匯入 ${records.length} 筆待認證歷史價格。`, options);
  renderDataImportSummary();
  return { saved: result.saved, response: result.result };
}

async function importPriceReviewCsv(event) {
  const file = event.target.files?.[0];
  event.target.value = '';
  if (!file) return;
  try {
    const rows = parseCsv(await file.text()).filter((row) => row.some((cell) => String(cell || '').trim()));
    const headers = normalizeCsvHeaders(rows);
    if (isPriceReviewCsv(headers)) {
      await savePriceReviewCsvRows(rows);
      return;
    }
    if (isMaterialPriceCsv(headers)) {
      await saveMaterialPriceCsvRows(rows, '已辨識為材料主檔 CSV');
      return;
    }
    throw new Error('無法辨識 CSV 類型。待認證檔需包含「繁中品項名稱、標準材質、實際單價TWD」；材料主檔需包含「材料名稱、材質分類」。');
  } catch(error) {
    showNotice(`匯入失敗：${error.message}`, 'error');
  }
}

function exportPriceReviewsCsv() {
  if (!state.priceReviews.length) { showNotice('目前沒有待認證價格可匯出。','warn'); return; }
  const header = ['價格紀錄ID','來源文件','來源列','檔案最後儲存日','正式報價日期','供應商','專案／機台','品項代碼','繁中品項名稱','標準材質','厚度mm','Wmm','Hmm','數量','計價單位','實際單價TWD','製程標籤','稅別','認證狀態','是否納入基準','來源備註'];
  const body = state.priceReviews.map((row)=>[
    row.id,row.sourceFile,row.sourceRow,row.fileSavedDate,row.quoteDate,row.supplier,row.project,row.itemCode,row.itemName,row.material,row.thicknessMm,row.widthMm,row.heightMm,row.qty,row.unit,row.unitPrice,row.processTags,row.taxType,row.status,row.includeBaseline,row.note
  ]);
  downloadCsv([header,...body],'IGS_價格待認證.csv');
}


function productionReferenceSimilarityScore(reference,item){
  if(!reference||reference.active==='否')return-1;
  if(!strictMaterialCompatibility(item.material||item.name,reference.material))return-1;
  const itemThickness=numericThickness(item.thickness);
  const refThickness=numericThickness(reference.thickness);
  if(itemThickness>0&&refThickness>0&&Math.abs(itemThickness-refThickness)>0.11)return-1;
  let score=60;
  if(itemThickness>0&&refThickness>0)score+=20;
  const iw=toNumber(item.widthMm),ih=toNumber(item.heightMm),rw=toNumber(reference.widthMm),rh=toNumber(reference.heightMm);
  if(iw>0&&ih>0&&rw>0&&rh>0){
    const areaRatio=Math.min(iw*ih,rw*rh)/Math.max(iw*ih,rw*rh);
    score+=Math.round(areaRatio*20);
  }
  const targetTags=new Set(extractEstimateProcessTags(item));
  const refTags=new Set(normalizeProcessTags(reference.processTags));
  if(targetTags.size&&refTags.size){
    const overlap=[...targetTags].filter((tag)=>refTags.has(tag)).length;
    score+=Math.min(15,overlap*5);
  }
  return score;
}

function bestProductionReferenceForItem(item){
  const candidates=(state.productionPriceReferences||[])
    .map((row)=>({row,score:productionReferenceSimilarityScore(row,item)}))
    .filter((entry)=>entry.score>=80)
    .sort((a,b)=>b.score-a.score);
  if(!candidates.length)return null;
  const best=candidates[0];
  const peers=candidates.filter((entry)=>entry.score>=best.score-5).slice(0,5);
  const basis=internalPriceBasisKey();
  const prices=peers.map((entry)=>basis==='productionRmb'?toNumber(entry.row.unitPriceRmb)*currentEstimateCnyRate():toNumber(entry.row.unitPriceTwd)).filter((value)=>value>0);
  if(!prices.length)return null;
  return {unitPrice:medianNumber(prices),score:best.score,count:peers.length,confidence:Math.max(65,Math.min(95,60+best.score*0.35)),records:peers.map((entry)=>entry.row)};
}

function bestApprovedHistoricalPriceForItem(item) {
  const candidates = approvedPriceReviews()
    .map((row)=>({row,score:reviewSimilarityScore(row,item)}))
    .filter((entry)=>entry.score>=70)
    .sort((a,b)=>b.score-a.score);
  if (!candidates.length) return null;
  const maxScore = candidates[0].score;
  const peers = candidates.filter((entry)=>entry.score>=maxScore-5).slice(0,8);
  return {
    unitPrice: medianNumber(peers.map((entry)=>entry.row.unitPrice)),
    score: maxScore,
    count: peers.length,
    confidence: Math.max(65,Math.min(96,60+maxScore*0.35)),
    records: peers.map((entry)=>entry.row),
  };
}

function similarApprovedHistoricalPricesForItem(item,limit=5){
  return approvedPriceReviews()
    .map((row)=>({row,score:reviewSimilarityScore(row,item)}))
    .filter((entry)=>entry.score>=45)
    .sort((a,b)=>b.score-a.score||dateValue(b.row.quoteDate)-dateValue(a.row.quoteDate))
    .slice(0,Math.max(1,limit));
}

function parseCsv(text) {
  const rows = []; let row = []; let cell = ''; let quoted = false;
  for (let i=0;i<text.length;i++) {
    const char=text[i];
    if (quoted) {
      if (char==='"' && text[i+1]==='"') { cell+='"'; i++; }
      else if (char==='"') quoted=false;
      else cell+=char;
    } else {
      if (char==='"') quoted=true;
      else if (char===',') { row.push(cell); cell=''; }
      else if (char==='\n') { row.push(cell.replace(/\r$/,'')); rows.push(row); row=[]; cell=''; }
      else cell+=char;
    }
  }
  if (cell || row.length) { row.push(cell.replace(/\r$/,'')); rows.push(row); }
  return rows;
}

async function saveMaterialPriceCsvRows(rows, successPrefix = '', options = {}) {
  if (rows.length < 2) throw new Error('CSV 沒有資料列');
  const headers = normalizeCsvHeaders(rows);
  const map = (name) => headers.indexOf(name);
  const value = (row, name, fallback = '') => {
    const index = map(name);
    return index >= 0 && row[index] !== undefined ? row[index] : fallback;
  };
  const records = rows.slice(1).map((r) => ({
    id: value(r, '價格ID'),
    code: value(r, '材料代碼'),
    name: value(r, '材料名稱'),
    category: value(r, '材質分類'),
    spec: value(r, '規格'),
    thickness: value(r, '厚度'),
    unit: value(r, '計價單位', '件'),
    basePrice: value(r, '基準單價', 0),
    currency: value(r, '幣別', 'TWD'),
    minimumQty: value(r, '最低採購量', 0),
    qtyMin: value(r, '數量下限', 0),
    qtyMax: value(r, '數量上限', 0),
    supplierId: value(r, '供應商ID'),
    supplier: value(r, '供應商名稱') || value(r, '供應商'),
    priceDate: value(r, '價格日期'),
    expiryDate: value(r, '有效期限'),
    source: value(r, '價格來源', '公司成交價'),
    confidence: value(r, '信心等級', '中'),
    processingFee: value(r, '加工費', 0),
    minimumFee: value(r, '最低費用', 0),
    conversionFactor: value(r, '單位換算係數', 1),
    note: value(r, '備註'),
    active: value(r, '使用中', '是'),
  })).filter((r) => r.name && r.category);
  if (!records.length) throw new Error('找不到「材料名稱」與「材質分類」欄位或有效資料');
  const response = await secureApiRequest({ action: 'saveMaterialPrices', records }, { timeoutMs: 120000 });
  const saved = (response.result?.records || []).map(normalizeMaterialPrice);
  saved.forEach((item) => {
    const index = state.materialPrices.findIndex((price) => price.id === item.id);
    if (index >= 0) state.materialPrices[index] = item;
    else state.materialPrices.push(item);
  });
  renderMaterialPrices();
  const prefix = successPrefix ? `${successPrefix}，` : '';
  renderDataImportSummary();
  if(!options.silent)showNotice(`${prefix}已匯入 ${saved.length} 筆材料價格。`, 'success');
  return { saved, response: response.result || {} };
}

async function importMaterialPriceCsv(event) {
  const file = event.target.files?.[0];
  event.target.value = '';
  if (!file) return;
  try {
    const rows = parseCsv(await file.text()).filter((row) => row.some((cell) => String(cell || '').trim()));
    const headers = normalizeCsvHeaders(rows);
    if (isMaterialPriceCsv(headers)) {
      await saveMaterialPriceCsvRows(rows);
      return;
    }
    if (isPriceReviewCsv(headers)) {
      await savePriceReviewCsvRows(rows, '已辨識為待認證歷史價格 CSV');
      return;
    }
    throw new Error('無法辨識 CSV 類型。材料主檔需包含「材料名稱、材質分類」；待認證檔需包含「繁中品項名稱、標準材質、實際單價TWD」。');
  } catch(error) {
    showNotice(`CSV 匯入失敗：${error.message}`, 'error');
  }
}

function exportMaterialPricesCsv() {
  if (!state.materialPrices.length) { showNotice('目前沒有價格資料可匯出。','warn'); return; }
  const header=['價格ID','材料代碼','材料名稱','材質分類','規格','厚度','計價單位','基準單價','幣別','最低採購量','數量下限','數量上限','供應商ID','供應商名稱','價格日期','有效期限','價格來源','信心等級','加工費','最低費用','單位換算係數','備註','使用中'];
  const body=state.materialPrices.map((p)=>[p.id,p.code,p.name,p.category,p.spec,p.thickness,p.unit,p.basePrice,p.currency,p.minimumQty,p.qtyMin,p.qtyMax,p.supplierId,p.supplier,p.priceDate,p.expiryDate,p.source,p.confidence,p.processingFee,p.minimumFee,p.conversionFactor,p.note,p.active]);
  downloadCsv([header,...body],'IGS_材料價格主檔.csv');
}

function isProcessRuleCsv(headers){
  const set=new Set(headers);
  return set.has('製程名稱')&&set.has('計價方式')&&(set.has('打樣TWD')||set.has('原材TWD'));
}

function normalizeProcessRuleTier(value,pricingMethod){
  const tier=String(value||'').trim();
  if(tier&&tier!=='不限')return tier;
  return /每件/.test(String(pricingMethod||''))?'每件一次':'面積才數';
}

async function saveProcessRuleCsvRows(rows, options = {}){
  if(!rows || rows.length < 2)throw new Error('製程 CSV 沒有資料列。');
  const headers=normalizeCsvHeaders(rows);
  if(!isProcessRuleCsv(headers))throw new Error('製程 CSV 需包含「製程名稱、計價方式、打樣TWD」欄位。');
  const idx=(name)=>headers.indexOf(name);
  const val=(row,name,fallback='')=>idx(name)>=0?(row[idx(name)]??fallback):fallback;
  const records=rows.slice(1).map((row)=>{
    const name=String(val(row,'製程名稱')).trim();
    const method=String(val(row,'計價方式','每件')).trim();
    return{
      id:String(val(row,'規則ID')).trim(),type:'印刷加工',name,
      category:/膜|貼/.test(name)?'貼合':/印刷|白墨|黑墨|銀底/.test(name)?'印刷':'加工',
      thicknessMm:0,sizeTier:normalizeProcessRuleTier(val(row,'尺寸級距','不限'),method),
      pricingMethod:method,rawTwd:val(row,'原材TWD',0),sampleTwd:val(row,'打樣TWD',0),
      productionTwd:val(row,'量產TWD',0),sampleRmb:val(row,'打樣RMB',0),productionRmb:val(row,'量產RMB',0),
      priceDate:val(row,'日期'),source:val(row,'來源','CSV匯入'),
      certification:toNumber(val(row,'打樣TWD',0))>0?'已確認基準':'待補',active:'是',
      note:toNumber(val(row,'打樣TWD',0))>0?'CSV 匯入製程價格':'單價待補；智能估價不會以 0 元計入'
    };
  }).filter((row)=>row.name);
  if(!records.length)throw new Error('沒有可匯入的製程資料。');
  const response=await secureApiRequest({action:'saveInternalPriceRules',records},{timeoutMs:120000});
  const saved=(response.result?.records||[]).map(normalizeInternalPriceRule);
  saved.forEach((rule)=>{const i=state.internalPriceRules.findIndex((row)=>row.id===rule.id);if(i>=0)state.internalPriceRules[i]=rule;else state.internalPriceRules.push(rule);});
  renderProcessPriceRules();renderEstimateDraft();renderDataImportSummary();
  if(!options.silent)showNotice(`已匯入 ${saved.length} 筆製程／印刷規則。`,'success');
  return { saved, response: response.result || {} };
}

async function importProcessRuleCsv(event){
  const file=event.target.files?.[0];event.target.value='';if(!file)return;
  try{
    const rows=parseCsv(await file.text()).filter((row)=>row.some((cell)=>String(cell||'').trim()));
    await saveProcessRuleCsvRows(rows);
  }catch(error){showNotice(`製程 CSV 匯入失敗：${error.message}`,'error');}
}


const REFERENCE_IMPORT_CONFIG = Object.freeze({
  material: Object.freeze({ inputId:'bulkMaterialPriceCsv', nameId:'bulkMaterialPriceName', statusId:'bulkMaterialPriceStatus', label:'材料價格主檔' }),
  process: Object.freeze({ inputId:'bulkProcessRuleCsv', nameId:'bulkProcessRuleName', statusId:'bulkProcessRuleStatus', label:'製程／印刷規則' }),
  history: Object.freeze({ inputId:'bulkPriceReviewCsv', nameId:'bulkPriceReviewName', statusId:'bulkPriceReviewStatus', label:'歷史報價待認證' }),
  production: Object.freeze({ inputId:'bulkProductionPriceCsv', nameId:'bulkProductionPriceName', statusId:'bulkProductionPriceStatus', label:'量產價格參考' }),
});

function isProductionPriceCsv(headers){
  const set=new Set(headers);
  return set.has('品項名稱')&&set.has('材質')&&(set.has('單價RMB')||set.has('單價TWD'));
}

function expectedReferenceCsv(kind,headers){
  if(kind==='material')return isMaterialPriceCsv(headers);
  if(kind==='process')return isProcessRuleCsv(headers);
  if(kind==='history')return isPriceReviewCsv(headers)&&!isProductionPriceCsv(headers);
  if(kind==='production')return isProductionPriceCsv(headers);
  return false;
}

async function parseReferenceImportFile(kind,file){
  if(!file)throw new Error('尚未選擇檔案。');
  const rows=parseCsv(await file.text()).filter((row)=>row.some((cell)=>String(cell||'').trim()));
  if(rows.length<2)throw new Error('CSV 沒有資料列。');
  const headers=normalizeCsvHeaders(rows);
  if(!expectedReferenceCsv(kind,headers))throw new Error(`欄位不符合「${REFERENCE_IMPORT_CONFIG[kind].label}」格式。`);
  return { rows, headers, rowCount: rows.length-1, fileName:file.name };
}

function setReferenceImportStatus(kind,message,stateName=''){
  const config=REFERENCE_IMPORT_CONFIG[kind];
  const status=$(config.statusId);
  if(!status)return;
  status.textContent=message;
  status.className=stateName;
  const card=status.closest('.importStepCard');
  if(card){card.classList.remove('ready','success','error','loading');if(stateName)card.classList.add(stateName);}
}

function handleReferenceImportFileChange(kind,event){
  const file=event.target.files?.[0]||null;
  state.referenceImportFiles[kind]=file;
  state.referenceImportValidation[kind]=null;
  const config=REFERENCE_IMPORT_CONFIG[kind];
  $(config.nameId).textContent=file?file.name:'尚未選擇';
  setReferenceImportStatus(kind,file?'已選擇，等待檢查':'等待檔案',file?'ready':'');
  renderDataImportSummary();
}

async function validateReferenceCsvBundle(options={}){
  const result={};let valid=true;
  for(const kind of Object.keys(REFERENCE_IMPORT_CONFIG)){
    const file=state.referenceImportFiles[kind];
    if(!file){setReferenceImportStatus(kind,'尚未選擇檔案','error');valid=false;continue;}
    setReferenceImportStatus(kind,'檢查中…','loading');
    try{
      result[kind]=await parseReferenceImportFile(kind,file);
      state.referenceImportValidation[kind]=result[kind];
      setReferenceImportStatus(kind,`欄位正確，共 ${result[kind].rowCount} 筆`,'success');
    }catch(error){
      state.referenceImportValidation[kind]=null;valid=false;
      setReferenceImportStatus(kind,error.message,'error');
    }
  }
  const summary=$('referenceImportSummary');
  if(summary){
    summary.className=`referenceImportSummary ${valid?'success':'error'}`;
    summary.textContent=valid?'四份 CSV 檢查完成，可以開始匯入。':'檢查未通過；請依紅色提示更換正確檔案。';
  }
  if(!options.silent)showNotice(valid?'四份 CSV 欄位檢查完成。':'部分 CSV 格式不正確，尚未寫入任何資料。',valid?'success':'warn');
  return valid?result:null;
}

function productionReferenceToRecord(row,headers){
  const index=(name)=>headers.indexOf(name);
  const val=(name,fallback='')=>index(name)>=0?(row[index(name)]??fallback):fallback;
  return {
    id:val('參考ID'),itemName:val('品項名稱'),project:val('專案／機台')||val('專案/機台'),material:val('材質'),
    thickness:val('厚度'),widthMm:val('寬mm'),heightMm:val('高mm'),unitPriceRmb:val('單價RMB',0),
    unitPriceTwd:val('單價TWD',0),processTags:val('製程標籤'),source:val('資料來源','量產價格參考CSV'),active:val('使用中','是')
  };
}

async function saveProductionPriceReferenceCsvRows(rows,options={}){
  if(rows.length<2)throw new Error('量產價格 CSV 沒有資料列。');
  const headers=normalizeCsvHeaders(rows);
  if(!isProductionPriceCsv(headers))throw new Error('量產價格 CSV 需包含「品項名稱、材質、單價RMB或單價TWD」。');
  const records=rows.slice(1).map((row)=>productionReferenceToRecord(row,headers)).filter((row)=>row.itemName&&row.material&&(toNumber(row.unitPriceRmb)>0||toNumber(row.unitPriceTwd)>0));
  if(!records.length)throw new Error('沒有可匯入的量產價格資料。');
  const response=await secureApiRequest({action:'saveProductionPriceReferences',records},{timeoutMs:120000});
  const saved=(response.result?.records||[]).map(normalizeProductionPriceReference);
  saved.forEach((record)=>{const index=state.productionPriceReferences.findIndex((row)=>row.id===record.id);if(index>=0)state.productionPriceReferences[index]=record;else state.productionPriceReferences.push(record);});
  renderProductionPriceReferences();renderDataImportSummary();renderEstimateDraft();
  if(!options.silent)showNotice(`已匯入 ${saved.length} 筆量產價格參考。`,'success');
  return { saved, response: response.result || {} };
}

async function importReferenceCsvBundle(){
  const button=$('importReferenceCsvBundle');
  const validated=await validateReferenceCsvBundle({silent:true});
  if(!validated){showNotice('四份 CSV 尚未全部通過檢查，沒有寫入資料。','warn');return;}
  button.disabled=true;button.textContent='依序匯入中…';
  const summary=$('referenceImportSummary');
  const reports=[];
  try{
    setReferenceImportStatus('material','寫入中…','loading');
    let result=await saveMaterialPriceCsvRows(validated.material.rows,'',{silent:true});
    reports.push(`材料 ${result.response.inserted||0} 新增／${result.response.updated||0} 更新`);setReferenceImportStatus('material',`完成：${result.saved.length} 筆`,'success');

    setReferenceImportStatus('process','寫入中…','loading');
    result=await saveProcessRuleCsvRows(validated.process.rows,{silent:true});
    reports.push(`製程 ${result.response.inserted||0} 新增／${result.response.updated||0} 更新`);setReferenceImportStatus('process',`完成：${result.saved.length} 筆`,'success');

    setReferenceImportStatus('history','寫入中…','loading');
    result=await savePriceReviewCsvRows(validated.history.rows,'',{silent:true});
    const histResult=result.response?.result||result.response||{};
    reports.push(`歷史 ${histResult.inserted||0} 新增／${histResult.updated||0} 更新`);setReferenceImportStatus('history',`完成：${result.saved.length} 筆`,'success');

    setReferenceImportStatus('production','寫入中…','loading');
    result=await saveProductionPriceReferenceCsvRows(validated.production.rows,{silent:true});
    reports.push(`量產 ${result.response.inserted||0} 新增／${result.response.updated||0} 更新`);setReferenceImportStatus('production',`完成：${result.saved.length} 筆`,'success');

    if(summary){summary.className='referenceImportSummary success';summary.textContent=`四份資料匯入完成：${reports.join('；')}。再次匯入相同檔案會更新原紀錄。`;}
    showNotice('四份基礎資料已依序匯入完成。','success');
  }catch(error){
    if(summary){summary.className='referenceImportSummary error';summary.textContent=`匯入中斷：${error.message}。已完成的步驟可保留，修正後可安全重試。`;}
    showNotice(`整批匯入失敗：${error.message}`,'error');
  }finally{button.disabled=false;button.textContent='依序匯入四份';renderDataImportSummary();}
}

function setupReferenceDataImport(){
  Object.entries(REFERENCE_IMPORT_CONFIG).forEach(([kind,config])=>{
    $(config.inputId)?.addEventListener('change',(event)=>handleReferenceImportFileChange(kind,event));
  });
  $('validateReferenceCsvBundle')?.addEventListener('click',()=>validateReferenceCsvBundle());
  $('importReferenceCsvBundle')?.addEventListener('click',importReferenceCsvBundle);
}

function renderDataImportSummary(){
  if($('importMaterialCount'))$('importMaterialCount').textContent=(state.materialPrices||[]).length.toLocaleString('zh-TW');
  if($('importProcessCount'))$('importProcessCount').textContent=(state.internalPriceRules||[]).length.toLocaleString('zh-TW');
  if($('importHistoryCount'))$('importHistoryCount').textContent=(state.priceReviews||[]).length.toLocaleString('zh-TW');
  if($('importProductionCount'))$('importProductionCount').textContent=(state.productionPriceReferences||[]).length.toLocaleString('zh-TW');
}

function renderProductionPriceReferences(){
  const body=$('productionPriceReferenceRows');if(!body)return;
  const rows=[...(state.productionPriceReferences||[])].filter((row)=>row.active!=='否').slice(0,50);
  body.innerHTML=rows.length?rows.map((row)=>`<tr><td><strong>${escapeHTML(row.itemName||'—')}</strong></td><td>${escapeHTML(row.project||'—')}</td><td>${escapeHTML([row.material,row.thickness].filter(Boolean).join(' ')||'—')}</td><td>${row.widthMm&&row.heightMm?`${roundDisplay(row.widthMm)}×${roundDisplay(row.heightMm)}mm`:'—'}</td><td>${row.unitPriceRmb?`¥${Number(row.unitPriceRmb).toLocaleString('zh-TW',{maximumFractionDigits:2})}`:'—'}</td><td>${row.unitPriceTwd?money(row.unitPriceTwd):'—'}</td><td>${escapeHTML(row.processTags||'—')}</td></tr>`).join(''):'<tr><td colspan="7" class="empty">尚未匯入量產價格參考。</td></tr>';
}

async function researchMarketFromForm(event) {
  event.preventDefault();
  const button=$('researchMarket'); button.disabled=true; button.textContent='查詢中…';
  $('marketResearchResult').className='marketResearchResult'; $('marketResearchResult').innerHTML='<div class="empty">正在查詢即時網路資料，可能需要 10～60 秒…</div>';
  try {
    const response=await secureApiRequest({ action:'researchMarketIndex', input:{ category:$('marketCategory').value.trim(), query:$('marketQuery').value.trim(), baseValue:toNumber($('marketBaseValue').value)||100, months:toNumber($('marketPeriod').value)||3 } },{timeoutMs:120000});
    state.currentMarketResearch=response.result; renderMarketResearchResult();
  } catch(error){ $('marketResearchResult').innerHTML=`<div class="empty">查詢失敗：${escapeHTML(error.message)}</div>`; }
  finally{button.disabled=false;button.textContent='查詢網路浮動';}
}

function renderMarketResearchResult() {
  const r=state.currentMarketResearch; const box=$('marketResearchResult'); if(!box)return;
  if(!r){box.className='marketResearchResult empty';box.textContent='尚未查詢。';return;}
  const trendClass=toNumber(r.changePercent)>=0?'up':'down';
  box.className='marketResearchResult';
  box.innerHTML=`<h3>${escapeHTML(r.indexName)}</h3><div class="marketTrend"><strong class="${trendClass}">${toNumber(r.changePercent)>=0?'+':''}${toNumber(r.changePercent).toFixed(2)}%</strong><span>參考指數 ${toNumber(r.indexValue).toFixed(2)}｜信心 ${escapeHTML(r.confidence)}</span></div><p>${escapeHTML(r.summary)}</p><div class="sourceList">${(r.evidence||[]).map((e)=>`<div><strong>${escapeHTML(e.title||'來源')}</strong><br><small>${escapeHTML(e.date||'')}</small><p>${escapeHTML(e.note||'')}</p>${e.url?`<a href="${escapeHTML(e.url)}" target="_blank" rel="noopener noreferrer">查看來源</a>`:''}</div>`).join('')}</div><div class="formActions"><label class="checkRow"><input id="marketAutoUpdate" type="checkbox"> 將此指數納入每週自動更新</label><button class="button primary" type="button" data-save-market>人工確認並保存指數</button></div>`;
}

async function handleMarketResearchClick(event){
  if(!event.target.closest('[data-save-market]')||!state.currentMarketResearch)return;
  const button=event.target.closest('[data-save-market]');button.disabled=true;button.textContent='儲存中…';
  try{
    const r=state.currentMarketResearch;
    const autoUpdateElement=$('marketAutoUpdate');
    const record={...r, source:'Gemini Google Search', sourceUrls:(r.evidence||[]).map((e)=>e.url).filter(Boolean).join('\n'), autoUpdate:autoUpdateElement?.checked?'是':'否', active:'是'};
    const response=await secureApiRequest({action:'saveMarketIndex',record},{timeoutMs:60000});
    const saved=(response.result?.records||[]).map(normalizeMarketIndex);state.marketIndexes.push(...saved);renderMarketIndexes();showNotice('市場指數已保存；不會自動覆蓋公司價格。','success');
  }catch(error){showNotice(`市場指數儲存失敗：${error.message}`,'error');}
  finally{button.disabled=false;button.textContent='人工確認並保存指數';}
}

function renderMarketIndexes(){
  if(!$('marketIndexRows'))return;
  const rows=[...state.marketIndexes].filter((r)=>r.active!=='否').sort((a,b)=>dateValue(b.date)-dateValue(a.date));
  $('marketIndexRows').innerHTML=rows.length?rows.map((r)=>`<tr><td>${escapeHTML(r.date||'—')}</td><td><strong>${escapeHTML(r.category)}</strong><br><small>${escapeHTML(r.name)}</small></td><td>${toNumber(r.indexValue).toFixed(2)}</td><td class="${toNumber(r.changePercent)>=0?'confidenceLow':'confidenceHigh'}">${toNumber(r.changePercent)>=0?'+':''}${toNumber(r.changePercent).toFixed(2)}%</td><td>${escapeHTML(r.source||'—')}</td><td>${escapeHTML(r.autoUpdate||'否')}</td><td>${escapeHTML(r.summary||'—')}</td><td><button class="linkButton dangerText" data-delete-index="${escapeHTML(r.id)}">刪除</button></td></tr>`).join(''):'<tr><td colspan="8" class="empty">尚未保存市場指數。</td></tr>';
}

async function handleMarketIndexClick(event){const btn=event.target.closest('[data-delete-index]');if(!btn)return;const id=btn.dataset.deleteIndex;if(!confirm('確定刪除這筆市場指數嗎？'))return;try{await secureApiRequest({action:'deleteMarketIndex',id});state.marketIndexes=state.marketIndexes.filter((r)=>r.id!==id);renderMarketIndexes();renderEstimateDraft();}catch(e){showNotice(`刪除失敗：${e.message}`,'error');}}

async function enableWeeklyMarketUpdate(){const button=$('enableMarketAutoUpdate');button.disabled=true;button.textContent='設定中…';try{await secureApiRequest({action:'setupWeeklyMarketTrigger'},{timeoutMs:60000});showNotice('已啟用每週一早上 8 點的市場指數更新排程。只有「自動更新＝是」的指數會更新。','success');}catch(error){showNotice(`排程設定失敗：${error.message}`,'error');}finally{button.disabled=false;button.textContent='啟用每週更新排程';}}



function estimateTextExampleValue(){
  return [
    'B01_立體字（發光字），674.1mm × 207.3mm，需裁切，不透光銀底印刷，四色直噴',
    'B02_透明壓克力，719.7mm × 307.3mm，厚度5mm，需裁切，四色直噴，白色直噴',
    'B03_安迪板，1081mm × 708.2mm，厚度5mm，需裁切，四色直噴，裱亮膜',
    'B04_PVC，892.1mm × 671.2mm，厚度1mm，需裁切，四色直噴，白色直噴'
  ].join('\n');
}

function loadEstimateTextExample(){
  if($('estimateTextInput'))$('estimateTextInput').value=estimateTextExampleValue();
  if($('estimateTextBadge'))$('estimateTextBadge').textContent='已載入範例';
  if($('estimateTextStatus'))$('estimateTextStatus').textContent='已載入 B01～B04，可直接按「解析文字並估價」。';
}

function clearEstimateTextInput(){
  if($('estimateTextInput'))$('estimateTextInput').value='';
  if($('estimateTextBadge'))$('estimateTextBadge').textContent='尚未解析';
  if($('estimateTextStatus'))$('estimateTextStatus').textContent='可一次貼入多筆，每筆以編號開頭；換行內容會自動接到上一筆。';
}

function splitEstimateTextRecords(text){
  const normalized=String(text||'').replace(/\r/g,'\n').replace(/\n+/g,'\n').trim();
  if(!normalized)return[];
  const records=[];
  let current='';
  normalized.split('\n').forEach((raw)=>{
    const line=raw.trim();
    if(!line)return;
    const starts=/^[A-Za-z]{1,4}\d+(?:[-.]\d+)?\s*[_、:：\-]?/.test(line);
    if(starts){if(current)records.push(current);current=line;}
    else current=current?`${current}，${line}`:line;
  });
  if(current)records.push(current);
  if(records.length===1&&/[；;]/.test(records[0]))return records[0].split(/[；;]/).map((x)=>x.trim()).filter(Boolean);
  return records;
}

function estimateMaterialFromText(text){
  const t=standardizeErpText(text);
  if(/立體.*(?:發光)?字|發光字/.test(t))return'立體發光字';
  if(/安迪板/.test(t))return'安迪板';
  if(/鏡面.*貼紙/.test(t))return'鏡面貼紙';
  if(/透明.*貼紙/.test(t))return'透明貼紙';
  if(/亞光.*貼紙|霧面.*貼紙/.test(t))return'亞光貼紙';
  if(/PVC/i.test(t))return'PVC';
  if(/PMMA|壓克力/i.test(t))return'透明壓克力';
  if(/\bPC\b/i.test(t))return'PC';
  if(/PET/i.test(t))return'PET';
  return t.split(/[，,]/)[0].replace(/^[A-Za-z]{1,4}\d+(?:[-.]\d+)?\s*[_、:：\-]?/,'').trim();
}

function estimateProcessDetailsFromText(text){
  const t=standardizeErpText(text);
  const print=[];const effects=[];const processes=[];
  if(hasAffirmativeProcessMention(t,/四色(?:直噴|印刷)?|CMYK/i))print.push('四色直噴');
  if(hasAffirmativeProcessMention(t,/白色直噴|白墨|印白|白底/))print.push('白色直噴');
  if(hasAffirmativeProcessMention(t,/銀底|銀色底/))effects.push('銀底');
  if(hasAffirmativeProcessMention(t,/3D\s*膜|滿天星/i))effects.push('3D膜');
  if(hasAffirmativeProcessMention(t,/亮膜/))effects.push('亮膜');
  if(hasAffirmativeProcessMention(t,/霧膜/))effects.push('霧膜');
  if(hasAffirmativeProcessMention(t,/鏡面貼紙|鏡面貼合/))effects.push('鏡面貼紙');
  if(hasAffirmativeProcessMention(t,/異[型形]切割|複雜切割/))processes.push('異型切割');
  else if(hasAffirmativeProcessMention(t,/需?裁切|切割外型|外型切割/))processes.push('切割外型');
  if(hasAffirmativeProcessMention(t,/折彎|熱摺彎/))processes.push('壓克力折彎');
  if(hasAffirmativeProcessMention(t,/雕刻/))processes.push('雕刻');
  if(hasAffirmativeProcessMention(t,/鑽孔/))processes.push('鑽孔');
  if(hasAffirmativeProcessMention(t,/導\s*C\s*角/i))processes.push('導C角');
  if(hasAffirmativeProcessMention(t,/燒光|拋光/))processes.push('燒光');
  if(hasAffirmativeProcessMention(t,/銑槽|銑溝/))processes.push('銑槽');
  if(hasAffirmativeProcessMention(t,/不透光/))effects.push('不透光');
  return{print:[...new Set(print)],effects:[...new Set(effects)],processes:[...new Set(processes)]};
}

function parseEstimateTextRecord(record,index){
  const original=String(record||'').trim();
  const converted=$('estimateTextAutoTraditional')?.checked===false?original:standardizeErpText(original);
  const codeMatch=converted.match(/^([A-Za-z]{1,4}\d+(?:[-.]\d+)?)\s*[_、:：\-]?\s*/);
  const code=codeMatch?.[1]||`TXT${String(index+1).padStart(2,'0')}`;
  const withoutCode=converted.replace(/^([A-Za-z]{1,4}\d+(?:[-.]\d+)?)\s*[_、:：\-]?\s*/,'');
  const firstSegment=withoutCode.split(/[，,]/)[0].trim();
  const dimensions=parseDimensionDetails(converted,'mm');
  const dimensionText=dimensions[0]?.sourceText||'';
  let displayName=firstSegment.replace(dimensionText,'').replace(/[，,]+$/,'').trim();
  if(!displayName)displayName=estimateMaterialFromText(converted)||code;
  const material=estimateMaterialFromText(converted);
  const thicknessMatch=converted.match(/厚度\s*[:：]?\s*(\d+(?:\.\d+)?)\s*mm/i)
    || converted.match(/(?:^|[，,])\s*(\d+(?:\.\d+)?)\s*mm\s*(?:[，,]|$)/i);
  const qtyMatch=converted.match(/(?:數量\s*[:：]?\s*)?(\d+(?:\.\d+)?)\s*(片|張|件|組|個|P|H)/i);
  const details=estimateProcessDetailsFromText(converted);
  const item={
    ...emptyEstimateItem(),
    code,
    originalName:firstSegment||displayName,
    normalizedName:displayName,
    name:displayName,
    originalMaterial:material,
    normalizedMaterial:material,
    material,
    originalSpec:original,
    spec:dimensionText||converted,
    thickness:thicknessMatch?`${thicknessMatch[1]}mm`:'',
    qty:qtyMatch?Math.max(1,toNumber(qtyMatch[1])):1,
    unit:qtyMatch?.[2]||'件',
    dimensions,
    printMethod:details.print.join('＋'),
    whiteInk:details.print.includes('白色直噴')?'白色直噴':'',
    specialEffect:details.effects.join('＋'),
    constraints:details.processes.join('＋'),
    wasteRate:0,
    marketAdjustment:0,
    marketManuallySet:true,
  };
  applyEstimateDimensionNormalization(item);
  item.priceFingerprint=[item.material,item.thickness,item.sizeTier,...details.print,...details.effects,...details.processes].filter(Boolean).join('｜');
  recalculateEstimateItem(item);
  return item;
}

function parseEstimateTextIntoDraft(){
  const text=$('estimateTextInput')?.value||'';
  const records=splitEstimateTextRecords(text);
  if(!records.length){showNotice('請先貼入至少一筆品項明細。','warn');return;}
  const parsed=records.map(parseEstimateTextRecord).filter((item)=>item.name||item.material);
  const mode=$('estimateTextImportMode')?.value||'replace';
  state.estimateDraftItems=mode==='append'?[...state.estimateDraftItems,...parsed]:parsed;
  recalculateAllEstimateItems();
  renderEstimateDraft();
  const fully=parsed.filter((item)=>toNumber(item.baseUnitPrice)>0&&!item.missingProcessTags?.length).length;
  const partial=parsed.filter((item)=>toNumber(item.baseUnitPrice)>0&&item.missingProcessTags?.length).length;
  const missing=parsed.filter((item)=>toNumber(item.baseUnitPrice)<=0).length;
  if($('estimateTextBadge'))$('estimateTextBadge').textContent=`已解析 ${parsed.length} 筆`;
  if($('estimateTextStatus'))$('estimateTextStatus').textContent=`已解析 ${parsed.length} 筆：完整估價 ${fully}、部分估價 ${partial}、待補價格 ${missing}。缺少製程單價時會列出待補項目。`;
  if(!$('estimateName')?.value.trim())$('estimateName').value=`文字匯入美術件估價 ${todayValue()}`;
  showNotice(`已解析並估價 ${parsed.length} 筆品項。`,'success');
}

function currentEstimateCnyRate(){
  return Math.max(0.01,toNumber($('estimateCnyRate')?.value)||4.61);
}

function formatCnyFromTwd(twd){
  return `¥${(toNumber(twd)/currentEstimateCnyRate()).toLocaleString('zh-TW',{maximumFractionDigits:2})}`;
}

function setEstimateAiStatus(message, type = '') {
  const el = $('estimateAiStatus');
  if (!el) return;
  el.textContent = message;
  el.className = `photoStatus ${type || 'muted'}`;
}

async function handleEstimateSourceFile(event) {
  const file = event.target.files?.[0];
  if (!file) return;
  try {
    state.estimateDocumentPayload = await prepareQuotationDocument(file);
    $('estimateSourceFileName').textContent = state.estimateDocumentPayload.name;
    $('analyzeEstimateSource').disabled = false;
    $('estimateAiBadge').textContent = '檔案已準備';
    setEstimateAiStatus(`${state.estimateDocumentPayload.mimeType === 'application/pdf' ? 'PDF' : '圖片'}已準備完成，可進行 AI 偵測。`, 'ready');
  } catch (error) {
    clearEstimateSourceDocument();
    showNotice(`估價來源檔案處理失敗：${error.message}`, 'error');
  }
}

function clearEstimateSourceDocument() {
  state.estimateDocumentPayload = null;
  state.estimateAiRawText = '';
  if ($('estimateSourceFile')) $('estimateSourceFile').value = '';
  if ($('estimateSourceFileName')) $('estimateSourceFileName').textContent = '支援 JPG、JPEG、PNG、WebP、PDF；不支援 Word';
  if ($('analyzeEstimateSource')) $('analyzeEstimateSource').disabled = true;
  if ($('estimateAiBadge')) $('estimateAiBadge').textContent = '尚未分析';
  if ($('estimateAiRawText')) $('estimateAiRawText').value = '';
  setEstimateAiStatus('尚未選擇檔案。');
}

function normalizeAiConfidence(value, fallback = 65) {
  const n = toNumber(value);
  if (!n) return fallback;
  return Math.max(10, Math.min(98, n <= 1 ? Math.round(n * 100) : Math.round(n)));
}

function useDocumentPriceForEstimate(item, unitPrice, confidence, fileName) {
  item.manualPrice = true;
  item.manualPriceConfidence = normalizeAiConfidence(confidence, 80);
  item.priceId = '';
  item.baseUnitPrice = Math.max(0, toNumber(unitPrice));
  item.priceSource = `AI辨識文件單價${fileName ? `｜${fileName}` : ''}`;
  item.marketAdjustment = 0;
  item.marketManuallySet = true;
  item.wasteRate = 0;
  item.usageManuallySet = false;
}


const BUILTIN_TRADITIONAL_TERMS = Object.freeze({
  '亚克力':'壓克力','压克力':'壓克力','奖杯':'獎盃','后方':'後方','镜面贴纸':'鏡面貼紙','透明贴纸':'透明貼紙',
  '亚光贴纸':'亞光貼紙','折弯':'折彎','热折弯':'熱折彎','灯条':'燈條','机台':'機台','导光板':'導光板',
  '背胶':'背膠','铣槽':'銑槽','铣沟':'銑溝','喷印':'噴印','满版白墨':'滿版白墨','局部白墨':'局部白墨',
  '侧面':'側面','内部':'內部','档案名称':'檔案名稱','规格':'規格','数量':'數量','单价':'單價','备注':'備註'
});
const COMMON_TRADITIONAL_CHARS = Object.freeze({'机':'機','压':'壓','后':'後','奖':'獎','杯':'盃','镜':'鏡','贴':'貼','纸':'紙','灯':'燈','条':'條','铣':'銑','弯':'彎','喷':'噴','亚':'亞','胶':'膠','导':'導','侧':'側','内':'內','图':'圖','号':'號','层':'層','边':'邊','宽':'寬','长':'長','发':'發','门':'門','维':'維','护':'護','线':'線','钢':'鋼','铝':'鋁','铜':'銅','轴':'軸','齿':'齒','轮':'輪','电':'電','头':'頭','双':'雙','单':'單','数':'數','价':'價','费':'費','规':'規','项':'項','档':'檔','称':'稱','满':'滿','热':'熱','沟':'溝','体':'體','实':'實','总':'總','额':'額','质':'質','类':'類','组':'組','产':'產','买':'買','卖':'賣','区':'區','选':'選','别':'別','码':'碼','应':'應','该':'該','写':'寫','录':'錄','认':'認','证':'證','块':'塊','带':'帶','设':'設','备':'備','处':'處','间':'間','进':'進','过':'過','与':'與','为':'為'});

function standardizeErpText(value){
  let text=String(value||'');
  const map={...BUILTIN_TRADITIONAL_TERMS};
  (state.termDictionary||[]).forEach((row)=>{
    const active=String(firstValue(row,['使用中','active'],'是'))!=='否';
    const source=String(firstValue(row,['原始詞','source'])).trim();
    const target=String(firstValue(row,['標準繁中詞','target'])).trim();
    if(active&&source&&target)map[source]=target;
  });
  Object.keys(map).sort((a,b)=>b.length-a.length).forEach((source)=>{text=text.split(source).join(map[source]);});
  return text.split('').map((char)=>COMMON_TRADITIONAL_CHARS[char]||char).join('').trim();
}

function dimensionMultiplier(unit){
  const normalized=String(unit||'mm').toLowerCase().replace(/\s/g,'');
  if(normalized==='cm'||normalized==='公分')return 10;
  if(normalized==='m'||normalized==='公尺')return 1000;
  if(normalized==='in'||normalized==='inch'||normalized==='吋')return 25.4;
  return 1;
}

function parseDimensionDetails(text,fallbackUnit='mm'){
  const source=String(text||'');
  const globalUnitMatch=source.match(/(?:單位[:：]?\s*)(mm|cm|m|in|inch|吋|公分|公尺)/i);
  const globalUnit=globalUnitMatch?.[1]||fallbackUnit||'mm';
  const groups=[];
  // 支援 x、×、*、／、/、、、「與」及「和」等常見尺寸分隔符。
  const separator='(?:[x×X*＊/／、]|與|和|by)';
  const regex=new RegExp(`[W寬宽]?\\s*(\\d+(?:\\.\\d+)?)\\s*(mm|cm|m|in|inch|吋|公分|公尺)?\\s*${separator}\\s*[H高]?\\s*(\\d+(?:\\.\\d+)?)\\s*(mm|cm|m|in|inch|吋|公分|公尺)?`,'gi');
  let match;
  while((match=regex.exec(source))!==null){
    const u1=match[2]||match[4]||globalUnit;
    const u2=match[4]||match[2]||globalUnit;
    const widthMm=Number(match[1])*dimensionMultiplier(u1);
    const heightMm=Number(match[3])*dimensionMultiplier(u2);
    if(widthMm>0&&heightMm>0)groups.push({widthMm,heightMm,qty:1,unit:u1,sourceText:match[0]});
  }
  return groups;
}

function isLightStripItem(item){
  return /燈條|LED燈帶|LED燈條|燈帶/i.test(standardizeErpText([item?.material,item?.name,item?.spec,item?.originalSpec].filter(Boolean).join(' ')));
}

function parseLightStripLengthMeters(item){
  const qty=Math.max(1,toNumber(item?.qty)||1);
  if(item?.usageManuallySet&&toNumber(item?.usage)>0){
    return{singleLengthM:toNumber(item.usage)/qty,totalLengthM:toNumber(item.usage),source:'人工用量'};
  }
  const text=standardizeErpText([item?.spec,item?.originalSpec,item?.name].filter(Boolean).join(' '));
  const candidates=[];
  const add=(value,unit,priority)=>{
    const n=toNumber(value);if(!(n>0))return;
    const u=String(unit||'m').toLowerCase();
    const meters=u==='mm'?n/1000:(u==='cm'||u==='公分'?n/100:(u==='m'||u==='米'||u==='公尺'?n:n));
    if(meters>0)candidates.push({meters,priority});
  };
  let m;
  const labeled=/(?:長度|總長|單支長|每支長|L)\s*[:：]?\s*(\d+(?:\.\d+)?)\s*(mm|cm|m|米|公分|公尺)/gi;
  while((m=labeled.exec(text))!==null)add(m[1],m[2],100);
  const generic=/(\d+(?:\.\d+)?)\s*(mm|cm|m|米|公分|公尺)/gi;
  while((m=generic.exec(text))!==null){
    const before=text.slice(Math.max(0,m.index-8),m.index);
    if(/寬|厚|間距|燈距/.test(before))continue;
    add(m[1],m[2],20);
  }
  const dimensionMax=Math.max(toNumber(item?.widthMm),toNumber(item?.heightMm));
  const dimensionMin=Math.min(toNumber(item?.widthMm)||Infinity,toNumber(item?.heightMm)||Infinity);
  if(dimensionMax>=100&&dimensionMax/(dimensionMin||1)>=3)add(dimensionMax,'mm',60);
  if(!candidates.length)return{singleLengthM:0,totalLengthM:0,source:'未解析'};
  candidates.sort((a,b)=>b.priority-a.priority||b.meters-a.meters);
  const singleLengthM=candidates[0].meters;
  return{singleLengthM,totalLengthM:singleLengthM*qty,source:candidates[0].priority>=60?'尺寸／標示長度':'規格推定'};
}

function lightStripFeatureProfile(value){
  const text=standardizeErpText(value||'').replace(/\s+/g,'').toUpperCase();
  const ic=(text.match(/(?:WS\d{4}|SK\d{4}|APA\d{3,4}|LPD\d{4}|TM\d{4}|UCS\d{4}|6803|5050RGB|5050|2835)/i)||[])[0]?.toUpperCase()||'';
  const density=toNumber((text.match(/(\d+(?:\.\d+)?)燈(?:\/米|每米|\/M)?/i)||[])[1]);
  const voltage=(text.match(/(?:5|12|24)V/i)||[])[0]?.toUpperCase()||'';
  const protection=/套管/.test(text)?'套管':/滴膠/.test(text)?'滴膠':/裸板|不防水/.test(text)?'裸板':'';
  const labeledWidth=toNumber((text.match(/(?:寬|寬度|WIDTH)[:：]?(\d+(?:\.\d+)?)MM/i)||[])[1]);
  const smallMmValues=[...text.matchAll(/(\d+(?:\.\d+)?)MM/gi)].map((m)=>toNumber(m[1])).filter((n)=>n>0&&n<=30);
  const width=labeledWidth||smallMmValues[0]||0;
  return{text,ic,density,voltage,protection,width};
}

function lightStripPricePerMeter(row,basisKey){
  if(basisKey==='sampleRmb')return (row.oneMeterRmb||row.tenCmRmb*10)*currentEstimateCnyRate();
  if(basisKey==='productionRmb')return ((row.fiveMeterRmb?row.fiveMeterRmb/5:row.oneMeterRmb||row.tenCmRmb*10))*currentEstimateCnyRate();
  if(basisKey==='productionTwd')return row.fiveMeterTwd?row.fiveMeterTwd/5:(row.oneMeterTwd||row.tenCmTwd*10);
  return row.oneMeterTwd||row.tenCmTwd*10;
}

function bestLightStripPriceForItem(item,basisKey){
  const target=lightStripFeatureProfile([item.material,item.name,item.spec,item.originalSpec].filter(Boolean).join(' '));
  let best=null,bestScore=-Infinity;
  (state.lightStripPrices||[]).filter((row)=>row.active!=='否').forEach((row)=>{
    const price=lightStripPricePerMeter(row,basisKey);if(!(price>0))return;
    const candidate=lightStripFeatureProfile([row.type,row.densityText,row.voltageProtection,`${row.widthMm||''}mm`].join(' '));
    let score=0;
    if(target.ic&&candidate.ic){if(target.ic!==candidate.ic)return;score+=70;}
    else if(target.ic||candidate.ic)score+=5;
    if(target.density&&candidate.density){if(Math.abs(target.density-candidate.density)>0.1)return;score+=25;}
    if(target.voltage&&candidate.voltage){if(target.voltage!==candidate.voltage)return;score+=20;}
    if(target.protection&&candidate.protection){if(target.protection!==candidate.protection)return;score+=20;}
    if(target.width&&candidate.width){if(Math.abs(target.width-candidate.width)>0.2)return;score+=15;}
    if(target.text&&candidate.text&&(target.text.includes(candidate.text)||candidate.text.includes(target.text)))score+=20;
    if(score>bestScore){bestScore=score;best={row,pricePerMeter:price,score};}
  });
  return bestScore>=20?best:null;
}

function estimateLightStripByDatabase(item,basisKey){
  if(!isLightStripItem(item))return null;
  const length=parseLightStripLengthMeters(item);
  const match=bestLightStripPriceForItem(item,basisKey);
  if(!match||!(length.totalLengthM>0))return null;
  const lineMaterial=length.totalLengthM*match.pricePerMeter;
  const unitPrice=lineMaterial/Math.max(1,toNumber(item.qty)||1);
  const label=[match.row.type,match.row.densityText,match.row.voltageProtection].filter(Boolean).join('｜')||'燈條';
  const warning=match.row.status&&match.row.status!=='可用'?`｜${match.row.status}`:'';
  return{
    unitPrice,materialUnitPrice:unitPrice,processUnitPrice:0,materialLineTotal:lineMaterial,processLineTotal:0,
    optimisticProcessLineTotal:0,conservativeProcessLineTotal:0,
    source:`燈條成本資料庫｜${label}｜${internalPriceScenarioLabel(basisKey)}${warning}`,
    confidence:Math.max(40,Math.min(92,50+match.score/2)),
    details:`燈條長度 ${Math.round(length.totalLengthM*1000)/1000}m（${length.source}）× ${Math.round(match.pricePerMeter*100)/100}/m`,
    breakdown:[{label:`${label} ${Math.round(length.totalLengthM*1000)/1000}m`,amount:unitPrice,type:'燈條材料'}],
    missing:[],isCompositePrice:false,isLightStrip:true,
  };
}

function summarizeEstimateDimensions(item){
  if(isLightStripItem(item)){
    const length=parseLightStripLengthMeters(item);
    const qty=Math.max(1,toNumber(item.qty)||1);
    const widthMm=Math.max(0,toNumber(item.widthMm));
    const heightMm=Math.max(0,toNumber(item.heightMm));
    return{groups:[],widthMm,heightMm,areaMm2:0,singleTsai:0,totalTsai:0,billingTsai:0,tier:'長度計價',status:length.totalLengthM>0?'已解析長度':'待確認長度',confidence:length.totalLengthM>0?90:25,longStrip:length.totalLengthM>0?`燈條整列長度 ${Math.round(length.totalLengthM*1000)/1000} m`:'請在規格輸入長度，例如 1.2m 或 1200mm',singleLengthM:length.singleLengthM,totalLengthM:length.totalLengthM};
  }
  let groups=[];
  if(Array.isArray(item.dimensions))groups=item.dimensions.map((g)=>({widthMm:toNumber(g.widthMm)||toNumber(g.width)*dimensionMultiplier(g.unit||item.originalUnit),heightMm:toNumber(g.heightMm)||toNumber(g.height)*dimensionMultiplier(g.unit||item.originalUnit),qty:Math.max(1,toNumber(g.qty)||1),unit:g.unit||item.originalUnit||'mm',sourceText:g.sourceText||''})).filter((g)=>g.widthMm>0&&g.heightMm>0);
  if(!groups.length)groups=parseDimensionDetails(item.originalSpec||item.spec,item.originalUnit||'mm');
  if(!groups.length&&toNumber(item.widthMm)>0&&toNumber(item.heightMm)>0)groups=[{widthMm:toNumber(item.widthMm),heightMm:toNumber(item.heightMm),qty:1,unit:'mm',sourceText:'欄位'}];
  if(!groups.length)return{groups:[],widthMm:0,heightMm:0,areaMm2:0,singleTsai:0,totalTsai:0,billingTsai:0,tier:'待確認',status:'待確認',confidence:0,longStrip:''};

  let areaPerItem=0,maxWidth=0,maxHeight=0,maxAspect=1,singleBillingTsai=0;
  groups.forEach((g)=>{
    const groupQty=Math.max(1,toNumber(g.qty)||1);
    const groupArea=g.widthMm*g.heightMm;
    areaPerItem+=groupArea*groupQty;
    // 每一個實體尺寸不足 1 才仍以 1 才計，再乘該尺寸於單件內的數量。
    singleBillingTsai+=Math.max(1,Math.ceil(groupArea/ESTIMATE_PRICING_CONFIG.TSAI_AREA_MM2))*groupQty;
    maxWidth=Math.max(maxWidth,g.widthMm);maxHeight=Math.max(maxHeight,g.heightMm);
    const min=Math.min(g.widthMm,g.heightMm);if(min>0)maxAspect=Math.max(maxAspect,Math.max(g.widthMm,g.heightMm)/min);
  });
  const qty=Math.max(1,toNumber(item.qty)||1);
  const singleTsai=areaPerItem/ESTIMATE_PRICING_CONFIG.TSAI_AREA_MM2;
  const totalTsai=singleTsai*qty;
  const billingTsai=Math.max(1,singleBillingTsai)*qty;
  const sideLong=Math.max(maxWidth,maxHeight);
  const sideShort=Math.min(maxWidth,maxHeight);
  let tier='面積才數',status=groups.length>1?'多組尺寸已逐組進位':'已解析',longStrip='';
  if(maxAspect>=4&&singleTsai<1){status='已解析／長條件';longStrip=`長寬比 ${Math.round(maxAspect*10)/10}；每件仍至少以 1 才計。`;}
  return{groups,widthMm:maxWidth,heightMm:maxHeight,areaMm2:areaPerItem*qty,singleTsai,totalTsai,billingTsai,tier,status,confidence:95,longStrip,sideLong,sideShort};
}

function applyEstimateDimensionNormalization(item){
  item.originalName=item.originalName||item.name||'';
  item.normalizedName=standardizeErpText(item.normalizedName||item.name||item.originalName);
  item.name=item.normalizedName;
  item.originalMaterial=item.originalMaterial||item.material||'';
  item.normalizedMaterial=standardizeErpText(item.normalizedMaterial||item.material||item.originalMaterial);
  item.material=item.normalizedMaterial;
  item.originalSpec=item.originalSpec||item.spec||'';
  item.spec=standardizeErpText(item.spec||item.originalSpec);
  item.printMethod=standardizeErpText(item.printMethod);
  item.printSide=standardizeErpText(item.printSide);
  item.whiteInk=standardizeErpText(item.whiteInk);
  item.specialEffect=standardizeErpText(item.specialEffect);
  const summary=summarizeEstimateDimensions(item);
  item.dimensions=summary.groups;
  item.dimensionDetailsJson=JSON.stringify(summary.groups);
  item.widthMm=toNumber(item.widthMm)||summary.widthMm;
  item.heightMm=toNumber(item.heightMm)||summary.heightMm;
  item.exactAreaMm2=summary.areaMm2;
  item.singleExactTsai=summary.singleTsai;
  item.totalExactTsai=summary.totalTsai;
  if(!item.billingTsaiManuallySet)item.billingTsai=summary.billingTsai;
  if(!item.sizeTier||item.sizeTier==='待確認')item.sizeTier=summary.tier;
  if(!item.dimensionStatus||item.dimensionStatus==='待確認')item.dimensionStatus=summary.status;
  item.dimensionConfidence=toNumber(item.dimensionConfidence)||summary.confidence;
  item.longStripWarning=item.longStripWarning||summary.longStrip;
  item.lightStripSingleLengthM=toNumber(summary.singleLengthM);
  item.lightStripTotalLengthM=toNumber(summary.totalLengthM);
  if(!item.wasteRateManuallySet)item.wasteRate=defaultWasteRateForMaterial(item.material||item.name);
  return item;
}

function mapAiEstimateItem(raw, strategy, fileName) {
  const spec = String(raw.spec || '').trim();
  const parsedDimensions = parseDimensions(spec);
  const qty = Math.max(0, toNumber(raw.qty)) || 1;
  const amount = Math.max(0, toNumber(raw.documentAmount ?? raw.amount));
  const visibleUnitPrice = Math.max(0, toNumber(raw.documentUnitPrice ?? raw.unitPrice ?? raw.price)) || (amount > 0 ? amount / qty : 0);
  const item = {
    ...emptyEstimateItem(),
    code: String(raw.code || raw.fileName || '').trim(),
    originalName: String(raw.originalName || raw.name || '').trim(),
    normalizedName: String(raw.normalizedName || raw.name || '').trim(),
    name: String(raw.normalizedName || raw.name || '').trim(),
    originalMaterial: String(raw.originalMaterial || raw.material || '').trim(),
    normalizedMaterial: String(raw.normalizedMaterial || raw.material || '').trim(),
    material: String(raw.normalizedMaterial || raw.material || '').trim(),
    originalSpec: String(raw.originalSpec || raw.spec || '').trim(),
    originalUnit: String(raw.originalUnit || raw.sizeUnit || 'mm').trim(),
    dimensions: Array.isArray(raw.dimensions) ? raw.dimensions : [],
    dimensionStatus: String(raw.dimensionStatus || '').trim(),
    dimensionConfidence: normalizeAiConfidence(raw.dimensionConfidence, 75),
    spec,
    thickness: String(raw.thickness || '').trim(),
    qty,
    unit: String(raw.unit || '').trim(),
    widthMm: Math.max(0, toNumber(raw.widthMm)) || parsedDimensions.widthMm,
    heightMm: Math.max(0, toNumber(raw.heightMm)) || parsedDimensions.heightMm,
    printMethod: String(raw.printMethod || '').trim(),
    printSide: String(raw.printSide || '').trim(),
    whiteInk: String(raw.whiteInk || '').trim(),
    specialEffect: String(raw.specialEffect || '').trim(),
    isArtItem: raw.isArtItem === false || String(raw.isArtItem) === '否' ? '否' : '是',
    confidenceScore: normalizeAiConfidence(raw.confidence, 60),
  };

  applyEstimateDimensionNormalization(item);
  const matchedPrice = bestMaterialPriceForItem(item);
  if (strategy === 'document_first' && visibleUnitPrice > 0) {
    useDocumentPriceForEstimate(item, visibleUnitPrice, raw.confidence, fileName);
  } else if (matchedPrice) {
    item.priceId = matchedPrice.id;
    item.priceManuallySelected = false;
    item.manualPrice = false;
    item.marketManuallySet = false;
  } else if (strategy !== 'company_only' && visibleUnitPrice > 0) {
    useDocumentPriceForEstimate(item, visibleUnitPrice, raw.confidence, fileName);
  } else {
    item.priceSource = '未找到可用價格，請補充價格主檔或人工單價';
    item.manualPrice = false;
  }
  recalculateEstimateItem(item);
  return item;
}

function applyEstimateSourceAnalysis(result) {
  const strategy = $('estimatePriceStrategy').value;
  const mode = $('estimateImportMode').value;
  const fileName = state.estimateDocumentPayload?.name || '';
  const imported = (Array.isArray(result.items) ? result.items : [])
    .map((raw) => mapAiEstimateItem(raw, strategy, fileName))
    .filter((item) => item.name);

  if (!imported.length) throw new Error('AI 沒有辨識到可用的估價品項');

  if (mode === 'append') {
    const current = state.estimateDraftItems.filter((item) => item.name || item.material || item.baseUnitPrice);
    state.estimateDraftItems = [...current, ...imported];
  } else {
    state.estimateDraftItems = imported;
  }

  if (!$('estimateName').value.trim()) {
    const machine = machineById($('estimateMachine').value);
    $('estimateName').value = String(result.projectName || result.project || '').trim() ||
      `${machine?.name || '新專案'} AI 智能估價`;
  }
  if (result.date) $('estimateDate').value = normalizeDate(result.date) || $('estimateDate').value;
  if (result.note && !$('estimateNote').value.trim()) $('estimateNote').value = String(result.note).trim();

  const rawParts = [];
  if (result.rawText) rawParts.push(String(result.rawText));
  const issues = Array.isArray(result.issues) ? result.issues.filter(Boolean) : [];
  if (issues.length) rawParts.push(`\n辨識提醒：\n- ${issues.join('\n- ')}`);
  state.estimateAiRawText = rawParts.join('\n').trim();
  $('estimateAiRawText').value = state.estimateAiRawText;

  renderEstimateDraft();

  const companyMatched = imported.filter((item) => item.priceId).length;
  const internalPriced = imported.filter((item) => item.internalRuleApplied || /內部價格規則/.test(item.priceSource||'')).length;
  const documentPriced = imported.filter((item) => item.manualPrice).length;
  const missing = imported.filter((item) => !item.priceId && !item.manualPrice && toNumber(item.baseUnitPrice) <= 0).length;
  $('estimateAiBadge').textContent = 'AI 已帶入';
  setEstimateAiStatus(
    `已帶入 ${imported.length} 筆：公司價格 ${companyMatched} 筆、內部規則 ${internalPriced} 筆、文件單價 ${documentPriced} 筆、待補 ${missing} 筆。`,
    missing ? 'warn' : 'success'
  );
  return { imported: imported.length, companyMatched, internalPriced, documentPriced, missing };
}

async function analyzeEstimateSourceDocument() {
  if (!state.estimateDocumentPayload) {
    showNotice('請先選擇估價來源圖片或 PDF。', 'warn');
    return;
  }
  const button = $('analyzeEstimateSource');
  const originalText = button.textContent;
  button.disabled = true;
  button.textContent = 'AI 偵測中…';
  $('estimateAiBadge').textContent = '分析中';
  setEstimateAiStatus('AI 正在讀取品項、材質、尺寸、印刷條件與可見價格，請稍候…', 'loading');
  try {
    const response = await secureApiRequest({
      action: 'analyzeEstimateDocument',
      document: stripDataUrl(state.estimateDocumentPayload),
    }, { includeToken: true, timeoutMs: 240000 });
    const summary = applyEstimateSourceAnalysis(response.result || {});
    if (summary.missing > 0 && $('estimateAutoPriceMissing')?.checked && $('estimatePriceStrategy').value !== 'company_only') {
      await estimateMissingPricesWithAi({ automatic: true });
    } else {
      showNotice(
        summary.missing > 0
          ? `AI 已辨識 ${summary.imported} 筆，但仍有 ${summary.missing} 筆缺價。可按「AI 依內部資料補估」或輸入公司價格。`
          : 'AI 已帶入估價明細並完成試算；請人工確認後再儲存。',
        summary.missing > 0 ? 'warn' : 'success'
      );
    }
  } catch (error) {
    $('estimateAiBadge').textContent = '分析失敗';
    setEstimateAiStatus(`AI 偵測失敗：${error.message}`, 'error');
    showNotice(`AI 偵測失敗：${error.message}`, 'error');
  } finally {
    button.disabled = false;
    button.textContent = originalText;
  }
}


function missingEstimateItems(){
  return state.estimateDraftItems
    .map((item, clientIndex) => ({ item, clientIndex }))
    .filter(({ item }) => item.name && !item.priceId && !item.manualPrice && toNumber(item.baseUnitPrice) <= 0);
}

function aiPriceConfidenceScore(value){
  const text = String(value || '').trim();
  if (text === '高') return 82;
  if (text === '中') return 64;
  if (text === '低') return 42;
  return normalizeAiConfidence(value, 50);
}

async function estimateMissingPricesWithAi(options = {}){
  const missing = missingEstimateItems();
  if (!missing.length) {
    if (options.manual) showNotice('目前沒有待補價格的品項。', 'success');
    return { priced: 0, missing: 0 };
  }

  const button = $('estimateMissingPrices');
  const analyzeButton = $('analyzeEstimateSource');
  const oldButtonText = button?.textContent || 'AI 依內部資料補估';
  if (button) {
    button.disabled = true;
    button.textContent = 'AI 估價中…';
  }
  if (options.automatic && analyzeButton) analyzeButton.disabled = true;

  $('estimateAiBadge').textContent = 'AI 補估中';
  setEstimateAiStatus(
    `內部價格規則已先套用；正在為剩餘 ${missing.length} 筆缺價品項，用 AI 比對公司價格與已保存市場指數；不會使用網路搜尋。結果仍需人工確認。`,
    'loading'
  );

  try {
    const response = await secureApiRequest({
      action: 'estimateMissingItemPrices',
      items: missing.map(({ item, clientIndex }) => ({
        clientIndex,
        code: item.code,
        name: item.name,
        material: item.material,
        thickness: item.thickness,
        spec: item.spec,
        widthMm: item.widthMm,
        heightMm: item.heightMm,
        qty: item.qty,
        unit: item.unit,
        printMethod: item.printMethod,
        printSide: item.printSide,
        whiteInk: item.whiteInk,
        specialEffect: item.specialEffect,
      })),
    }, { includeToken: true, timeoutMs: 180000 });

    const estimates = Array.isArray(response.result?.items) ? response.result.items : [];
    let priced = 0;
    const failedNotes = [];

    estimates.forEach((result) => {
      const index = Number(result.clientIndex);
      const item = state.estimateDraftItems[index];
      const unitPrice = Math.max(0, toNumber(result.estimatedUnitPrice));
      if (!item || unitPrice <= 0) {
        if (result?.reason) failedNotes.push(String(result.reason));
        return;
      }
      item.manualPrice = true;
      item.manualPriceConfidence = aiPriceConfidenceScore(result.confidence);
      item.priceId = '';
      item.baseUnitPrice = unitPrice;
      item.priceSource = `AI內部資料參考價｜${String(result.basis || '依公司價格與已保存指數估算').trim()}`;
      item.marketAdjustment = 0;
      item.marketManuallySet = true;
      item.usage = Math.max(1, toNumber(item.qty));
      item.usageManuallySet = true;
      item.wasteRate = 0;
      item.processingFee = 0;
      recalculateEstimateItem(item);
      priced += 1;
    });

    renderEstimateDraft();
    const remaining = missingEstimateItems().length;
    $('estimateAiBadge').textContent = remaining ? '部分已估價' : 'AI 已完成估價';
    setEstimateAiStatus(
      `AI 已補估 ${priced} 筆，尚有 ${remaining} 筆待補。AI 內部資料參考價不是正式供應商報價，請確認後再儲存。`,
      remaining ? 'warn' : 'success'
    );

    if (priced) {
      showNotice(
        remaining
          ? `已產生 ${priced} 筆 AI 參考價，仍有 ${remaining} 筆資料不足。`
          : `已產生 ${priced} 筆 AI 參考價並完成三段試算。`,
        remaining ? 'warn' : 'success'
      );
    } else {
      showNotice(`AI 無法可靠估價。${failedNotes[0] ? ` ${failedNotes[0]}` : '請補充公司價格或人工單價。'}`, 'warn');
    }
    return { priced, missing: remaining };
  } catch (error) {
    $('estimateAiBadge').textContent = '補估失敗';
    setEstimateAiStatus(`AI 補估價格失敗：${error.message}。已套用的內部價格仍保留。`, 'error');
    showNotice(`AI 文字額度不足或服務暫時不可用；內部規則估價仍保留。請稍後再試，或補充公司價格。`, 'warn');
    return { priced: 0, missing: missing.length, error };
  } finally {
    if (button) {
      button.textContent = oldButtonText;
      button.disabled = missingEstimateItems().length === 0;
    }
    if (options.automatic && analyzeButton) analyzeButton.disabled = !state.estimateDocumentPayload;
  }
}

function emptyEstimateItem(){return{code:'',name:'',originalName:'',normalizedName:'',material:'',originalMaterial:'',normalizedMaterial:'',spec:'',originalSpec:'',originalUnit:'mm',dimensions:[],dimensionDetailsJson:'',thickness:'',qty:1,unit:'',widthMm:0,heightMm:0,exactAreaMm2:0,singleExactTsai:0,totalExactTsai:0,billingTsai:0,billingTsaiManuallySet:false,sizeTier:'待確認',dimensionStatus:'待確認',dimensionConfidence:0,longStripWarning:'',lightStripSingleLengthM:0,lightStripTotalLengthM:0,usage:1,wasteRate:0,wasteRateManuallySet:false,priceId:'',baseUnitPrice:0,manualPrice:false,manualPriceConfidence:75,priceManuallySelected:false,marketAdjustment:0,marketManuallySet:false,processingFee:0,processingLevel:'AUTO',processingLevelSource:'自動判斷',processingLevelReason:'',processingLevelResolved:'',processingRangeLow:0,processingRangeBase:0,processingRangeHigh:0,otherFee:0,optimisticCost:0,baselineCost:0,conservativeCost:0,priceSource:'',confidenceScore:50,printMethod:'',printSide:'',whiteInk:'',specialEffect:'',isArtItem:'是',allowMaterialOptimization:'是',allowPrintOptimization:'是',constraints:'',internalRuleApplied:false,internalRuleDetails:'',historicalPriceApplied:false,productionReferenceApplied:false,costBreakdown:[],missingProcessTags:[],priceFingerprint:'',partialEstimate:false,calculationFormula:'',confidenceSource:'',similarHistoryRecords:[]};}


function internalPriceBasisKey(){
  const value=$('estimatePriceBasis')?.value||'sampleTwd';
  return ['sampleTwd','sampleTwdFloor','productionTwd','rawTwd','sampleRmb','productionRmb'].includes(value)?value:'sampleTwd';
}

function currentSampleTwdToRmbDivisor(){
  return Math.max(0.01,toNumber($('estimateSampleTwdRmbDivisor')?.value)||ESTIMATE_PRICING_CONFIG.SAMPLE_TWD_TO_RMB_DIVISOR);
}

function currentSampleRmbToProductionRmbDivisor(){
  return Math.max(0.01,toNumber($('estimateProductionRmbDivisor')?.value)||ESTIMATE_PRICING_CONFIG.SAMPLE_RMB_TO_PRODUCTION_RMB_DIVISOR);
}

function internalPriceScenarioLabel(basisKey=internalPriceBasisKey()){
  if(basisKey==='productionTwd')return'台灣量產 TWD';
  if(basisKey==='productionRmb')return`中國量產 RMB 換算（打樣TWD÷${currentSampleTwdToRmbDivisor()}÷${currentSampleRmbToProductionRmbDivisor()}，RMB匯率 ${currentEstimateCnyRate()}）`;
  if(basisKey==='sampleRmb')return`中國打樣 RMB 換算（打樣TWD÷${currentSampleTwdToRmbDivisor()}，RMB匯率 ${currentEstimateCnyRate()}）`;
  if(basisKey==='rawTwd')return'原材料 TWD';
  return'台灣打樣 TWD（統一包價公式）';
}

function internalMaterialBasisKey(basisKey=internalPriceBasisKey()){
  return basisKey;
}

function internalProcessBasisKey(basisKey=internalPriceBasisKey()){
  return basisKey;
}

function isPrototypeBasis(basisKey=internalPriceBasisKey()){
  return basisKey==='sampleTwd'||basisKey==='sampleTwdFloor'||basisKey==='sampleRmb'||basisKey==='productionRmb';
}

function prototypeMaterialMultiplier(materialName,thicknessMm,basisKey=internalPriceBasisKey()){
  if(!isPrototypeBasis(basisKey))return 1;
  const descriptor=materialDescriptor(materialName);
  const thickness=toNumber(thicknessMm);
  if(descriptor.family==='壓克力'&&Math.abs(thickness-5)<=0.11)return 2;
  if(descriptor.family==='壓克力'&&Math.abs(thickness-3)<=0.11)return 1.3;
  return 1;
}

function defaultWasteRateForMaterial(materialName){
  const descriptor=materialDescriptor(materialName);
  if(descriptor.family==='壓克力')return ESTIMATE_PRICING_CONFIG.MATERIAL_WASTE_RATE['壓克力'];
  if(descriptor.family==='PVC')return ESTIMATE_PRICING_CONFIG.MATERIAL_WASTE_RATE.PVC;
  if(descriptor.family==='貼紙')return ESTIMATE_PRICING_CONFIG.MATERIAL_WASTE_RATE['貼紙'];
  if(descriptor.family==='安迪板')return ESTIMATE_PRICING_CONFIG.MATERIAL_WASTE_RATE['安迪板'];
  if(/3D\s*膜/i.test(standardizeErpText(materialName||'')))return ESTIMATE_PRICING_CONFIG.MATERIAL_WASTE_RATE['3D膜'];
  return 0;
}

function numericThickness(value){
  const match=String(value||'').match(/(\d+(?:\.\d+)?)/);
  return match?Number(match[1]):0;
}

function materialDescriptor(value){
  const text=standardizeErpText(value||'').replace(/\s+/g,'');
  const descriptor={text,family:'',variant:'',requiresThickness:false};
  if(!text)return descriptor;
  if(text.includes('壓克力')){
    descriptor.family='壓克力';descriptor.requiresThickness=true;
    if(/冬瓜白/.test(text))descriptor.variant='冬瓜白';
    else if(/乳白/.test(text))descriptor.variant='乳白';
    else if(/霧面|霧透/.test(text))descriptor.variant='霧面';
    else if(/黑色|黑壓克力/.test(text))descriptor.variant='黑色';
    else if(/鏡面/.test(text))descriptor.variant='鏡面';
    else if(/透明/.test(text))descriptor.variant='透明';
    else if(/導光/.test(text))descriptor.variant='導光';
    else if(/螢光/.test(text))descriptor.variant='螢光';
    else descriptor.variant='未指定';
    return descriptor;
  }
  if(/安迪板/.test(text)){descriptor.family='安迪板';descriptor.variant='安迪板';descriptor.requiresThickness=true;return descriptor;}
  if(/透明PVC/i.test(text)){descriptor.family='PVC';descriptor.variant='透明';descriptor.requiresThickness=true;return descriptor;}
  if(/鏡面PVC/i.test(text)){descriptor.family='PVC';descriptor.variant='鏡面';descriptor.requiresThickness=true;return descriptor;}
  if(/PVC/i.test(text)){descriptor.family='PVC';descriptor.variant='未指定';descriptor.requiresThickness=true;return descriptor;}
  if(/鏡面貼紙/.test(text)){descriptor.family='貼紙';descriptor.variant='鏡面';return descriptor;}
  if(/銀貼紙|銀貼/.test(text)){descriptor.family='貼紙';descriptor.variant='銀';return descriptor;}
  if(/透明貼紙|透貼/.test(text)){descriptor.family='貼紙';descriptor.variant='透明';return descriptor;}
  if(/亞光貼紙|霧面貼紙/.test(text)){descriptor.family='貼紙';descriptor.variant='亞光';return descriptor;}
  if(/合成貼紙/.test(text)){descriptor.family='貼紙';descriptor.variant='合成';return descriptor;}
  if(/地板貼/.test(text)){descriptor.family='貼紙';descriptor.variant='地板';return descriptor;}
  if(/貼紙/.test(text)){descriptor.family='貼紙';descriptor.variant='未指定';return descriptor;}
  if(/燈條|LED燈帶|LED燈條|燈帶/i.test(text)){descriptor.family='燈條';descriptor.variant='燈條';return descriptor;}
  if(/\bPC\b/i.test(text)){descriptor.family='PC';descriptor.variant='PC';descriptor.requiresThickness=true;return descriptor;}
  if(/\bPET\b/i.test(text)){descriptor.family='PET';descriptor.variant='PET';descriptor.requiresThickness=true;return descriptor;}
  descriptor.family=text;descriptor.variant=text;
  return descriptor;
}

function normalizeMaterialMatchText(value){
  return standardizeErpText(value||'')
    .replace(/[\s　_\-—–·•・,，。()（）\[\]【】]/g,'')
    .replace(/(?:有限公司|股份有限公司|企業社|實業|材料行|供應商|廠商|報價|打樣|量產)/g,'');
}

function strictMaterialCompatibility(targetValue,candidateValue){
  const targetText=normalizeMaterialMatchText(targetValue);
  const candidateText=normalizeMaterialMatchText(candidateValue);
  const target=materialDescriptor(targetText);
  const candidate=materialDescriptor(candidateText);
  if(!target.family||!candidate.family)return false;
  if(target.family!==candidate.family)return false;
  if(target.variant==='未指定'||candidate.variant==='未指定'){
    // 只放寬供應商前綴、空白與標點；不放寬明確的透明／乳白／鏡面差異。
    return target.variant===candidate.variant || targetText.includes(candidateText) || candidateText.includes(targetText);
  }
  return target.variant===candidate.variant;
}

function canonicalInternalMaterial(value){
  const descriptor=materialDescriptor(value);
  if(!descriptor.family)return standardizeErpText(value||'');
  if(descriptor.variant&&descriptor.variant!=='未指定'){
    if(descriptor.family==='壓克力')return `${descriptor.variant}壓克力`;
    if(descriptor.family==='貼紙')return `${descriptor.variant}貼紙`;
    if(descriptor.family==='PVC'&&descriptor.variant!=='PVC')return `${descriptor.variant}PVC`;
  }
  return descriptor.family;
}

function effectiveInternalTier(item,basisKey=internalPriceBasisKey()){
  applyEstimateDimensionNormalization(item);
  if(toNumber(item.widthMm)>0&&toNumber(item.heightMm)>0)return'面積才數';
  const tier=String(item.sizeTier||'');
  return tier==='面積才數'?tier:'';
}

function internalRuleSampleTwd(rule){
  const explicit=Math.max(0,toNumber(rule?.sampleTwd));
  if(explicit>0)return explicit;
  return Math.max(0,toNumber(rule?.rawTwd));
}

function internalRulePrice(rule,basisKey,options={}){
  if(!rule)return 0;
  const isMaterial=rule.type==='材料';
  const thickness=toNumber(options.thicknessMm||rule.thicknessMm);
  const multiplier=isMaterial?prototypeMaterialMultiplier(options.materialName||rule.name,thickness,basisKey):1;
  const rawTwd=Math.max(0,toNumber(rule.rawTwd));
  const explicitSample=Math.max(0,toNumber(rule.sampleTwd));
  const sampleTwd=isMaterial
    ? rawTwd*multiplier
    : (explicitSample||rawTwd);

  if(basisKey==='rawTwd')return rawTwd;
  if(basisKey==='productionTwd')return Math.max(0,toNumber(rule.productionTwd));
  if(basisKey==='sampleRmb')return (sampleTwd/currentSampleTwdToRmbDivisor())*currentEstimateCnyRate();
  if(basisKey==='productionRmb')return (sampleTwd/currentSampleTwdToRmbDivisor()/currentSampleRmbToProductionRmbDivisor())*currentEstimateCnyRate();
  return sampleTwd;
}

function defaultInternalThicknessMm(materialName){
  const descriptor=materialDescriptor(materialName);
  if(!descriptor.requiresThickness)return 0;
  if(descriptor.family==='壓克力')return 3;
  if(descriptor.family==='PVC')return 1;
  if(descriptor.family==='安迪板')return 5;
  if(descriptor.family==='PC'||descriptor.family==='PET')return 1;
  return 3;
}

function resolveInternalRuleThickness(materialName,thicknessMm){
  const descriptor=materialDescriptor(materialName);
  const explicit=Math.max(0,toNumber(thicknessMm));
  if(!descriptor.requiresThickness||explicit>0){
    return{value:explicit,usedFallback:false,warning:''};
  }
  const fallback=defaultInternalThicknessMm(materialName);
  return{
    value:fallback,
    usedFallback:fallback>0,
    warning:fallback>0?`未填厚度，已暫以 ${fallback}mm 試算；請確認後再儲存正式估價。`:''
  };
}

function findInternalRule(type,name,thicknessMm,tier,basisKey){
  const target=type==='材料'?canonicalInternalMaterial(name):standardizeErpText(name||'');
  const thicknessResolution=type==='材料'?resolveInternalRuleThickness(target,thicknessMm):{value:thicknessMm,usedFallback:false};
  const effectiveThickness=toNumber(thicknessResolution.value);
  const availableRules=mergedInternalPriceRules();
  const rules=availableRules.filter((rule)=>
    rule.active!=='否' &&
    rule.type===type &&
    rule.sizeTier===tier &&
    internalRulePrice(rule,basisKey,{materialName:target,thicknessMm:effectiveThickness})>0
  );
  let best=null;
  let bestScore=-1;
  rules.forEach((rule)=>{
    let score=0;
    if(type==='材料'){
      if(!strictMaterialCompatibility(target,rule.name))return;
      const ruleName=canonicalInternalMaterial(rule.name);
      if(ruleName===target)score+=80;
      const rt=toNumber(rule.thicknessMm);
      const descriptor=materialDescriptor(target);
      if(descriptor.requiresThickness){
        if(!(effectiveThickness>0&&rt>0&&Math.abs(rt-effectiveThickness)<=0.11))return;
        score+=thicknessResolution.usedFallback?25:40;
      }else if(effectiveThickness>0&&rt>0){
        if(Math.abs(rt-effectiveThickness)>0.11)return;
        score+=25;
      }
    }else{
      const ruleName=standardizeErpText(rule.name||'');
      if(norm(ruleName)===norm(target))score+=100;
      else if(target&&(norm(ruleName).includes(norm(target))||norm(target).includes(norm(ruleName))))score+=60;
    }
    if(score>bestScore){bestScore=score;best=rule;}
  });
  return bestScore>=60?best:null;
}

function needsCmykWhitePrice(item){
  const text=standardizeErpText([
    item.printMethod,item.printSide,item.whiteInk,item.specialEffect,
    item.spec,item.originalSpec,item.name
  ].filter(Boolean).join(' '));
  return /四色|CMYK/i.test(text) && /白墨|白色|白底|印白|背白/.test(text);
}


function isProcessMentionNegated(text,start,end){
  const prefix=String(text||'').slice(Math.max(0,start-16),start);
  const suffix=String(text||'').slice(end,Math.min(String(text||'').length,end+10));
  const negativePrefix=/(?:不需要|不需|不用|不要|不做|沒有|無需|無須|毋須|免|非|無|未|不|請勿|禁止|避免)\s*(?:再|要|做|進行|使用|採用|包含|加做)?\s*$/;
  const negativeSuffix=/^\s*(?:不需要|不用|不要|取消|免除|排除)/;
  return negativePrefix.test(prefix)||negativeSuffix.test(suffix);
}

function hasAffirmativeProcessMention(text,pattern){
  const source=String(text||'');
  const regex=pattern instanceof RegExp
    ? new RegExp(pattern.source,[...new Set(`${pattern.flags.replace(/g/g,'')}g`)].join(''))
    : new RegExp(String(pattern),'g');
  let match;
  while((match=regex.exec(source))!==null){
    if(!isProcessMentionNegated(source,match.index,match.index+match[0].length))return true;
    if(match[0]==='')regex.lastIndex+=1;
  }
  return false;
}

function extractEstimateProcessTags(item){
  const text=standardizeErpText([item.printMethod,item.printSide,item.whiteInk,item.specialEffect,item.constraints,item.spec,item.originalSpec,item.name].filter(Boolean).join(' '));
  const tags=[];
  if(hasAffirmativeProcessMention(text,/四色|CMYK/i))tags.push('四色直噴');
  if(hasAffirmativeProcessMention(text,/白墨|白色直噴|印白|白底/))tags.push('白色直噴');
  if(hasAffirmativeProcessMention(text,/黑色直噴|黑墨|四色黑/))tags.push('黑色直噴');
  if(hasAffirmativeProcessMention(text,/不透光銀底|銀底/))tags.push('不透光銀底印刷');
  if(hasAffirmativeProcessMention(text,/鏡面貼紙|鏡面貼合/))tags.push('鏡面貼紙');
  if(hasAffirmativeProcessMention(text,/3D\s*膜|滿天星/i))tags.push('3D膜');
  if(hasAffirmativeProcessMention(text,/亮膜/))tags.push('亮膜');
  if(hasAffirmativeProcessMention(text,/霧膜/))tags.push('霧膜');
  if(hasAffirmativeProcessMention(text,/背膠/))tags.push('背膠');
  if(hasAffirmativeProcessMention(text,/異[型形]切割|複雜切割|角色輪廓|人物輪廓|多孔|鏤空|細碎輪廓/))tags.push('異型切割');
  else if(hasAffirmativeProcessMention(text,/裁切外型|切割外型|需?裁切|外型切割/))tags.push('裁切外型');
  if(hasAffirmativeProcessMention(text,/大弧度熱彎|熱彎成型/))tags.push('熱彎成型');
  else if(hasAffirmativeProcessMention(text,/折彎|熱摺彎|熱折彎/))tags.push('壓克力折彎');
  if(hasAffirmativeProcessMention(text,/雕刻/))tags.push('雕刻');
  if(hasAffirmativeProcessMention(text,/鑽孔/))tags.push('鑽孔');
  if(hasAffirmativeProcessMention(text,/攻牙/))tags.push('攻牙');
  if(hasAffirmativeProcessMention(text,/導\s*C\s*角/i))tags.push('導C角');
  if(hasAffirmativeProcessMention(text,/導\s*R\s*角|圓角/i))tags.push('導R角');
  if(hasAffirmativeProcessMention(text,/燒光|火拋光|拋光/))tags.push('燒光');
  if(hasAffirmativeProcessMention(text,/銑槽|銑溝/))tags.push('銑槽／銑溝');
  if(hasAffirmativeProcessMention(text,/烤漆/))tags.push('烤漆');
  if(hasAffirmativeProcessMention(text,/蝕刻/))tags.push('蝕刻');
  return[...new Set(tags)];
}


function processingLevelRule(levelCode,basisKey){
  const config=PROCESSING_LEVEL_CONFIG[levelCode];
  if(!config||!config.ruleName)return null;
  return mergedInternalPriceRules().find((rule)=>
    rule.active!=='否'&&
    rule.type==='加工等級'&&
    standardizeErpText(rule.name||'')===config.ruleName&&
    rule.sizeTier==='每件一次'&&
    internalRulePrice(rule,basisKey)>0
  )||null;
}

function resolveEstimateProcessingLevel(item,processTags){
  const requested=String(item.processingLevel||'AUTO').toUpperCase();
  if(requested!=='AUTO'&&PROCESSING_LEVEL_CONFIG[requested]){
    const config=PROCESSING_LEVEL_CONFIG[requested];
    item.processingLevelResolved=requested;
    item.processingLevelSource='人工指定';
    item.processingLevelReason=requested==='NONE'?'人工指定不計舊版加工等級。':`人工指定 ${config.label}；此費用會在新版包價之外另外加上。`;
    return{code:requested,source:'人工指定',reason:item.processingLevelReason,manual:true};
  }
  item.processingLevel='AUTO';
  item.processingLevelResolved='NONE';
  item.processingLevelSource='新版包價模式';
  item.processingLevelReason='AUTO 不再依文字套用 L1～L4；基本切割含在四色＋白墨包價，異型與特殊加工逐項計價。';
  return{code:'NONE',source:'新版包價模式',reason:item.processingLevelReason,manual:false};
}

const PROCESS_RULE_NAME_ALIASES=Object.freeze({
  '四色直噴':['四色直噴','四色印刷','四色噴印'],
  '白色直噴':['白色直噴','白墨','白色印刷'],
  '黑色直噴':['黑色直噴','黑墨','黑色印刷','四色黑'],
  '不透光銀底印刷':['不透光銀底印刷','不透光銀底','銀底印刷'],
  '鏡面貼紙':['鏡面貼紙','鏡面貼合'],
  '3D膜':['3D膜','滿天星'],
  '亮膜':['亮膜','裱亮膜'],
  '霧膜':['霧膜','裱霧膜'],
  '裁切外型':['裁切外型','切割外型','外型裁切','基本切割'],
  '異型切割':['切割外型(異型)','異型切割','異形切割','複雜切割'],
  '壓克力折彎':['壓克力折彎','折彎','熱折彎'],
  '雕刻':['雕刻'],
  '鑽孔':['鑽孔'],
  '導C角':['導C角'],
  '導R角':['導R角','圓角'],
  '熱彎成型':['熱彎成型','大弧度熱彎'],
  '攻牙':['攻牙'],
  '燒光':['燒光(火拋光)','燒光','火拋光','拋光'],
  '烤漆':['烤漆'],
  '蝕刻':['蝕刻'],
  '銑槽／銑溝':['銑槽／銑溝','銑槽','銑溝']
});

function findProcessRuleForTag(tag,tier,basisKey){
  const aliases=PROCESS_RULE_NAME_ALIASES[tag]||[tag];
  for(const name of aliases){
    const rule=findInternalRule('印刷加工',name,0,tier,basisKey);
    if(rule)return rule;
  }
  return null;
}

function comboRuleRequiredTags(rule){
  const name=standardizeErpText(rule?.name||'');
  const tags=[];
  if(/四色白|四色印刷.*白|四色.*白墨/.test(name))tags.push('四色直噴','白色直噴');
  if(/裁切|切割外型/.test(name))tags.push('裁切外型');
  return[...new Set(tags)];
}

function comboRuleMaterialCompatible(item,rule){
  const target=materialDescriptor(item.material||item.name);
  const category=standardizeErpText(rule.category||rule.name||'');
  if(category.includes('貼紙'))return target.family==='貼紙';
  if(category.includes('PVC')){
    if(target.family!=='PVC')return false;
  }else if(category.includes('壓克力')){
    if(target.family!=='壓克力')return false;
    if(target.variant&&target.variant!=='未指定'&&target.variant!=='透明')return false;
  }else return false;
  const wanted=toNumber(rule.thicknessMm);
  const actual=resolveInternalRuleThickness(item.material||item.name,numericThickness(item.thickness)).value;
  return !wanted || (actual>0&&Math.abs(actual-wanted)<=0.11);
}

function findInternalComboRule(item,processTags,tier,basisKey){
  const available=mergedInternalPriceRules();
  const candidates=available.filter((rule)=>
    rule.active!=='否'&&rule.type==='組合包價'&&rule.sizeTier===tier&&internalRulePrice(rule,basisKey)>0&&comboRuleMaterialCompatible(item,rule)
  ).map((rule)=>({rule,required:comboRuleRequiredTags(rule)}))
   .filter((entry)=>entry.required.every((tag)=>processTags.includes(tag)))
   .sort((a,b)=>b.required.length-a.required.length||String(a.rule.name).localeCompare(String(b.rule.name),'zh-Hant'));
  return candidates[0]||null;
}

function internalLinePricingContext(item){
  const qty=Math.max(1,toNumber(item.qty)||1);
  const singleExact=Math.max(0,toNumber(item.singleExactTsai)||0);
  const totalExact=Math.max(0,toNumber(item.totalExactTsai)||singleExact*qty);
  // billingTsai 的契約是整列總才數，已包含 qty；人工覆蓋時亦同。
  const totalBilling=Math.max(1,toNumber(item.billingTsai)||Math.max(1,Math.ceil(singleExact))*qty);
  return{qty,singleExact,totalExact,totalBilling};
}

function internalRuleLineCost(rule,basisKey,context,options={}){
  const rate=internalRulePrice(rule,basisKey,options);
  if(!rate)return 0;
  const method=standardizeErpText(rule?.pricingMethod||'');
  // 所有「每才」項目一律使用無條件進位後的整列計價才數。
  if(/每才|每收費才|按面積/.test(method))return rate*Math.max(1,context.totalBilling);
  if(/包價包含/.test(method))return 0;
  // 每件／固定最低價均按品項數量計算。
  return rate*Math.max(1,context.qty);
}

function comboMinimumLineCost(comboRule,basisKey){
  const available=mergedInternalPriceRules();
  const same=available.find((rule)=>rule.active!=='否'&&rule.type==='組合包價'&&rule.name===comboRule.name&&rule.category===comboRule.category&&Math.abs(toNumber(rule.thicknessMm)-toNumber(comboRule.thicknessMm))<=0.11&&rule.sizeTier==='100×100最低價'&&internalRulePrice(rule,basisKey)>0);
  return same?internalRulePrice(same,basisKey):0;
}

function estimateByLegacyInternalRules(item){
  applyEstimateDimensionNormalization(item);
  const basisKey=internalPriceBasisKey();
  const lightStripEstimate=estimateLightStripByDatabase(item,basisKey);
  if(lightStripEstimate){
    item.sizeTier='長度計價';
    item.costBreakdown=lightStripEstimate.breakdown||[];
    item.missingProcessTags=[];
    item.partialEstimate=false;
    item.priceFingerprint=['燈條',item.spec,item.qty,basisKey].filter(Boolean).join('｜');
    return lightStripEstimate;
  }

  const tier=effectiveInternalTier(item,basisKey);
  if(!tier)return null;
  item.sizeTier=tier;
  const scenarioLabel=internalPriceScenarioLabel(basisKey);
  const materialName=canonicalInternalMaterial(item.material||item.name);
  const thicknessResolution=resolveInternalRuleThickness(materialName,numericThickness(item.thickness));
  const thickness=thicknessResolution.value;
  const processTags=extractEstimateProcessTags(item);
  const context=internalLinePricingContext(item);
  const materialRule=findInternalRule('材料',materialName,thickness,tier,basisKey);
  if(!materialRule){
    item.costBreakdown=[];
    item.missingProcessTags=[materialName||'材料價格',...processTags];
    item.partialEstimate=false;
    return null;
  }

  const materialOptions={materialName,thicknessMm:thickness};
  const lineMaterial=internalRuleLineCost(materialRule,basisKey,context,materialOptions);
  const materialRate=internalRulePrice(materialRule,basisKey,materialOptions);
  const multiplier=prototypeMaterialMultiplier(materialName,thickness,basisKey);
  const breakdown=[{
    label:`${materialRule.name}${materialRule.thicknessMm?` ${materialRule.thicknessMm}mm`:''}｜${context.totalBilling}才${multiplier!==1?`｜打樣倍率×${multiplier}`:''}`,
    amount:lineMaterial/context.qty,
    type:'材料'
  }];
  const covered=new Set();
  let lineProcess=0;

  // 四色＋白墨為基礎印刷包價，每才 200 TWD；包價包含基本切割與背膠。
  if(processTags.includes('四色直噴')&&processTags.includes('白色直噴')){
    const combined=findInternalRule('印刷加工','四色印刷＋白墨',0,tier,basisKey)
      ||findInternalRule('印刷加工','四色印刷＋白',0,tier,basisKey);
    if(combined){
      const amount=internalRuleLineCost(combined,basisKey,context);
      lineProcess+=amount;
      breakdown.push({label:`${combined.name}｜${context.totalBilling}才`,amount:amount/context.qty,type:'印刷包價'});
      covered.add('四色直噴');covered.add('白色直噴');
      if(processTags.includes('裁切外型'))covered.add('裁切外型');
      if(processTags.includes('背膠'))covered.add('背膠');
    }
  }

  // 舊版 L1～L4 只有人工指定時才另外加價。
  const level=resolveEstimateProcessingLevel(item,processTags);
  if(level.manual&&level.code!=='NONE'){
    const gradeRule=processingLevelRule(level.code,basisKey);
    if(gradeRule){
      const amount=internalRuleLineCost(gradeRule,basisKey,context);
      lineProcess+=amount;
      breakdown.push({label:`${PROCESSING_LEVEL_CONFIG[level.code].label}（人工）`,amount:amount/context.qty,type:'人工舊版加工'});
    }
  }

  processTags.forEach((tag)=>{
    if(covered.has(tag))return;
    // 無印刷包價時，「基本裁切」無法視為免費；維持待補。
    const rule=findProcessRuleForTag(tag,tier,basisKey)||findProcessRuleForTag(tag,'每件一次',basisKey);
    if(!rule)return;
    const amount=internalRuleLineCost(rule,basisKey,context);
    if(!(amount>0))return;
    lineProcess+=amount;
    breakdown.push({label:rule.name,amount:amount/context.qty,type:'特殊製程'});
    covered.add(tag);
  });

  const missing=processTags.filter((tag)=>!covered.has(tag));
  const unitPrice=(lineMaterial+lineProcess)/context.qty;
  if(unitPrice<=0)return null;
  const details=[
    `${materialRule.name}${materialRule.thicknessMm?` ${materialRule.thicknessMm}mm`:''}｜每才 ${Math.round(materialRate*100)/100}`,
    `整列精確才數 ${Math.round(context.totalExact*10000)/10000}`,
    `整列計價才數 ${context.totalBilling}（無條件進位）`,
    multiplier!==1?`材質打樣倍率 ×${multiplier}`:'',
    thicknessResolution.usedFallback?thicknessResolution.warning:'',
    ...breakdown.filter((row)=>row.type!=='材料').map((row)=>row.label),
  ].filter(Boolean);

  item.costBreakdown=breakdown;
  item.missingProcessTags=missing;
  item.partialEstimate=missing.length>0;
  item.priceFingerprint=[materialName,item.thickness,tier,...processTags].filter(Boolean).join('｜');
  const confidence=(item.dimensionStatus?.includes('已解析')?82:62)+(processTags.length&&!missing.length?5:0)-Math.min(40,missing.length*10)-(thicknessResolution.usedFallback?12:0);
  return{
    unitPrice,
    materialUnitPrice:lineMaterial/context.qty,
    processUnitPrice:lineProcess/context.qty,
    materialLineTotal:lineMaterial,
    processLineTotal:lineProcess,
    optimisticProcessLineTotal:null,
    conservativeProcessLineTotal:null,
    source:`內部整才包價規則｜${details.join('＋')}｜${scenarioLabel}${missing.length?`｜待補製程：${missing.join('、')}`:''}`,
    confidence:Math.max(35,Math.min(92,confidence)),
    details:details.join('＋'),
    breakdown,
    missing,
    isCompositePrice:false,
  };
}


function unifiedMaterialKey(item){
  const materialName=canonicalInternalMaterial(item.material||item.name);
  const descriptor=materialDescriptor(materialName);
  const thickness=resolveInternalRuleThickness(materialName,numericThickness(item.thickness||item.spec)).value;
  let name=materialName;
  if(descriptor.family==='壓克力'){
    const variant=descriptor.variant==='未指定'?'透明':descriptor.variant;
    name=`${variant}壓克力`;
  }else if(descriptor.family==='PVC'){
    name=descriptor.variant==='鏡面'?'鏡面PVC':'PVC';
  }else if(descriptor.family==='PC')name='PC';
  else if(descriptor.family==='安迪板')name='安迪板';
  else if(descriptor.family==='貼紙'){
    const map={透明:'透明貼紙',亞光:'亞光貼紙',鏡面:'鏡面貼紙',銀:'銀貼紙',合成:'合成貼紙'};
    name=map[descriptor.variant]||materialName;
  }
  const thicknessText=thickness>0?`${Number(thickness)}mm`:'';
  return{key:thicknessText?`${name}_${thicknessText}`:name,name,descriptor,thickness};
}

function unifiedStageRate(twdRate,basisKey=internalPriceBasisKey()){
  const twd=Math.max(0,toNumber(twdRate));
  if(!(twd>0))return 0;
  if(basisKey==='productionTwd')return twd*UNIFIED_STAGE_CONVERSION.productionTwd;
  if(basisKey==='sampleRmb')return twd*UNIFIED_STAGE_CONVERSION.sampleRmb*currentEstimateCnyRate();
  if(basisKey==='productionRmb')return twd*UNIFIED_STAGE_CONVERSION.productionRmb*currentEstimateCnyRate();
  return twd;
}

function unifiedBundleMasterOverride(item,basisKey){
  const targetThickness=numericThickness(item.thickness||item.spec);
  const matches=(state.materialPrices||[])
    .filter((row)=>row.active!=='否'&&/才/.test(String(row.unit||''))&&toNumber(row.basePrice)>0)
    .filter((row)=>strictMaterialCompatibility(item.material||item.name,row.name))
    .filter((row)=>{
      const candidate=numericThickness(row.thickness||row.spec);
      return !(targetThickness>0||candidate>0)||(targetThickness>0&&candidate>0&&Math.abs(targetThickness-candidate)<=0.11);
    })
    .filter((row)=>/包價|含四色|含印刷|含白墨|基本切割/.test(`${row.note||''} ${row.source||''}`))
    .sort((a,b)=>dateValue(b.priceDate)-dateValue(a.priceDate));
  const match=matches[0];
  if(!match)return null;
  return{rate:unifiedStageRate(match.basePrice,basisKey),source:`材料主檔包價｜${match.supplier||match.source||'公司資料'}`};
}

function unifiedVolumeDiscount(singleBillingTsai){
  const cai=Math.max(1,toNumber(singleBillingTsai));
  if(cai>=10)return 0.80;
  if(cai>=5)return 0.90;
  return 1;
}

function unifiedLargeSplitDiscount(singleExactTsai){
  const cai=Math.max(0,toNumber(singleExactTsai));
  if(cai>=15)return 0.70;
  if(cai>=10)return 0.80;
  return 1;
}

function unifiedHoleCount(item){
  const text=standardizeErpText([item.spec,item.originalSpec,item.name,item.constraints].filter(Boolean).join(' '));
  const match=text.match(/(?:鑽)?(\d+)\s*(?:孔|個孔)/);
  return match?Math.max(0,Number(match[1])):0;
}

function unifiedProcessCost(item,tag,basisKey,context){
  const dynamic=findProcessRuleForTag(tag,'面積才數',basisKey)||findProcessRuleForTag(tag,'每件一次',basisKey);
  if(dynamic){
    const amount=internalRuleLineCost(dynamic,basisKey,context);
    if(amount>0)return{amount,label:dynamic.name,source:'製程價格規則'};
  }
  const fallback=UNIFIED_SPECIAL_PROCESS_PRICE[tag];
  if(!fallback)return null;
  const stagePrice=unifiedStageRate(fallback.price,basisKey);
  if(fallback.type==='每才')return{amount:stagePrice*context.totalBilling,label:`${tag}｜${context.totalBilling}才`,source:'內建候選'};
  if(fallback.type==='每件')return{amount:stagePrice*context.qty,label:`${tag}｜${context.qty}件`,source:'內建候選'};
  if(fallback.type==='每孔'){
    const holes=unifiedHoleCount(item);
    if(!(holes>0))return{amount:0,label:`${tag}｜待補孔數`,source:'待補',missing:true};
    return{amount:stagePrice*holes*context.qty,label:`${tag}｜${holes}孔×${context.qty}件`,source:'內建候選'};
  }
  return null;
}

function estimateByUnifiedPricingModel(item){
  applyEstimateDimensionNormalization(item);
  if(isLightStripItem(item))return null;
  const basisKey=internalPriceBasisKey();
  const scenarioLabel=internalPriceScenarioLabel(basisKey);
  const material=unifiedMaterialKey(item);
  const qty=Math.max(1,toNumber(item.qty)||1);
  const processTags=extractEstimateProcessTags(item);
  const context=internalLinePricingContext(item);
  const singleBilling=Math.max(1,context.totalBilling/qty);
  const singleExact=Math.max(0,context.totalExact/qty);
  const breakdown=[];
  const covered=new Set();
  const missing=[];
  let lineBase=0;
  let lineProcess=0;
  let formula='';
  let mode='';
  let source='';

  if(material.descriptor.family==='貼紙'){
    const piecePrice=UNIFIED_PER_PIECE_PRICE[material.name];
    if(!(piecePrice>0))return null;
    const rate=unifiedStageRate(piecePrice,basisKey);
    lineBase=Math.max(rate*qty,unifiedStageRate(UNIFIED_MINIMUM_CHARGE['貼紙'],basisKey));
    formula=`${qty}件 × ${Math.round(rate*100)/100}/件`;
    mode='貼紙按件';source='已校準按件包價';
    breakdown.push({label:`${material.name}｜${qty}件`,amount:lineBase/qty,type:'材料包價'});
  }else{
    const hasFour=processTags.includes('四色直噴');
    const hasWhite=processTags.includes('白色直噴');
    const noPrint=/無印刷/.test(standardizeErpText([item.specialEffect,item.spec,item.originalSpec,item.name].filter(Boolean).join(' ')));
    const bundleOverride=unifiedBundleMasterOverride(item,basisKey);
    const bundleTwd=UNIFIED_BUNDLE_PRICE_PER_TSAI[material.key];
    const rawTwd=UNIFIED_RAW_MATERIAL_PER_TSAI[material.key];

    if(singleBilling>UNIFIED_LARGE_ITEM_THRESHOLD_TSAI&&rawTwd>0&&(hasFour||hasWhite)){
      const rawRate=unifiedStageRate(rawTwd,basisKey);
      const printRate=unifiedStageRate(UNIFIED_LARGE_PRINT_RATE_TWD,basisKey);
      const discount=unifiedLargeSplitDiscount(singleExact);
      const waste=1+defaultWasteRateForMaterial(material.name)/100;
      const materialCost=context.totalExact*rawRate*waste*discount;
      const printCost=context.totalExact*printRate*discount;
      const basicProcess=unifiedStageRate(UNIFIED_LARGE_BASIC_PROCESSING_TWD,basisKey)*qty;
      lineBase=materialCost+printCost+basicProcess;
      mode='超大件拆項';source='超過10才：原材＋大面積印刷＋基本加工';
      breakdown.push({label:`${material.name}原材｜精確${Math.round(context.totalExact*100)/100}才｜含損耗`,amount:materialCost/qty,type:'材料'});
      breakdown.push({label:`大面積印刷｜精確${Math.round(context.totalExact*100)/100}才`,amount:printCost/qty,type:'印刷'});
      breakdown.push({label:'超大件基本加工',amount:basicProcess/qty,type:'基本加工'});
      formula=`精確${Math.round(context.totalExact*100)/100}才 × (${Math.round(rawRate*100)/100}原材×損耗 + ${Math.round(printRate*100)/100}印刷) × ${discount} + ${Math.round(basicProcess*100)/100}`;
      covered.add('四色直噴');covered.add('白色直噴');covered.add('裁切外型');covered.add('背膠');
    }else if(noPrint&&rawTwd>0){
      const rawRate=unifiedStageRate(rawTwd,basisKey);
      const waste=1+defaultWasteRateForMaterial(material.name)/100;
      lineBase=context.totalBilling*rawRate*waste;
      mode='原材整才';source='無印刷：原材整才＋材料損耗';
      breakdown.push({label:`${material.name}｜${context.totalBilling}才｜含損耗`,amount:lineBase/qty,type:'材料'});
      formula=`${context.totalBilling}才 × ${Math.round(rawRate*100)/100}/才 × ${Math.round(waste*100)/100}`;
      covered.add('裁切外型');
    }else if(hasFour&&hasWhite&&(bundleOverride?.rate>0||bundleTwd>0)){
      const rate=bundleOverride?.rate||unifiedStageRate(bundleTwd,basisKey);
      const discount=unifiedVolumeDiscount(singleBilling);
      lineBase=context.totalBilling*rate*discount;
      mode='每才包價';source=bundleOverride?.source||'100+筆歷史報價校準包價';
      breakdown.push({label:`${material.name}包價｜${context.totalBilling}才${discount<1?`｜折扣${discount}`:''}`,amount:lineBase/qty,type:'材料＋印刷包價'});
      formula=`${context.totalBilling}才 × ${Math.round(rate*100)/100}/才${discount<1?` × ${discount}`:''}`;
      covered.add('四色直噴');covered.add('白色直噴');covered.add('裁切外型');covered.add('背膠');
    }else{
      return null;
    }
  }

  processTags.forEach((tag)=>{
    if(covered.has(tag)||UNIFIED_INCLUDED_PROCESS_TAGS.has(tag))return;
    const result=unifiedProcessCost(item,tag,basisKey,context);
    if(!result||result.missing){missing.push(result?.label||tag);return;}
    if(result.amount>0){
      lineProcess+=result.amount;
      breakdown.push({label:result.label,amount:result.amount/qty,type:'特殊製程'});
      covered.add(tag);
    }else missing.push(tag);
  });

  const category=material.descriptor.family||'其他';
  const minimum=unifiedStageRate(UNIFIED_MINIMUM_CHARGE[category]||0,basisKey)*qty;
  const lineTotal=Math.max(lineBase+lineProcess,minimum);
  if(!(lineTotal>0))return null;
  if(lineProcess>0)formula+=`${formula?' + ':''}特殊加工 ${Math.round(lineProcess*100)/100}`;
  if(minimum>lineBase+lineProcess)formula+=`${formula?'；':''}套用最低消費 ${Math.round(minimum*100)/100}`;
  formula+=` = ${Math.round(lineTotal*100)/100}`;

  if((mode==='每才包價'||mode==='貼紙按件')&&!item.wasteRateManuallySet)item.wasteRate=0;
  const unitPrice=lineTotal/qty;
  const confidence=Math.max(35,Math.min(94,(mode==='每才包價'?88:mode==='貼紙按件'?86:68)-missing.length*12));
  const details=`${mode}｜${formula}｜${scenarioLabel}`;
  item.calculationFormula=formula;
  item.confidenceSource=source;
  item.costBreakdown=breakdown;
  item.missingProcessTags=missing;
  item.partialEstimate=missing.length>0;
  item.priceFingerprint=[material.key,mode,...processTags].join('｜');
  return{
    unitPrice,
    materialUnitPrice:lineBase/qty,
    processUnitPrice:lineProcess/qty,
    materialLineTotal:lineBase,
    processLineTotal:lineProcess,
    source:`統一公式估價｜${source}｜${scenarioLabel}${missing.length?`｜待補：${missing.join('、')}`:''}`,
    confidence,
    details,
    calculationFormula:formula,
    confidenceSource:source,
    breakdown,
    missing,
    wasteHandled:true,
    isCompositePrice:true,
    pricingMode:mode,
  };
}

function estimateByInternalRules(item){
  applyEstimateDimensionNormalization(item);
  if(isLightStripItem(item))return estimateByLegacyInternalRules(item);
  return estimateByUnifiedPricingModel(item)||estimateByLegacyInternalRules(item);
}

function materialPriceCompatibilityScore(item,price){
  const targetValue=item.material||item.name;
  if(!strictMaterialCompatibility(targetValue,price.name))return -1;
  const targetDescriptor=materialDescriptor(targetValue);
  const targetThickness=numericThickness(item.thickness||item.spec);
  const priceThickness=numericThickness(price.thickness||price.spec);
  if(targetDescriptor.requiresThickness){
    if(!(targetThickness>0&&priceThickness>0&&Math.abs(targetThickness-priceThickness)<=0.11))return -1;
  }else if(targetThickness>0&&priceThickness>0&&Math.abs(targetThickness-priceThickness)>0.11){
    return -1;
  }

  let score=0;
  const targetName=norm(standardizeErpText(targetValue));
  const priceName=norm(standardizeErpText(price.name));
  if(targetName===priceName)score+=80;
  else score+=60;
  if(targetThickness>0&&priceThickness>0)score+=30;
  const targetSpec=norm(standardizeErpText(item.spec||''));
  const candidateSpec=norm(standardizeErpText(price.spec||''));
  if(targetSpec&&candidateSpec){
    if(targetSpec===candidateSpec)score+=20;
    else if(targetSpec.includes(candidateSpec)||candidateSpec.includes(targetSpec))score+=8;
  }
  if(price.source==='公司成交價')score+=8;
  else if(price.source==='供應商報價')score+=5;
  if(price.priceDate)score+=Math.min(5,dateValue(price.priceDate)/1e13);
  return score;
}

function bestMaterialPriceForItem(item){
  const active=state.materialPrices.filter((p)=>p.active!=='否');
  const scored=active
    .map((p)=>({p,score:materialPriceCompatibilityScore(item,p)}))
    .filter((entry)=>entry.score>=0)
    .sort((a,b)=>b.score-a.score);
  return scored[0]?.score>=85?scored[0].p:null;
}

function latestMarketAdjustment(material, category){
  const key=norm(category||material);const rows=state.marketIndexes.filter((r)=>r.active!=='否'&&(!key||norm(r.category).includes(key)||key.includes(norm(r.category)))).sort((a,b)=>dateValue(b.date)-dateValue(a.date));return rows[0]?.changePercent||0;
}

function estimateUsage(item, price){
  // usage 的契約：永遠是「整列總用量」，已包含 qty；後續不得再次乘 qty。
  if(toNumber(item.usage)>0&&item.usageManuallySet)return toNumber(item.usage);
  if(isLightStripItem(item)){
    const length=parseLightStripLengthMeters(item);
    if(length.totalLengthM>0)return length.totalLengthM;
  }
  applyEstimateDimensionNormalization(item);
  const qty=Math.max(0,toNumber(item.qty));
  const areaM2=toNumber(item.exactAreaMm2)/1_000_000; // exactAreaMm2 已包含整列數量。
  const unit=price?.unit||item.unit||'件';let usage=qty;
  if(unit.includes('平方公尺'))usage=areaM2;
  else if(unit.includes('平方公分'))usage=areaM2*10000;
  else if(unit.includes('才'))usage=toNumber(item.billingTsai)||toNumber(item.totalExactTsai)||1;
  else if(unit.includes('公尺'))usage=Math.max(toNumber(item.widthMm),toNumber(item.heightMm))/1000*qty;
  return usage||qty||1;
}

function confidenceScoreForPrice(price){if(!price)return 25;let score=price.confidence==='高'?90:price.confidence==='中'?70:45;const ageDays=price.priceDate?(Date.now()-dateValue(price.priceDate))/86400000:999;if(ageDays>365)score-=25;else if(ageDays>180)score-=15;else if(ageDays>90)score-=7;if(price.source==='網路參考')score-=20;if(price.source==='公司成交價')score+=5;return Math.max(15,Math.min(98,score));}

function resolveEstimateOrderType(item){
  const selected=$('estimateOrderType')?.value||'auto';
  if(selected!=='auto')return selected;
  const basis=internalPriceBasisKey();
  if(basis==='productionTwd'||basis==='productionRmb')return'production';
  if((item.missingProcessTags||[]).length)return'newProcess';
  if(basis==='rawTwd')return'smallBatch';
  return'prototype';
}

function estimateRangeFromCost(baseCost,orderType){
  const value=Math.max(0,toNumber(baseCost));
  switch(orderType){
    case'production':return{low:value*0.95,base:value,high:value*1.10};
    case'smallBatch':return{low:value*0.95,base:value,high:value*1.15};
    case'newProcess':return{low:value,base:value*1.25,high:value*1.50};
    case'prototype':
    default:return{low:value,base:value,high:value*1.20};
  }
}

function recalculateEstimateItem(item){
  applyEstimateDimensionNormalization(item);
  const qty=Math.max(1,toNumber(item.qty)||1);
  const useManualPrice=Boolean(item.manualPrice&&toNumber(item.baseUnitPrice)>0);
  const productionBasis=['productionTwd','productionRmb'].includes(internalPriceBasisKey());
  const productionMatch=useManualPrice||!productionBasis?null:bestProductionReferenceForItem(item);
  const historicalMatch=useManualPrice||productionBasis?null:bestApprovedHistoricalPriceForItem(item);
  let selectedPrice=useManualPrice?null:state.materialPrices.find((p)=>p.id===item.priceId);
  if(selectedPrice&&materialPriceCompatibilityScore(item,selectedPrice)<0&&!item.priceManuallySelected){item.priceId='';selectedPrice=null;}
  const manuallySelectedPrice=Boolean(selectedPrice&&item.priceManuallySelected);
  const automaticPrice=useManualPrice||manuallySelectedPrice?null:bestMaterialPriceForItem(item);
  let price=manuallySelectedPrice?selectedPrice:null;
  let internalEstimate=null;

  item.costBreakdown=[];item.missingProcessTags=[];item.partialEstimate=false;item.internalRuleApplied=false;item.historicalPriceApplied=false;item.productionReferenceApplied=false;
  item.calculationFormula='';item.confidenceSource='';item.similarHistoryRecords=similarApprovedHistoricalPricesForItem(item,5);

  if(productionMatch&&productionMatch.score>=80){
    item.priceId='';item.manualPrice=false;item.productionReferenceApplied=true;
    item.baseUnitPrice=productionMatch.unitPrice;
    item.priceSource=`量產價格參考｜${productionMatch.count}筆中位數｜匹配分數 ${productionMatch.score}`;
    item.unit='件';item.usage=qty;item.usageManuallySet=true;
    item.wasteRate=0;item.marketAdjustment=0;item.marketManuallySet=true;
    item.costBreakdown=[{label:'相似量產整件價',amount:productionMatch.unitPrice,type:'量產參考'}];
    item.calculationFormula=`${qty}件 × ${Math.round(productionMatch.unitPrice*100)/100}/件 = ${Math.round(productionMatch.unitPrice*qty*100)/100}`;
    item.confidenceSource=`${productionMatch.count}筆相似量產參考中位數`;
    item.similarHistoryRecords=(productionMatch.records||[]).map((row)=>({itemName:row.itemName,material:row.material,thicknessMm:numericThickness(row.thickness),widthMm:row.widthMm,heightMm:row.heightMm,unitPrice:internalPriceBasisKey()==='productionRmb'?toNumber(row.unitPriceRmb)*currentEstimateCnyRate():toNumber(row.unitPriceTwd)}));
  }else if(historicalMatch&&historicalMatch.score>=82){
    item.priceId='';item.manualPrice=false;item.historicalPriceApplied=true;
    item.baseUnitPrice=historicalMatch.unitPrice;
    item.priceSource=`已認證歷史價｜${historicalMatch.count}筆中位數｜匹配分數 ${historicalMatch.score}`;
    item.unit='件';item.usage=qty;item.usageManuallySet=true;
    item.wasteRate=0;item.marketAdjustment=0;item.marketManuallySet=true;
    item.costBreakdown=[{label:'已認證歷史整件價',amount:historicalMatch.unitPrice,type:'歷史'}];
    item.calculationFormula=`${qty}件 × ${Math.round(historicalMatch.unitPrice*100)/100}/件 = ${Math.round(historicalMatch.unitPrice*qty*100)/100}`;
    item.confidenceSource=`${historicalMatch.count}筆已認證相似紀錄中位數`;
    item.similarHistoryRecords=historicalMatch.records||item.similarHistoryRecords;
  }else if(!useManualPrice&&!manuallySelectedPrice){
    // 結構化內部規則優先，避免材料主檔的單價與製程費維度混用。
    internalEstimate=estimateByInternalRules(item);
    if(internalEstimate){
      item.priceId='';item.internalRuleApplied=true;item.internalRuleDetails=internalEstimate.details;
      item.costBreakdown=internalEstimate.breakdown||[];item.missingProcessTags=internalEstimate.missing||[];
      item.partialEstimate=Boolean(item.missingProcessTags.length);item.baseUnitPrice=internalEstimate.unitPrice;
      item.priceSource=internalEstimate.source;item.unit=item.unit||'件';item.usage=qty;item.usageManuallySet=true;
      item.calculationFormula=internalEstimate.calculationFormula||internalEstimate.details||'';
      item.confidenceSource=internalEstimate.confidenceSource||'公司公式規則';
    }else if(automaticPrice){price=automaticPrice;item.priceId=automaticPrice.id;item.priceManuallySelected=false;}
  }

  if(!internalEstimate&&!item.historicalPriceApplied&&!item.productionReferenceApplied&&price){
    item.manualPrice=false;item.baseUnitPrice=price.basePrice;
    item.priceSource=[price.name,price.thickness,price.supplier,price.priceDate].filter(Boolean).join('｜');
    if(!item.unit)item.unit=price.unit;
    // price.processingFee 不再直接寫入單件人工加工費；製程請由製程規則計算。
  }

  if(useManualPrice){
    item.priceId='';item.costBreakdown=[{label:'文件／人工單價',amount:toNumber(item.baseUnitPrice),type:'人工'}];
    item.missingProcessTags=[];item.partialEstimate=false;
    if(!item.priceSource)item.priceSource='人工輸入單價';
    item.calculationFormula=`${qty}件 × ${Math.round(toNumber(item.baseUnitPrice)*100)/100}/件`;
    item.confidenceSource='人工輸入／文件可見價格';
    item.marketAdjustment=item.marketManuallySet?toNumber(item.marketAdjustment):0;
  }else if(!item.marketManuallySet&&!item.historicalPriceApplied&&!item.productionReferenceApplied){
    item.marketAdjustment=latestMarketAdjustment(item.material,price?.category);
  }else item.marketAdjustment=toNumber(item.marketAdjustment);

  if(!internalEstimate)item.usage=estimateUsage(item,price);
  const wasteFactor=1+Math.max(0,toNumber(item.wasteRate))/100;
  const marketFactor=Math.max(0,1+toNumber(item.marketAdjustment)/100);
  const manualExtras=(toNumber(item.processingFee)+toNumber(item.otherFee))*qty;
  const minimumFee=(item.historicalPriceApplied||item.productionReferenceApplied)?0:toNumber(price?.minimumFee);
  let costBeforeRange=0;

  if(internalEstimate){
    const materialLine=toNumber(internalEstimate.materialLineTotal);
    const materialWithWaste=internalEstimate.wasteHandled?materialLine:materialLine*wasteFactor;
    const processLine=toNumber(internalEstimate.processLineTotal);
    costBeforeRange=(materialWithWaste+processLine)*marketFactor+manualExtras;
    item.costBreakdown=internalEstimate.wasteHandled
      ? (internalEstimate.breakdown||[])
      : (internalEstimate.breakdown||[]).map((part)=>part.type==='材料'?{...part,label:`${part.label}｜含損耗 ${toNumber(item.wasteRate)}%`,amount:toNumber(part.amount)*wasteFactor}:part);
  }else{
    // usage 已是整列總用量；每才用量已經是 Math.ceil 後的整數才數。
    const materialLine=toNumber(item.usage)*toNumber(item.baseUnitPrice);
    costBeforeRange=materialLine*wasteFactor*marketFactor+manualExtras;
  }
  costBeforeRange=Math.max(minimumFee,costBeforeRange);

  const confidence=useManualPrice?Math.max(20,Math.min(98,toNumber(item.manualPriceConfidence)||75))
    :item.productionReferenceApplied&&productionMatch?productionMatch.confidence
    :item.historicalPriceApplied&&historicalMatch?historicalMatch.confidence
    :internalEstimate?internalEstimate.confidence:confidenceScoreForPrice(price);
  item.confidenceScore=confidence;
  const orderType=resolveEstimateOrderType(item);
  const range=(item.historicalPriceApplied||item.productionReferenceApplied)
    ? {low:costBeforeRange*0.95,base:costBeforeRange,high:costBeforeRange*1.10}
    : estimateRangeFromCost(costBeforeRange,orderType);
  item.estimateOrderTypeResolved=orderType;
  item.optimisticCost=roundCurrency(range.low);
  item.baselineCost=roundCurrency(range.base);
  item.conservativeCost=roundCurrency(Math.max(range.base,range.high));
  return item;
}

function recalculateAllEstimateItems(){state.estimateDraftItems.forEach(recalculateEstimateItem);}

function renderEstimateDraft(){
  if(!$('estimateItemRows'))return;
  recalculateAllEstimateItems();

  const priceOptions='<option value="">自動配對／未指定</option>'+
    state.materialPrices
      .filter((p)=>p.active!=='否')
      .map((p)=>`<option value="${escapeHTML(p.id)}">${escapeHTML(p.name)} ${escapeHTML(p.thickness)}｜${money(p.basePrice)}/${escapeHTML(p.unit)}</option>`)
      .join('');

  if(!state.estimateDraftItems.length){
    $('estimateItemRows').innerHTML=`
      <div class="estimateEmptyState">
        <div class="estimateEmptyIcon">Σ</div>
        <h3>尚未加入估價品項</h3>
        <p>上傳圖片或 PDF，按「AI 辨識並立即試算」；也可以手動新增一筆。</p>
        <button class="button secondary" type="button" data-empty-add-estimate>＋ 手動新增品項</button>
      </div>`;
    updateEstimateTotals();
    updateEstimateQuickMetrics();
    return;
  }

  $('estimateItemRows').innerHTML=state.estimateDraftItems.map((item,index)=>{
    const hasPrice=Boolean(item.priceId || item.manualPrice || toNumber(item.baseUnitPrice)>0);
    const aiReferencePrice=/AI市場參考價|AI內部資料參考價/.test(item.priceSource||'');
    const internalRulePrice=/內部價格規則|內部拆項規則|統一公式估價/.test(item.priceSource||'');
    const historicalPrice=/已認證歷史價/.test(item.priceSource||'');
    const productionReference=/量產價格參考/.test(item.priceSource||'');
    const priceState=hasPrice ? (item.partialEstimate ? '部分估價' : (item.priceId ? '公司價格' : (productionReference ? '量產參考' : (historicalPrice ? '歷史基準' : (internalRulePrice ? '內部規則' : (aiReferencePrice ? 'AI參考價' : '文件／人工價格')))))) : '待補價格';
    const priceClass=hasPrice ? (aiReferencePrice ? 'ai' : 'ready') : 'missing';
    const processingLevelOptions=PROCESSING_LEVEL_OPTIONS.map(([value,label])=>`<option value="${value}" ${String(item.processingLevel||'AUTO').toUpperCase()===value?'selected':''}>${escapeHTML(label)}</option>`).join('');
    const processingDisplay=item.processingLevelResolved&&item.processingLevelResolved!=='NONE'
      ? `${item.processingLevelResolved}｜${item.processingLevelSource||'自動判斷'}`
      : (item.processingLevelResolved==='NONE'?'不計加工':'尚未判斷');
    const thicknessFallback=resolveInternalRuleThickness(item.material||item.name,numericThickness(item.thickness));
    const thicknessFallbackWarning=item.internalRuleApplied&&thicknessFallback.usedFallback?thicknessFallback.warning:'';
    return `<article class="estimateQuickCard" data-estimate-index="${index}">
      <header class="estimateQuickCardHead">
        <div class="estimateQuickTitle">
          <span class="itemIndex">品項 ${index+1}</span>
          <strong>${escapeHTML(item.name||'尚未命名')}</strong>
          <small data-estimate-price-source>${escapeHTML(item.priceSource||'尚未配對價格')}</small>
        </div>
        <span class="estimatePriceState ${priceClass}">${priceState}</span>
        <div class="estimateCardCost" data-estimate-cost-summary>
          <strong>${money(item.baselineCost)}</strong>
          <small>信心 ${Math.round(item.confidenceScore)}%</small>
        </div>
        <button class="removeRow" type="button" data-remove-estimate="${index}">刪除</button>
      </header>

      <div class="estimateQuickFields">
        <label class="estimateFieldName"><span>品項名稱</span><input class="tableInput" data-estimate-field="name" value="${escapeHTML(item.name)}" placeholder="品項名稱"></label>
        <label><span>材質</span><input class="tableInput" data-estimate-field="material" value="${escapeHTML(item.material)}" placeholder="壓克力、PVC、貼紙"></label>
        <label><span>厚度</span><input class="tableInput" data-estimate-field="thickness" value="${escapeHTML(item.thickness)}" placeholder="3mm"></label>
        <label class="estimateFieldSpec"><span>規格／尺寸</span><input class="tableInput" data-estimate-field="spec" value="${escapeHTML(item.spec)}" placeholder="W500 × H300mm"></label>
        <label><span>數量</span><input class="tableInput numberInput" data-estimate-field="qty" type="number" min="0" step="0.01" value="${item.qty}"></label>
        <label><span>單位</span><input class="tableInput" data-estimate-field="unit" value="${escapeHTML(item.unit)}" placeholder="件"></label>
        <label><span>單價</span><input class="tableInput numberInput manualPriceInput" data-estimate-field="baseUnitPrice" type="number" min="0" step="0.01" value="${roundDisplay(item.baseUnitPrice)}" placeholder="待配對"></label>
      </div>

      <div class="estimateCostBreakdown ${item.missingProcessTags?.length?'hasMissing':''}">
        ${(item.costBreakdown||[]).length?item.costBreakdown.map((part)=>`<span class="breakdownChip"><b>${escapeHTML(part.label)}</b> ${money(part.amount)}</span>`).join(''):'<span class="breakdownMuted">尚無可用分項價格</span>'}
        ${item.missingProcessTags?.length?`<span class="breakdownMissing">待補：${escapeHTML(item.missingProcessTags.join('、'))}</span>`:''}
      </div>
      <div class="estimateFormulaDetail">
        <span><strong>計算方式：</strong>${escapeHTML(item.calculationFormula||'尚無公式')}</span>
        <span><strong>信心來源：</strong>${escapeHTML(item.confidenceSource||item.priceSource||'待確認')}</span>
        ${(item.similarHistoryRecords||[]).length?`<details><summary>相似歷史報價 ${Math.min(5,item.similarHistoryRecords.length)} 筆</summary><div class="similarHistoryList">${item.similarHistoryRecords.slice(0,5).map((row)=>`<span>${escapeHTML(row.itemName||'未命名')}｜${escapeHTML(row.material||'')} ${escapeHTML(row.thicknessMm?`${row.thicknessMm}mm`:'')}｜${row.widthMm&&row.heightMm?`${roundDisplay(row.widthMm)}×${roundDisplay(row.heightMm)}mm｜`:''}${money(row.unitPrice)}</span>`).join('')}</div></details>`:''}
      </div>
      <div class="estimateDimensionSummary ${item.dimensionStatus==='待確認'?'warning':''}">
        <span><strong>繁中：</strong>${escapeHTML(item.normalizedName||item.name||'—')}</span>
        <span><strong>尺寸：</strong>${isLightStripItem(item)?(item.lightStripTotalLengthM?`${roundDisplay(item.lightStripTotalLengthM)} m（整列）`:'待確認長度'):(item.widthMm&&item.heightMm?`${roundDisplay(item.widthMm)} × ${roundDisplay(item.heightMm)} mm`:'待確認')}</span>
        <span><strong>級距：</strong>${escapeHTML(item.sizeTier||'待確認')}</span>
        ${isLightStripItem(item)?`<span><strong>單件長度：</strong>${roundDisplay(item.lightStripSingleLengthM||0)} m</span><span><strong>整列長度：</strong>${roundDisplay(item.lightStripTotalLengthM||0)} m</span>`:`<span><strong>精確才數：</strong>${roundDisplay(item.totalExactTsai||0)}</span><span><strong>整列建議計價才數：</strong>${roundDisplay(item.billingTsai||0)}</span>`}
        <span><strong>尺寸信心：</strong>${Math.round(toNumber(item.dimensionConfidence)||0)}%</span>
        <span><strong>加工判斷：</strong>${escapeHTML(processingDisplay)}</span>
        ${item.longStripWarning?`<span class="dimensionWarning">${escapeHTML(item.longStripWarning)}</span>`:''}
        ${thicknessFallbackWarning?`<span class="dimensionWarning">${escapeHTML(thicknessFallbackWarning)}</span>`:''}
      </div>

      <details class="estimateItemAdvanced">
        <summary>進階設定：公司價格、用量損耗、加工與印刷條件</summary>
        <div class="estimateAdvancedGrid">
          <section class="estimateFieldGroup">
            <h4>代碼與尺寸標準化</h4>
            <label><span>品項代碼</span><input class="tableInput" data-estimate-field="code" value="${escapeHTML(item.code)}" placeholder="品項代碼／檔名"></label>
            <label><span>原始品名</span><input class="tableInput" data-estimate-field="originalName" value="${escapeHTML(item.originalName)}" placeholder="保留簡體或來源原文"></label>
            <label><span>原始規格</span><input class="tableInput" data-estimate-field="originalSpec" value="${escapeHTML(item.originalSpec)}" placeholder="來源文件尺寸文字"></label>
            <div class="inlineFields">
              <label><span>寬 mm</span><input class="tableInput numberInput" data-estimate-field="widthMm" type="number" min="0" step="0.1" value="${item.widthMm||''}"></label>
              <label><span>高 mm</span><input class="tableInput numberInput" data-estimate-field="heightMm" type="number" min="0" step="0.1" value="${item.heightMm||''}"></label>
            </div>
            <div class="inlineFields">
              ${isLightStripItem(item)?`<label><span>單件長度 m</span><input class="tableInput numberInput" value="${roundDisplay(item.lightStripSingleLengthM||0)}" readonly></label><label><span>整列長度 m</span><input class="tableInput numberInput" data-estimate-field="usage" type="number" min="0" step="0.001" value="${roundDisplay(item.usage||item.lightStripTotalLengthM||0)}"></label>`:`<label><span>精確才數</span><input class="tableInput numberInput" value="${roundDisplay(item.totalExactTsai)}" readonly></label><label><span>整列計價才數</span><input class="tableInput numberInput" data-estimate-field="billingTsai" type="number" min="0" step="0.01" value="${roundDisplay(item.billingTsai)}"></label>`}
            </div>
            <label><span>尺寸級距</span><input class="tableInput" value="${escapeHTML(item.sizeTier||'待確認')}" readonly></label>
          </section>

          <section class="estimateFieldGroup">
            <h4>價格與用量</h4>
            <label><span>公司價格配對</span><select class="tableInput priceSelect" data-estimate-field="priceId">${priceOptions}</select></label>
            <div class="inlineFields">
              <label><span>整列計價用量</span><input class="tableInput numberInput" data-estimate-field="usage" type="number" min="0" step="0.0001" value="${roundDisplay(item.usage)}"></label>
              <label><span>材料損耗 %</span><input class="tableInput numberInput" data-estimate-field="wasteRate" type="number" min="0" max="100" step="0.1" value="${item.wasteRate}"></label>
            </div>
            <p class="fieldHint">計價用量為整列總用量，已包含數量；損耗只套用材料本體。</p>
          </section>

          <section class="estimateFieldGroup">
            <h4>加工分級與調整</h4>
            <label><span>舊版加工等級（選填）</span><select class="tableInput" data-estimate-field="processingLevel">${processingLevelOptions}</select></label>
            <p class="fieldHint">${escapeHTML(item.processingLevelReason||'系統會依外型、孔洞、印刷層次與尺寸自動判斷；可人工改成 L1～L4。')}</p>
            <div class="inlineFields">
              <label><span>市場調整 %</span><input class="tableInput numberInput" data-estimate-field="marketAdjustment" type="number" step="0.01" value="${item.marketAdjustment}"></label>
              <label><span>單件人工加工調整</span><input class="tableInput numberInput" data-estimate-field="processingFee" type="number" min="0" step="0.01" value="${item.processingFee}"></label>
            </div>
            <label><span>單件其他美術費用</span><input class="tableInput numberInput" data-estimate-field="otherFee" type="number" min="0" step="0.01" value="${item.otherFee}"></label>
            <p class="fieldHint">兩項皆為單件外加費，系統會自動乘以數量。</p>
          </section>

          <section class="estimateFieldGroup">
            <h4>印刷與降本條件</h4>
            <div class="checkRow">
              <label><input type="checkbox" data-estimate-field="allowMaterialOptimization" ${item.allowMaterialOptimization!=='否'?'checked':''}>允許材質優化</label>
              <label><input type="checkbox" data-estimate-field="allowPrintOptimization" ${item.allowPrintOptimization!=='否'?'checked':''}>允許印刷優化</label>
            </div>
            <label><span>印刷方式</span><input class="tableInput" data-estimate-field="printMethod" list="estimatePrintMethodOptions" value="${escapeHTML(item.printMethod)}" placeholder="從公司製程規則選擇"></label>
            <div class="inlineFields">
              <label><span>印刷面</span><input class="tableInput" data-estimate-field="printSide" list="estimatePrintSideOptions" value="${escapeHTML(item.printSide)}"></label>
              <label><span>白墨範圍</span><input class="tableInput" data-estimate-field="whiteInk" list="estimateWhiteInkOptions" value="${escapeHTML(item.whiteInk)}"></label>
            </div>
            <label><span>特殊效果</span><input class="tableInput" data-estimate-field="specialEffect" list="estimateSpecialEffectOptions" value="${escapeHTML(item.specialEffect)}"></label>
            <label><span>不可變更條件</span><input class="tableInput" data-estimate-field="constraints" value="${escapeHTML(item.constraints)}" placeholder="外觀、尺寸、孔位不得改"></label>
          </section>
        </div>
      </details>
    </article>`;
  }).join('');

  state.estimateDraftItems.forEach((item,index)=>{
    const select=$('estimateItemRows').querySelector(`[data-estimate-index="${index}"] select[data-estimate-field="priceId"]`);
    if(select)select.value=item.priceId||'';
  });
  updateEstimateTotals();
  updateEstimateQuickMetrics();
}

function updateEstimateQuickMetrics(){
  const items=state.estimateDraftItems||[];
  const matched=items.filter((item)=>item.priceId || item.manualPrice || toNumber(item.baseUnitPrice)>0).length;
  const missing=Math.max(0,items.length-matched);
  const missingProcess=items.filter((item)=>Array.isArray(item.missingProcessTags)&&item.missingProcessTags.length).length;
  if($('estimateItemCount'))$('estimateItemCount').textContent=String(items.length);
  if($('estimateMatchedCount'))$('estimateMatchedCount').textContent=String(matched);
  if($('estimateMissingCount'))$('estimateMissingCount').textContent=String(missing);
  if($('estimateMissingProcessCount'))$('estimateMissingProcessCount').textContent=String(missingProcess);
  if($('estimateMissingPrices'))$('estimateMissingPrices').disabled=missing===0;
}

function roundDisplay(value){const n=toNumber(value);return Math.round(n*10000)/10000;}
function estimateTotals(){
  const count=state.estimateDraftItems.length||1;
  const totals=state.estimateDraftItems.reduce((a,i)=>({
    optimistic:a.optimistic+roundCurrency(i.optimisticCost),
    baseline:a.baseline+roundCurrency(i.baselineCost),
    conservative:a.conservative+roundCurrency(i.conservativeCost),
    confidence:a.confidence+toNumber(i.confidenceScore)/count
  }),{optimistic:0,baseline:0,conservative:0,confidence:0});
  totals.optimistic=roundCurrency(totals.optimistic);
  totals.baseline=roundCurrency(totals.baseline);
  totals.conservative=roundCurrency(totals.conservative);
  return totals;
}

function handleEstimateItemInput(event){
  const row=event.target.closest('[data-estimate-index]'); if(!row)return;
  const index=Number(row.dataset.estimateIndex); const item=state.estimateDraftItems[index]; const field=event.target.dataset.estimateField; if(!item||!field)return;
  if(event.target.type==='checkbox') item[field]=event.target.checked?'是':'否';
  else if(['qty','widthMm','heightMm','billingTsai','usage','wasteRate','marketAdjustment','processingFee','otherFee','baseUnitPrice'].includes(field)) item[field]=toNumber(event.target.value);
  else item[field]=event.target.value;
  if(field==='usage') item.usageManuallySet=true;
  if(field==='billingTsai') item.billingTsaiManuallySet=true;
  if(field==='marketAdjustment') item.marketManuallySet=true;
  if(field==='wasteRate') item.wasteRateManuallySet=true;
  if(field==='processingLevel'){
    item.processingLevel=String(item.processingLevel||'AUTO').toUpperCase();
    item.processingLevelSource=item.processingLevel==='AUTO'?'規則自動判斷':'人工指定';
    item.processingLevelResolved='';
  }
  if(field==='baseUnitPrice'){
    item.manualPrice=toNumber(item.baseUnitPrice)>0;
    item.manualPriceConfidence=80;
    item.priceId='';
    item.priceManuallySelected=false;
    item.priceSource=item.manualPrice?'人工輸入單價':'';
    item.marketAdjustment=0;
    item.marketManuallySet=true;
  }
  if(field==='priceId'){
    const p=state.materialPrices.find((x)=>x.id===item.priceId);
    item.priceManuallySelected=Boolean(item.priceId);
    item.manualPrice=false;
    if(p){item.baseUnitPrice=p.basePrice;item.priceSource=[p.name,p.thickness,p.supplier,p.priceDate].filter(Boolean).join('｜');item.usageManuallySet=false;item.marketManuallySet=false;}
  }
  if(['name','material','thickness','spec','originalName','originalMaterial','originalSpec','widthMm','heightMm','qty'].includes(field)){
    if(['name','material','thickness','spec','originalName','originalMaterial','originalSpec'].includes(field)&&!item.priceManuallySelected){
      item.priceId='';
    }
    if(field==='name') item.normalizedName=standardizeErpText(item.name);
    if(field==='material') item.normalizedMaterial=standardizeErpText(item.material);
    if(field==='spec'){
      item.originalSpec=item.originalSpec||item.spec;
      item.dimensions=[];item.sizeTier='';item.dimensionStatus='';item.longStripWarning='';item.billingTsaiManuallySet=false;
    }
    if(['widthMm','heightMm'].includes(field)){
      item.sizeTier='';item.dimensionStatus='';item.longStripWarning='';item.billingTsaiManuallySet=false;
      item.dimensions=(toNumber(item.widthMm)>0&&toNumber(item.heightMm)>0)
        ? [{widthMm:toNumber(item.widthMm),heightMm:toNumber(item.heightMm),qty:1,unit:'mm',sourceText:'人工調整'}]
        : [];
    }
    if(field==='qty'){item.sizeTier='';item.dimensionStatus='';item.longStripWarning='';}
    applyEstimateDimensionNormalization(item);
  }
  recalculateEstimateItem(item);
  updateEstimateRowSummary(row,item);
  updateEstimateTotals();
  if(event.type==='change' && ['priceId','baseUnitPrice','material','thickness','spec','unit','originalName','originalSpec','widthMm','heightMm','billingTsai','processingLevel','printMethod','printSide','whiteInk','specialEffect','constraints'].includes(field)) renderEstimateDraft();
}

function updateEstimateRowSummary(row,item){
  const summary=row.querySelector('[data-estimate-cost-summary]');
  if(summary) summary.innerHTML=`<strong>${money(item.baselineCost)}</strong><br><small>信心 ${Math.round(item.confidenceScore)}%</small>`;
  const source=row.querySelector('[data-estimate-price-source]');
  if(source) source.textContent=item.priceSource||'尚未配對';
  const usage=row.querySelector('input[data-estimate-field="usage"]');
  if(usage && document.activeElement!==usage) usage.value=roundDisplay(item.usage);
  const market=row.querySelector('input[data-estimate-field="marketAdjustment"]');
  if(market && document.activeElement!==market) market.value=roundDisplay(item.marketAdjustment);
  const unitPrice=row.querySelector('input[data-estimate-field="baseUnitPrice"]');
  if(unitPrice && document.activeElement!==unitPrice) unitPrice.value=roundDisplay(item.baseUnitPrice);
}

function updateEstimateTotals(){
  const totals=estimateTotals();
  $('estimateOptimistic').textContent=money(totals.optimistic);
  $('estimateBaseline').textContent=money(totals.baseline);
  $('estimateConservative').textContent=money(totals.conservative);
  if($('estimateOptimisticCny'))$('estimateOptimisticCny').textContent=formatCnyFromTwd(totals.optimistic);
  if($('estimateBaselineCny'))$('estimateBaselineCny').textContent=formatCnyFromTwd(totals.baseline);
  if($('estimateConservativeCny'))$('estimateConservativeCny').textContent=formatCnyFromTwd(totals.conservative);
  $('estimateConfidence').textContent=`${Math.round(totals.confidence)}%`;
  $('estimateStatusBadge').textContent=state.currentEstimateId?`編輯 ${state.currentEstimateId}`:`草稿 ${state.estimateDraftItems.length} 筆`;
  updateEstimateQuickMetrics();
}
function handleEstimateItemClick(event){
  const emptyAdd=event.target.closest('[data-empty-add-estimate]');
  if(emptyAdd){state.estimateDraftItems.push(emptyEstimateItem());renderEstimateDraft();return;}
  const btn=event.target.closest('[data-remove-estimate]');
  if(!btn)return;
  state.estimateDraftItems.splice(Number(btn.dataset.removeEstimate),1);
  renderEstimateDraft();
}

function updateEstimateTargetMode(){
  const isExisting=$('estimateTargetType')?.value==='existing';
  if($('estimateMachineField')) $('estimateMachineField').hidden=!isExisting;
  if(!isExisting && $('estimateMachine')) $('estimateMachine').value='';
  if($('loadMachineActualItems')) $('loadMachineActualItems').hidden=!isExisting;
}

function parseDimensions(text){const groups=parseDimensionDetails(text,'mm');return groups.length?{widthMm:groups[0].widthMm,heightMm:groups[0].heightMm}:{widthMm:0,heightMm:0};}
function loadActualItemsIntoEstimate(){const machineId=$('estimateMachine').value;if(!machineId){showNotice('請先選擇機台。','warn');return;}const orderIds=state.costOrders.filter((o)=>o.machineId===machineId&&o.type==='實際費用').map((o)=>o.id);const items=state.costItems.filter((i)=>orderIds.includes(i.costOrderId)&&i.itemType!=='附加費用');if(!items.length){showNotice('這台機台尚無實際費用品項。','warn');return;}state.estimateDraftItems=items.map((i)=>{const d=parseDimensions(i.spec);return applyEstimateDimensionNormalization({...emptyEstimateItem(),code:i.fileName||'',originalName:i.name,normalizedName:standardizeErpText(i.name),name:standardizeErpText(i.name),originalMaterial:i.material,normalizedMaterial:standardizeErpText(i.material),material:standardizeErpText(i.material),originalSpec:i.spec,spec:standardizeErpText(i.spec),thickness:i.thickness,qty:i.qty||1,unit:i.unit||'件',widthMm:d.widthMm,heightMm:d.heightMm,baseUnitPrice:i.price,manualPrice:true,manualPriceConfidence:85,wasteRate:0,marketAdjustment:0,marketManuallySet:true,priceSource:'機台實際成本',confidenceScore:85});});const m=machineById(machineId);if(!$('estimateName').value)$('estimateName').value=`${m?.name||machineId} 美術材料估價`;renderEstimateDraft();showNotice(`已載入 ${items.length} 筆實際費用品項。`,'success');}

function resetEstimateEditor(){state.currentEstimateId='';state.estimateDraftItems=[];clearEstimateTextInput();$('estimateProjectForm').reset();$('estimateId').value='';$('estimateTargetType').value='new';$('estimateVersion').value='V1';$('estimateDate').value=todayValue();$('estimateStatus').value='草稿';clearEstimateSourceDocument();updateEstimateTargetMode();renderEstimateDraft();}
function loadEstimateProject(id){const project=state.estimateProjects.find((p)=>p.id===id);if(!project)return;state.currentEstimateId=id;$('estimateId').value=id;$('estimateTargetType').value=project.machineId?'existing':'new';$('estimateMachine').value=project.machineId;$('estimateName').value=project.name;$('estimateVersion').value=project.version;$('estimateDate').value=project.date;$('estimateStatus').value=project.status;$('estimateNote').value=project.note;state.estimateDraftItems=state.estimateItems.filter((i)=>i.estimateId===id).map((i)=>({...i,usageManuallySet:true,marketManuallySet:true}));updateEstimateTargetMode();renderEstimateDraft();document.querySelector('[data-view="smartEstimate"]')?.click();}

async function saveCurrentEstimate(){
  const name=$('estimateName').value.trim();
  if(!name){showNotice('請填寫估價名稱。','warn');return null;}
  const valid=state.estimateDraftItems.filter((i)=>i.name.trim());
  if(!valid.length){showNotice('至少需要一筆有品項名稱的估價明細。','warn');return null;}
  const button=$('saveEstimate');button.disabled=true;button.textContent='儲存中…';
  try{
    recalculateAllEstimateItems();
    const machineId=$('estimateTargetType').value==='existing'?$('estimateMachine').value:'';
    const response=await secureApiRequest({action:'saveEstimate',project:{id:state.currentEstimateId,machineId,name,version:$('estimateVersion').value.trim(),date:$('estimateDate').value,status:$('estimateStatus').value,note:$('estimateNote').value.trim()},items:valid},{timeoutMs:120000});
    const project=normalizeEstimateProject(response.result.project);
    state.estimateProjects=state.estimateProjects.filter((p)=>p.id!==project.id);state.estimateProjects.push(project);
    state.estimateItems=state.estimateItems.filter((i)=>i.estimateId!==project.id);state.estimateItems.push(...(response.result.items||[]).map(normalizeEstimateItem));
    state.currentEstimateId=project.id;$('estimateId').value=project.id;renderEstimateProjects();renderEstimateDraft();populateOptimizationEstimateOptions();showNotice('估價版本已儲存。','success');
    return project;
  }catch(error){showNotice(`估價儲存失敗：${error.message}`,'error');return null;}
  finally{button.disabled=false;button.textContent='儲存估價版本';}
}

async function saveEstimateAndOpenOptimization(){
  const button=$('saveEstimateAndOptimize');
  if(button){button.disabled=true;button.textContent='儲存中…';}
  const project=await saveCurrentEstimate();
  if(button){button.disabled=false;button.textContent='儲存並進行美術降本';}
  if(!project)return;
  $('optimizationSource').value='estimate';
  updateOptimizationSourceMode();
  populateOptimizationEstimateOptions();
  $('optimizationEstimate').value=project.id;
  renderSimulationViewOptions();
  document.querySelector('[data-view="artOptimization"]')?.click();
  $('optimizationStatus').textContent=`已載入估價「${project.name}」，可直接產生美術降本方案。`;
}

function renderEstimateProjects(){if(!$('estimateProjectRows'))return;const rows=[...state.estimateProjects].sort((a,b)=>dateValue(b.date||b.updatedAt)-dateValue(a.date||a.updatedAt));$('estimateProjectRows').innerHTML=rows.length?rows.map((p)=>`<tr><td>${escapeHTML(p.date||'—')}</td><td><strong>${escapeHTML(p.name)}</strong></td><td>${escapeHTML(machineById(p.machineId)?.name||(p.machineId?'未找到機台':'新機台／未建主檔'))}</td><td>${escapeHTML(p.version)}</td><td>${money(p.optimisticTotal)}</td><td><strong>${money(p.baselineTotal)}</strong></td><td>${money(p.conservativeTotal)}</td><td>${Math.round(p.confidence)}%</td><td>${escapeHTML(p.status)}</td><td><div class="rowActions"><button class="linkButton" data-load-estimate="${escapeHTML(p.id)}">載入</button><button class="linkButton" data-copy-estimate="${escapeHTML(p.id)}">複製</button><button class="linkButton dangerText" data-delete-estimate="${escapeHTML(p.id)}">刪除</button></div></td></tr>`).join(''):'<tr><td colspan="10" class="empty">尚未儲存估價。</td></tr>';}

async function handleEstimateProjectClick(event){const load=event.target.closest('[data-load-estimate]');if(load){loadEstimateProject(load.dataset.loadEstimate);return;}const copy=event.target.closest('[data-copy-estimate]');if(copy){loadEstimateProject(copy.dataset.copyEstimate);state.currentEstimateId='';$('estimateId').value='';$('estimateName').value += '（複製）';$('estimateVersion').value='V1';renderEstimateDraft();return;}const del=event.target.closest('[data-delete-estimate]');if(!del)return;const id=del.dataset.deleteEstimate;if(!confirm('確定刪除這個估價版本及其明細嗎？'))return;try{await secureApiRequest({action:'deleteEstimate',estimateId:id},{timeoutMs:60000});state.estimateProjects=state.estimateProjects.filter((p)=>p.id!==id);state.estimateItems=state.estimateItems.filter((i)=>i.estimateId!==id);state.artRecommendations=state.artRecommendations.filter((r)=>r.estimateId!==id);if(state.currentEstimateId===id)resetEstimateEditor();renderEstimateProjects();renderOptimizationHistory();populateOptimizationEstimateOptions();showNotice('估價版本已刪除。','success');}catch(e){showNotice(`刪除失敗：${e.message}`,'error');}}

function populateOptimizationEstimateOptions(){
  const select=$('optimizationEstimate');if(!select)return;
  const current=select.value;
  const projects=[...state.estimateProjects].sort((a,b)=>dateValue(b.date||b.updatedAt)-dateValue(a.date||a.updatedAt));
  select.innerHTML='<option value="">請選擇估價版本</option>'+projects.map((p)=>`<option value="${escapeHTML(p.id)}">${escapeHTML(p.name)}｜${escapeHTML(p.version)}${p.machineId?`｜${escapeHTML(machineById(p.machineId)?.name||p.machineId)}`:'｜新機台'}</option>`).join('');
  if([...select.options].some((o)=>o.value===current))select.value=current;
}

function updateOptimizationSourceMode(){
  const source=$('optimizationSource')?.value||'estimate';
  const fromEstimate=source==='estimate';
  if($('optimizationEstimateField')) $('optimizationEstimateField').hidden=!fromEstimate;
  if($('optimizationMachineField')) $('optimizationMachineField').hidden=fromEstimate;
  if(fromEstimate && $('optimizationMachine')) $('optimizationMachine').value='';
  if(!fromEstimate && $('optimizationEstimate')) $('optimizationEstimate').value='';
  populateOptimizationEstimateOptions();
  renderSimulationViewOptions();
  $('optimizationStatus').textContent=fromEstimate?'選擇智能估價案，可包含尚未建立機台主檔的新案。':'選擇既有機台，系統會分析實際費用品項。';
}

function selectedOptimizationProject(){return state.estimateProjects.find((p)=>p.id===($('optimizationEstimate')?.value||''))||null;}
function currentOptimizationMachineId(){return $('optimizationSource')?.value==='estimate'?(selectedOptimizationProject()?.machineId||''):($('optimizationMachine')?.value||'');}

async function generateOptimizationFromForm(event){
  event.preventDefault();
  const source=$('optimizationSource').value;
  const estimateId=source==='estimate'?$('optimizationEstimate').value:'';
  const machineId=source==='actual'?$('optimizationMachine').value:(selectedOptimizationProject()?.machineId||'');
  if(source==='estimate'&&!estimateId){showNotice('請先選擇估價版本。','warn');return;}
  if(source==='actual'&&!machineId){showNotice('請先選擇既有機台。','warn');return;}
  const btn=$('generateOptimization');btn.disabled=true;btn.textContent='AI 分析中…';$('optimizationStatus').textContent='正在分析材質、印刷方式、白墨、特殊效果與併版機會…';
  try{
    const response=await secureApiRequest({action:'generateArtOptimization',input:{machineId,estimateId,targetPercent:toNumber($('optimizationTarget').value),level:$('optimizationLevel').value,constraints:$('optimizationConstraints').value}},{timeoutMs:150000});
    state.currentOptimization=response.result;const recs=(response.result.recommendations||[]).map(normalizeArtRecommendation);state.artRecommendations.push(...recs);renderCurrentOptimization();renderOptimizationHistory();renderSimulationViewOptions();$('optimizationStatus').textContent='分析完成；所有建議仍需美術打樣確認。';showNotice('AI 美術降本分析完成。','success');
  }catch(e){$('optimizationStatus').textContent=`分析失敗：${e.message}`;showNotice(`降本分析失敗：${e.message}`,'error');}
  finally{btn.disabled=false;btn.textContent='AI 產生降本方案';}
}

function renderCurrentOptimization(){const box=$('optimizationRecommendations');const data=state.currentOptimization;if(!data){box.innerHTML='<div class="empty">尚未產生建議。</div>';$('optimizationSummary').textContent='尚未分析。';return;}const recs=(data.recommendations||[]).map((r)=>r.id?r:normalizeArtRecommendation(r));$('optimizationSummary').textContent=`${data.summary||''}｜預估節省 ${money(data.estimatedSavingLow)}～${money(data.estimatedSavingHigh)}`;box.innerHTML=recs.map(recommendationCardHtml).join('');$('generateSimulation').disabled=!recs.length;}

function recommendationCardHtml(r){return `<article class="recommendationCard" data-recommendation-card="${escapeHTML(r.id)}"><div><h3>${escapeHTML(r.itemName||'整體美術件')}</h3><div class="recommendationMeta"><span class="tag">${escapeHTML(r.type)}</span><span class="statusPill">信心 ${escapeHTML(r.confidence)}</span><span class="statusPill">外觀影響 ${escapeHTML(r.appearanceImpact)}</span></div></div><div class="recommendationCost"><div><span>原始成本</span><strong>${money(r.originalCost)}</strong></div><div><span>優化區間</span><strong>${money(r.optimizedLow)}～${money(r.optimizedHigh)}</strong></div><div><span>預估節省</span><strong>${money(r.savingLow)}～${money(r.savingHigh)}</strong></div></div><dl><dt>原始方案</dt><dd>${escapeHTML(r.originalPlan)}</dd><dt>優化方案</dt><dd>${escapeHTML(r.optimizedPlan)}</dd><dt>依據</dt><dd>${escapeHTML(r.evidence)}</dd><dt>色彩風險</dt><dd>${escapeHTML(r.colorRisk||'需打樣確認')}</dd><dt>耐候風險</dt><dd>${escapeHTML(r.weatherRisk||'需材料確認')}</dd><dt>打樣需求</dt><dd>${escapeHTML(r.sampleRequired)}</dd></dl><div class="recommendationActions"><button class="button ghost" data-rec-status="送美術打樣" data-rec-id="${escapeHTML(r.id)}">送美術打樣</button><button class="button ghost" data-rec-status="送採購詢價" data-rec-id="${escapeHTML(r.id)}">送採購詢價</button><button class="button secondary" data-rec-status="接受建議" data-rec-id="${escapeHTML(r.id)}">接受</button><button class="button ghost dangerButton" data-rec-status="忽略" data-rec-id="${escapeHTML(r.id)}">忽略</button></div></article>`;}

async function handleOptimizationRecommendationClick(event){const btn=event.target.closest('[data-rec-status]');if(!btn)return;await updateRecommendationStatus(btn.dataset.recId,btn.dataset.recStatus);}
async function handleOptimizationHistoryClick(event){const btn=event.target.closest('[data-rec-status]');if(!btn)return;await updateRecommendationStatus(btn.dataset.recId,btn.dataset.recStatus);}
async function updateRecommendationStatus(id,status){try{await secureApiRequest({action:'updateRecommendationStatus',id,status});const rec=state.artRecommendations.find((r)=>r.id===id);if(rec)rec.status=status;renderOptimizationHistory();if(state.currentOptimization){const r=(state.currentOptimization.recommendations||[]).find((x)=>x.id===id);if(r)r.status=status;}showNotice(`建議狀態已更新為「${status}」。`,'success');}catch(e){showNotice(`狀態更新失敗：${e.message}`,'error');}}

function renderOptimizationHistory(){if(!$('optimizationHistoryRows'))return;const rows=[...state.artRecommendations].sort((a,b)=>dateValue(b.createdAt)-dateValue(a.createdAt));$('optimizationHistoryRows').innerHTML=rows.length?rows.map((r)=>`<tr><td>${escapeHTML(machineById(r.machineId)?.name||state.estimateProjects.find((p)=>p.id===r.estimateId)?.name||r.machineId||'新機台估價')}</td><td>${escapeHTML(r.itemName||'—')}</td><td>${escapeHTML(r.type)}</td><td>${money(r.originalCost)}</td><td>${money(r.optimizedLow)}～${money(r.optimizedHigh)}</td><td>${money(r.savingLow)}～${money(r.savingHigh)}</td><td>${escapeHTML(r.confidence)}</td><td><span class="statusPill ${statusClass(r.status)}">${escapeHTML(r.status)}</span></td><td><select class="tableInput" data-rec-status data-rec-id="${escapeHTML(r.id)}"><option value="">更新狀態</option><option>接受建議</option><option>送美術打樣</option><option>送採購詢價</option><option>忽略</option></select></td></tr>`).join(''):'<tr><td colspan="9" class="empty">尚無降本建議。</td></tr>';$('optimizationHistoryRows').querySelectorAll('select[data-rec-status]').forEach((select)=>select.addEventListener('change',()=>{if(select.value)updateRecommendationStatus(select.dataset.recId,select.value);}));}

function renderSimulationViewOptions(){const select=$('simulationView');if(!select)return;const machineId=currentOptimizationMachineId();const views=state.machine360Views.filter((v)=>v.machineId===machineId);const machine=machineById(machineId);select.innerHTML=views.length?views.map((v)=>`<option value="${escapeHTML(v.viewKey)}">${escapeHTML(v.viewName)}</option>`).join(''):(machine?.imageFileId?'<option value="MACHINE">機台代表圖</option>':'<option value="">尚無基準圖</option>');renderSimulationPreview();}

function currentSimulation(){const machineId=currentOptimizationMachineId();const viewKey=$('simulationView')?.value||'';return [...state.artSimulations].filter((s)=>s.machineId===machineId&&(!viewKey||s.viewKey===viewKey||viewKey==='MACHINE')).sort((a,b)=>dateValue(b.createdAt)-dateValue(a.createdAt))[0]||null;}
function sourceViewFileId(){const machineId=currentOptimizationMachineId();const viewKey=$('simulationView')?.value||'';const view=state.machine360Views.find((v)=>v.machineId===machineId&&v.viewKey===viewKey);return view?.imageFileId||machineById(machineId)?.imageFileId||'';}
async function renderSimulationPreview(){const box=$('simulationPreview');if(!box)return;const simulation=currentSimulation();const sourceId=sourceViewFileId();if(!sourceId&&!simulation){box.className='simulationPreview empty';box.textContent='這台機台尚無可用圖片。';return;}box.className='simulationPreview';box.innerHTML=`<div class="simulationCompare"><figure>${sourceId?`<img data-secure-file-id="${escapeHTML(sourceId)}" alt="原始機台">`:'<div class="empty">無原圖</div>'}<figcaption>原始</figcaption></figure><figure>${simulation?.imageFileId?`<img data-secure-file-id="${escapeHTML(simulation.imageFileId)}" alt="AI 美術降本模擬">`:'<div class="empty">尚未生成</div>'}<figcaption>AI 美術概念模擬</figcaption></figure></div>`;hydrateSecureImages(box);}

async function generateCurrentSimulation(){const machineId=currentOptimizationMachineId();if(!machineId){showNotice('此估價尚未綁定機台或圖片，無法產生視覺模擬；數字降本分析仍可使用。','warn');return;}const recs=(state.currentOptimization?.recommendations||[]).map((r)=>r.id).filter(Boolean);if(!recs.length){showNotice('請先產生降本建議。','warn');return;}const btn=$('generateSimulation');btn.disabled=true;btn.textContent='生成中…';try{const response=await secureApiRequest({action:'generateArtSimulation',input:{machineId,estimateId:$('optimizationEstimate').value,viewKey:$('simulationView').value,recommendationIds:recs}},{timeoutMs:180000});const simulation=normalizeArtSimulation(response.result.simulation);state.artSimulations.push(simulation);await renderSimulationPreview();showNotice('AI 美術概念模擬已產生並保存到私人 Drive。','success');}catch(e){showNotice(`概念圖生成失敗：${e.message}`,'error');}finally{btn.disabled=false;btn.textContent='產生目前方案概念圖';}}

function confidenceClass(value){return value==='高'?'confidenceHigh':value==='低'?'confidenceLow':'confidenceMedium';}
function statusClass(value){if(value==='接受建議')return'accepted';if(value==='送美術打樣'||value==='送採購詢價')return'review';if(value==='忽略')return'ignored';return'';}
