# TAIDE-Botrun 專案 Claude 指令

## 地雷經驗記憶

### WebFetch 大型 PDF 檔案限制
- 參考時機：使用 WebFetch 抓取 PDF 檔案時、看到 "maxContentLength size exceeded" 錯誤時、規劃批次抓取教育資源時、建立資料收集流程時
- 文件位置：/Users/40gpu/coding_projects/taide-botrun/docs/地雷-WebFetch大型PDF檔案限制.txt
- 核心要點：
  - WebFetch 工具有 10 MB 檔案大小限制
  - 大型 PDF（如學測解析）需使用 curl/wget 下載後再用 Read 工具處理
  - 建立錯誤處理機制，WebFetch 失敗時自動切換下載方案

### WebFetch SSL 憑證與大小計算問題
- 參考時機：使用 WebFetch 抓取網頁時、看到 "unable to verify the first certificate" 或 "sizeCalculation return invalid" 錯誤時、批次抓取教育網站資料時、網頁包含圖片重要資訊時
- 文件位置：/Users/40gpu/coding_projects/taide-botrun/docs/地雷-WebFetch-SSL-憑證與大小計算問題.txt
- 核心要點：
  - 某些網站 SSL 憑證配置不完整會導致抓取失敗
  - 網頁內容過大或結構複雜可能觸發大小計算錯誤
  - 重要內容若以圖片呈現無法直接提取，需查閱官方文件或其他來源
  - 建議平行抓取多個來源，標記狀態（success/failed/partial），交叉驗證資料

### WebFetch 網站防爬蟲限制（403 Forbidden）
- 參考時機：使用 WebFetch 抓取網頁時、看到 403 Forbidden 錯誤時、抓取 Medium 等付費平台內容時、規劃批次網頁抓取策略時
- 文件位置：/Users/40gpu/coding_projects/taide-botrun/docs/地雷-WebFetch網站防爬蟲限制.txt
- 核心要點：
  - Medium 等網站有防爬蟲機制會回傳 403 Forbidden，WebFetch 無法處理
  - 優先使用 MCP web fetch 工具（較少限制），次選 curl/wget 加 User-Agent，最後手動處理
  - 規劃階段需評估網站爬蟲友善度，準備多種資料收集方法
  - 本次任務成功率 77.8%（7/9），需建立「待手動處理」清單處理特殊案例

### 網頁資料抓取限制（反爬蟲、版權保護、工具限制）
- 參考時機：使用 WebFetch 抓取 Wikipedia 時、抓取電子書平台內容時、看到 403 錯誤時、需要大量結構化資料時、規劃知識體系資料收集時
- 文件位置：/Users/40gpu/coding_projects/taide-botrun/docs/地雷-網頁資料抓取限制.txt
- 核心要點：
  - Wikipedia 因反爬蟲機制會回傳 403 錯誤，應使用官方 API（action=query&prop=extracts）
  - 電子書平台因版權保護僅能抓取平台資訊，需遵守使用限制
  - WebFetch 設定具體 prompt 可改善提取效果（明確要求欄位、結構化呈現）
  - 無法抓取時仍記錄失敗狀態於 JSONL，方便後續手動處理
  - 本次知識體系抓取成功率 91.7%（11/12），Wikipedia 失敗但其他台灣官方資源順利完成

### 答案解析資料抓取圖片內容處理
- 參考時機：抓取教育資源（試題、解析、課綱）時、目標網站以圖片發布版權內容時、需要結構化資料但來源為圖片時、規劃大規模資料收集流程時
- 文件位置：/Users/40gpu/coding_projects/taide-botrun/docs/地雷-答案解析資料抓取圖片內容處理.txt
- 核心要點：
  - 多數教育網站（大學問、聯合新聞網）將詳細解析以圖片形式呈現，WebFetch無法直接提取文字
  - 標記為 status: "partial"，在 notes 記錄圖片數量與格式
  - 優先抓取官方PDF檔案（如大考中心）或提供文字版解析的網站
  - 明確區分success（文字）、partial（圖片）、failed（無法抓取）
  - 本次9個資源100%完成，但僅33%提供結構化文字（3/9）

### 目錄路徑與中文編碼問題
- 參考時機：在專案中建立新目錄前、使用 curl/wget 下載檔案到中文路徑時、遇到 "No such file or directory" 且路徑顯示亂碼時、批次處理檔案前需要確認目錄結構時
- 文件位置：/Users/40gpu/coding_projects/taide-botrun/docs/地雷-目錄路徑與中文編碼問題.txt
- 核心要點：
  - 專案中可能存在名稱相似的多個目錄（如 step-002-抓取原始資料 vs step-002-資料抓取），任務前需用 ls/find 確認
  - curl 無法處理路徑中的中文字元，macOS 終端機會顯示編碼錯誤，需使用英文檔名
  - 發現目錄錯誤後用 mv 移動檔案，用 git status 確認檔案位置正確
  - 檔案命名優先使用英文、數字、連字號、底線，避免空格和特殊字元
