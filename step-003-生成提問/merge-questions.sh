#!/bin/bash
# 合併所有題目 JSONL 檔案為單一檔案
# 用法: ./merge-questions.sh

OUTPUT_DIR="/Users/40gpu/coding_projects/taide-botrun/step-003-生成提問"
QUESTIONS_DIR="${OUTPUT_DIR}/questions"
OUTPUT_FILE="${OUTPUT_DIR}/all-questions.jsonl"

echo "開始合併 JSONL 檔案..."
echo "來源目錄: ${QUESTIONS_DIR}"
echo "輸出檔案: ${OUTPUT_FILE}"

# 清空或建立輸出檔案
> "${OUTPUT_FILE}"

# 統計各類別題目數量
declare -A CATEGORY_COUNT

# 遍歷所有子目錄
for category_dir in "${QUESTIONS_DIR}"/*/; do
    if [ -d "$category_dir" ]; then
        category=$(basename "$category_dir")
        count=0

        # 遍歷目錄中的所有 .jsonl 檔案
        for jsonl_file in "$category_dir"*.jsonl; do
            if [ -f "$jsonl_file" ]; then
                # 驗證 JSON 格式
                if python3 -c "import json; json.load(open('$jsonl_file'))" 2>/dev/null; then
                    cat "$jsonl_file" >> "${OUTPUT_FILE}"
                    echo "" >> "${OUTPUT_FILE}"  # 確保換行
                    ((count++))
                else
                    echo "警告: ${jsonl_file} JSON 格式錯誤，已跳過"
                fi
            fi
        done

        CATEGORY_COUNT[$category]=$count
        echo "類別 ${category}: ${count} 題"
    fi
done

# 計算總數
total=$(wc -l < "${OUTPUT_FILE}" | tr -d ' ')
echo ""
echo "========================================="
echo "合併完成！"
echo "總計: ${total} 題"
echo "輸出: ${OUTPUT_FILE}"
echo "========================================="

# 產生統計報告
REPORT_FILE="${OUTPUT_DIR}/generation-report.md"
cat > "${REPORT_FILE}" << EOF
# 高中國文學測訓練題目生成報告

## 生成時間
$(date '+%Y-%m-%d %H:%M:%S')

## 題目統計

| 類別代碼 | 類別名稱 | 題數 |
|---------|---------|------|
EOF

for category in "${!CATEGORY_COUNT[@]}"; do
    case $category in
        PH) name="字音辨識" ;;
        CH) name="字形辨識" ;;
        VO) name="詞語運用" ;;
        CL) name="文言文理解" ;;
        MR) name="白話文閱讀" ;;
        AN) name="文意分析" ;;
        CO) name="文句重組" ;;
        LK) name="國學常識" ;;
        CR) name="跨領域閱讀" ;;
        C15) name="108課綱15篇古文" ;;
        TW) name="台灣文學" ;;
        AP) name="應用文寫作" ;;
        RH) name="修辭手法" ;;
        CU) name="文化議題" ;;
        EX) name="經典詮釋" ;;
        LO) name="語文邏輯" ;;
        *) name="未知類別" ;;
    esac
    echo "| ${category} | ${name} | ${CATEGORY_COUNT[$category]} |" >> "${REPORT_FILE}"
done

cat >> "${REPORT_FILE}" << EOF

## 總計
- **總題數**: ${total} 題
- **輸出檔案**: all-questions.jsonl

## 檔案格式
每題包含以下欄位：
- id: 題目唯一識別碼
- category: 題目分類
- source: 題目來源
- difficulty: 難度與鑑別度
- question: 題幹與選項
- answer: 正確答案
- reasoning: 逐步推理過程
- traps: 陷阱與易錯點分析
- learning: 學習回饋設計
- verification: 答案驗證紀錄
- metadata: 元資料
EOF

echo "報告已生成: ${REPORT_FILE}"
