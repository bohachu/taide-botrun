#!/usr/bin/env node
/**
 * JSONL 診斷腳本
 * 分析題目檔案格式、統計、找出問題
 */

import { readdir, readFile, stat } from 'fs/promises';
import { join, basename } from 'path';

const QUESTIONS_DIR = '/Users/40gpu/coding_projects/taide-botrun/step-003-生成提問/questions';

// 統計結果
const stats = {
  totalFiles: 0,
  validJson: 0,
  invalidJson: 0,
  emptyFiles: 0,
  multiLineFiles: 0,
  categories: {}
};

// 問題檔案清單
const problems = [];

async function analyzeFile(filePath) {
  try {
    const content = await readFile(filePath, 'utf-8');
    const fileName = basename(filePath);

    // 檢查空檔案
    if (!content.trim()) {
      problems.push({ file: fileName, issue: '空檔案' });
      stats.emptyFiles++;
      return { valid: false, reason: 'empty' };
    }

    // 計算行數
    const lines = content.split('\n').filter(l => l.trim());
    if (lines.length > 1) {
      problems.push({ file: fileName, issue: `多行檔案 (${lines.length} 行)` });
      stats.multiLineFiles++;
    }

    // 嘗試解析 JSON
    try {
      const json = JSON.parse(lines[0]);

      // 驗證必要欄位
      const requiredFields = ['id', 'category', 'question', 'answer', 'reasoning'];
      const missingFields = requiredFields.filter(f => !json[f]);

      if (missingFields.length > 0) {
        problems.push({
          file: fileName,
          issue: `缺少欄位: ${missingFields.join(', ')}`
        });
      }

      return {
        valid: true,
        id: json.id,
        category: json.category?.main,
        subCategory: json.category?.sub,
        hasTraps: !!json.traps,
        hasLearning: !!json.learning,
        hasVerification: !!json.verification
      };

    } catch (parseError) {
      problems.push({
        file: fileName,
        issue: `JSON 解析錯誤: ${parseError.message.substring(0, 100)}`
      });
      stats.invalidJson++;
      return { valid: false, reason: 'parse_error', error: parseError.message };
    }

  } catch (readError) {
    problems.push({ file: basename(filePath), issue: `讀取錯誤: ${readError.message}` });
    return { valid: false, reason: 'read_error' };
  }
}

async function analyzeCategory(categoryPath, categoryName) {
  const categoryStats = {
    total: 0,
    valid: 0,
    invalid: 0,
    ids: []
  };

  try {
    const files = await readdir(categoryPath);
    const jsonlFiles = files.filter(f => f.endsWith('.jsonl'));

    for (const file of jsonlFiles) {
      const filePath = join(categoryPath, file);
      const result = await analyzeFile(filePath);

      categoryStats.total++;
      stats.totalFiles++;

      if (result.valid) {
        categoryStats.valid++;
        stats.validJson++;
        categoryStats.ids.push(result.id);
      } else {
        categoryStats.invalid++;
      }
    }

    // 檢查 ID 連續性
    const expectedIds = categoryStats.ids.map(id => {
      const num = parseInt(id.split('-')[1]);
      return num;
    }).sort((a, b) => a - b);

    const missing = [];
    for (let i = 1; i <= categoryStats.total; i++) {
      if (!expectedIds.includes(i)) {
        missing.push(i);
      }
    }

    if (missing.length > 0) {
      categoryStats.missingIds = missing;
    }

  } catch (err) {
    console.error(`讀取類別 ${categoryName} 失敗:`, err.message);
  }

  return categoryStats;
}

async function main() {
  console.log('='.repeat(60));
  console.log('JSONL 診斷報告');
  console.log('='.repeat(60));
  console.log();

  // 分析每個類別
  try {
    const categories = await readdir(QUESTIONS_DIR);

    for (const category of categories.sort()) {
      const categoryPath = join(QUESTIONS_DIR, category);
      const catStat = await stat(categoryPath);

      if (catStat.isDirectory()) {
        const result = await analyzeCategory(categoryPath, category);
        stats.categories[category] = result;
      }
    }

  } catch (err) {
    console.error('讀取目錄失敗:', err.message);
    return;
  }

  // 輸出統計
  console.log('## 各類別統計');
  console.log();
  console.log('| 類別 | 檔案數 | 有效 | 無效 | 缺失ID |');
  console.log('|------|--------|------|------|--------|');

  let totalExpected = 0;
  const expectedCounts = {
    PH: 30, CH: 30, VO: 30, CL: 50, MR: 50, AN: 30,
    CO: 20, LK: 30, CR: 30, C15: 40, TW: 30, AP: 20,
    RH: 30, CU: 30, EX: 30, LO: 20
  };

  for (const [cat, data] of Object.entries(stats.categories).sort()) {
    const expected = expectedCounts[cat] || '?';
    totalExpected += (typeof expected === 'number' ? expected : 0);
    const missingStr = data.missingIds ? data.missingIds.join(',') : '-';
    console.log(`| ${cat} | ${data.total}/${expected} | ${data.valid} | ${data.invalid} | ${missingStr} |`);
  }

  console.log();
  console.log('## 總體統計');
  console.log(`- 預期檔案數: ${totalExpected}`);
  console.log(`- 實際檔案數: ${stats.totalFiles}`);
  console.log(`- 有效 JSON: ${stats.validJson}`);
  console.log(`- 無效 JSON: ${stats.invalidJson}`);
  console.log(`- 空檔案: ${stats.emptyFiles}`);
  console.log(`- 多行檔案: ${stats.multiLineFiles}`);

  // 輸出問題清單
  if (problems.length > 0) {
    console.log();
    console.log('## 問題檔案清單');
    console.log();
    for (const p of problems) {
      console.log(`- ${p.file}: ${p.issue}`);
    }
  }

  // 輸出 JSON 供後續處理
  console.log();
  console.log('## 診斷資料 (JSON)');
  console.log('```json');
  console.log(JSON.stringify({
    summary: {
      expected: totalExpected,
      actual: stats.totalFiles,
      valid: stats.validJson,
      invalid: stats.invalidJson
    },
    categories: stats.categories,
    problems: problems
  }, null, 2));
  console.log('```');
}

main().catch(console.error);
