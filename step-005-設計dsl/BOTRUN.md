. 基於測試報告
    2. 平行測試所有模型...

    === 測試模型: Gemma 3 12B IT ===
    模型 ID: google/gemma-3-12b-it
    平行測試 5 題...


    === 測試模型: Gemini 3 Pro Preview ===
    模型 ID: google/gemini-3-pro-preview
    平行測試 5 題...

    [1] CH-001: ✗ 錯誤 | 答案: B (正確: C) | 0.97s
    [2] CH-003: ✗ 錯誤 | 答案: C (正確: D) | 0.92s
    [3] LK-001: ✓ 正確 | 答案: C (正確: C) | 0.76s
    [4] LK-002: ✗ 錯誤 | 答案: A (正確: C) | 0.92s
    [5] LK-003: ✓ 正確 | 答案: C (正確: C) | 0.62s

    統計: 2/5 正確 | 總耗時: 8.36s
    已儲存: /Users/40gpu/coding_projects/taide-botrun/step-004-抽取5提問來訓練/reports/result-google_g
    emma-3-12b-it.json
    [1] CH-001: ✓ 正確 | 答案: C (正確: C) | 4.22s
    [2] CH-003: ✓ 正確 | 答案: D (正確: D) | 4.69s
    [3] LK-001: ✗ 錯誤 | 答案: A (正確: C) | 5.04s
    [4] LK-002: ✗ 錯誤 | 答案: A (正確: C) | 4.54s
    [5] LK-003: ✓ 正確 | 答案: C (正確: C) | 4.84s

    統計: 3/5 正確 | 總耗時: 116.67s
    已儲存: /Users/40gpu/coding_projects/taide-botrun/step-004-抽取5提問來訓練/reports/result-google_g
    emini-3-pro-preview.json

    3. 生成測試報告...
    已儲存:
    /Users/40gpu/coding_projects/taide-botrun/step-004-抽取5提問來訓練/reports/baseline-report.md
    已儲存:
    /Users/40gpu/coding_projects/taide-botrun/step-004-抽取5提問來訓練/reports/baseline-summary.json

. 請你幫我設計 dsl/ddd jsonl 格式
. 我希望你給我三種替代方案打分 1 to 10 
. 必須是簡單但是高效能未來可以作為通用性規則庫
. 未來可以作爲通用性推理庫
. 未來可以作為擴充知識的知識庫或者知識圖譜庫
. 不管題目怎麼變化，只要某個方面的高中國文的知識納入 jsonl 大模型就應該要有高水準能力答對
. jsonl 裡面不能直接講答案，不能死背題目對應的答案，因為要泛化
. 三種替代方案幫我選最高分的 dsl/ddd jsonl 格式來製作
. 放在本目錄適當的位置 folder design and path design 要大模型友善好懂
. 你可以是多節點多步驟解題
. 你可以是拆解母問題之後多個子問題解題最後合併
. 你可以是有一個很好的資料庫有各種類似的資料解題
. 你的母知識之一可以是教育百科資料庫（臺灣的），因為他有所有的國文詞條
. 你的母知識之一可以是先爬取相關的東西回來變成 jsonl 這樣也可以
. 我希望你用技能集的方式來製作，所以請上網查詢 claude code skills, and
claude code skills scripts
. 我希望你最終可以搭配腳本 .mjs 來提高他的精準度
. 我希望你善用符號推理的能力 DN-PDF: droolers neo4j prolog DMN flowable
五種符號推理表示法來設計 dsl/ddd jsonl 以及將來轉化為 .mjs 程式碼去消化吸收
jsonl
. 你可以弄三種替代方案 jsonl and .mjs and SKILL.md 或者 SOURCE.md 抓網路知識來源引證
. 三種替代方案打分 1 to 10 
. 這三種技能集與腳本的設計一定有一種是最佳的
. 必須吻合 bdd tdd solid dry 原則
. 將來的用途必須可以解題高中學測
. 將來的用途必須可以解釋與教學所有的題目背後的原因原理推理推論，可解釋
. 所有的設計都必須輸出為檔案
. 所有的東西都要測試驗證，所以請你設計好之後先用 openrouter api google/gemma-3-12b-it 迭代
. 理論上 SKILL.md , dsl jsonl , .mjs , SOURCE.md 以及抓回來的相關知識檔案與網址引證等等應該能滿分
. .mjs 就是驅動 openrouter api google/gemma-3-12b-it
搭配適當組合的上下文工程（上網查這是什麼）就要能解題與解釋
. 我猜 system prompt 的組合會非常講究才能解題泛化而且正確

[[知識檢索]]
. 我希望你的知識檢索可以善用 rg -C 適當的參數
. 然後我希望可以平行多組的檢索，速度超快
. 然後多組關鍵字也可以避免遺漏，你用這種方式設計三種替代方案 score 1 to 10 選最高分的實作 


