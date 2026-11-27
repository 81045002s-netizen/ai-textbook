# AI 教科書網站（第一單元：干涉與繞射）

依《03_網站架構/AI教科書網站架構_專案報告.docx》實作。原始檔一律未修改。

## 文件
- [docs/AI教科書網站架構_專案報告.docx](docs/AI教科書網站架構_專案報告.docx)：網站架構與決策（本網站依此實作）。
- [docs/干涉與繞射_教材文本_原文照錄版_v2.docx](docs/干涉與繞射_教材文本_原文照錄版_v2.docx)：教材文本正式版；網站各節「教材文本」區塊即照錄此檔（內容檔 `units/interference-diffraction/text.yaml`）。

## 開啟
- 學生版：`dist/student/index.html`（可公開，不含答案、規準、教師指引）
- 教師版：`dist/teacher/index.html`（請勿公開；含答案、三級規準、迷思速查、教案、雙向細目表、投影模式、匯入批改）
兩者都是單一 HTML 檔，雙擊即可在瀏覽器開啟，也可放到 GitHub Pages。

## 資料夾
- `units/interference-diffraction/`：單元內容檔（YAML），全部文字照 01–10 與教材文本 v2 原文。`teacher:` 底下的欄位只輸出到教師版。
- `site-src/`：網站程式（app.js、style.css）。
- `tools/build.py`：從內容檔輸出 dist/ 兩份網站。
- `tools/verify_sources.py`：逐字比對每段文字都能在原始 docx 找到（目前 873 段，全部吻合）。

修改內容後執行：`python3 tools/verify_sources.py && python3 tools/build.py`（需 PyYAML、python-docx）。
新增單元：在 `units/` 下照同樣結構新增一個資料夾。

## 待補（網站上以「待補」標示）
- 前測、三節隨堂測驗、後測的實際題目（06 只有藍圖；網站已依藍圖建題號與標籤，並自動產生雙向細目表）。
- 第1、3節學習單完整題目（03 只示範第2節；目前用 02 教案的題號與任務佔位，可作答）。
- 本教材自製的圖片與 4 個模擬 HTML（依 07A 清單佔位）。開放授權照片連到 Wikimedia Commons 原圖並標作者與授權，離線時顯示佔位卡。
- 10 中「位移等於振幅」「模型當成實拍」兩項的 L1–L3 提示。
- 教材文本「腹線、節線命名」「水波與光的比較」兩段（01 沒有對應原文）。

## 其他說明
- 「可調脈衝高度的疊加模擬」依 07B 需求腳本實作（第1節），會記錄播放、暫停、切換案例等操作。
- AI 追問：預留 `window.TextbookAI = { ask(context) → Promise<string> }` 接口，接上後第2節 Q4 的「請AI追問」按鈕即可使用；紀錄格式與固定提示相同。
- 作答紀錄格式 `tb-record/1`：學生代碼、節次、各題初稿與修訂稿、作圖、修訂理由、操作紀錄、提示歷程、轉教師標記、時間、教材版本（依 08）。
