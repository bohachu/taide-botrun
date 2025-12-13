#!/usr/bin/env node
/**
 * 合併所有 JSONL 題目檔案
 */

import { readdir, readFile, writeFile } from 'fs/promises';
import { join
 } from 'path';

const QUESTIONS_DIR = '/Users/40gpu/coding_projects/taide-botrun/step-003-生成提問/questions';
const OUTPUT_FILE = '/Users/40gpu/coding_projects/taide-botrun/step-003-生成提問/all-questions.jsonl';
const REPORT_FILE = '/Users/40gpu/coding_projects/taide-botrun/step-003-生成提問/generation-report.md';

const categoryNames = {
  PH: '字音辨識',
  CH: '字形辨識',
  VO: '詞語運用',
  CL: '文言文理解',
  MR: '白話文閱讀',
  AN: '文意分析',
  CO: '文句重組',
  LK: '國學常識',
  CR: '跨領域閱讀',
  C15: '108課綱15篇古文',
  TW: '台灣文學',
  AP: '應用文寫作',
  RH: '修辭手法',
  CU: '文化議題',
  EX: '經典詮釋',
  LO: '語文邏輯'
};

async function main() {
  console.log('開始合併 JSONL 檔案...');

  const allLines = [];
  const stats = {};

  // 讀取所有類別
  const categories = await readdir(QUESTIONS_DIR);

  for (const category of categories.sort()) {
    const categoryPath = join(QUESTIONS_DIR, category);

    try {
      const files = await readdir(categoryPath);
      const jsonlFiles = files.filter(f => f.endsWith('.jsonl')).sort();

      stats[category] = jsonlFiles.length;

      for (const file of jsonlFiles) {
        const content = await readFile(join(categoryPath, file), 'utf-8');
        const firstLine = content.split('\n')[0].trim();
        if (firstLine) {
          allLines.push(firstLine);
        }
      }

      console.log(`${category}: ${jsonlFiles.length} 題`);
    } catch (err) {
      // 忽略非目錄
    }
  }

  // 寫入合併檔案
  await writeFile(OUTPUT_FILE, allLines.join('\n') + '\n', 'utf-8');

  console.log('');
  console.log('=========================================');
  console.log(`合併完成！總計: ${allLines.length} 題`);
  console.log(`輸出: ${OUTPUT_FILE}`);
  console.log('=========================================');

  // 生成報告
  const now = new Date().toLocaleString('zh-TW', { timeZone: 'Asia/Taipei' });

  let report = `# 高中國文學測訓練題目生成報告

## 生成時間
${now}

## 題目統計

| 類別代碼 | 類別名稱 | 題數 |
|---------|---------|------|
`;

  for (const [code, count] of Object.entries(stats).sort()) {
    const name = categoryNames[code] || '未知';
    report += `| ${code} | ${name} | ${count} |\n`;
  }

  report += `
## 總計
- **總題數**: ${allLines.length} 題
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
`;

  await writeFile(REPORT_FILE, report, 'utf-8');
  console.log(`報告已生成: ${REPORT_FILE}`);
}

main().catch(console.error);
