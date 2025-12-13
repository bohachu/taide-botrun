# TAIDE-Botrun 專案 Claude 指令

## 地雷經驗記憶

### WebFetch 大型 PDF 檔案限制
- 參考時機：使用 WebFetch 抓取 PDF 檔案時、看到 "maxContentLength size exceeded" 錯誤時、規劃批次抓取教育資源時、建立資料收集流程時
- 文件位置：/Users/40gpu/coding_projects/taide-botrun/docs/地雷-WebFetch大型PDF檔案限制.txt
- 核心要點：
  - WebFetch 工具有 10 MB 檔案大小限制
  - 大型 PDF（如學測解析）需使用 curl/wget 下載後再用 Read 工具處理
  - 建立錯誤處理機制，WebFetch 失敗時自動切換下載方案
