# IGS 機台材料成本 ERP 前端 v1

## 已完成
- IGS 品牌與側邊欄
- Dashboard
- 機台搜尋與分類篩選
- 機台詳細資料視窗
- 打樣版／測試台／實際費用分頁
- 成本紀錄頁
- 每台機台個別成本總覽
- 估價單圖片預覽與材料草稿表
- 快速建立機台表單
- 供應商頁
- 串接既有 `getMachines`、`getSettings` API

## 目前限制
現有 Apps Script 只有 `getMachines` 與 `getSettings`，因此以下 API 尚待下一步建立：
- `getCostOrders`
- `getCostItems`
- `getSuppliers`
- 建立機台
- 建立成本單與成本明細
- 圖片上傳
- 密碼登入
- AI 估價單辨識

## 使用方式
將 `index.html`、`style.css`、`app.js`、`data.js` 放在同一個 GitHub Repository 根目錄，開啟 GitHub Pages。

正式上線前，必須先完成 Apps Script 登入保護與寫入 API。
