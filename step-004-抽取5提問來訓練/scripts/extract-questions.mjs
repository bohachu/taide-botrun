/**
 * extract-questions.mjs
 * 從 step-003 的 all-questions.jsonl 中抽取指定的 5 題
 *
 * 設計原則：BDD/TDD/SOLID/DRY
 * - Single Responsibility: 只負責抽取題目
 * - 輸出結構化 JSONL 供後續驗算與測試使用
 */

import { readFileSync, writeFileSync } from 'fs';
import { join, dirname } from 'path';
import { fileURLToPath } from 'url';

const __dirname = dirname(fileURLToPath(import.meta.url));

// 配置：要抽取的題目 ID
const TARGET_IDS = [
  'CH-001',  // 字形辨識：形近字、錯別字
  'CH-003',  // 字形辨識：成語辨識
  'LK-001',  // 國學常識：唐宋八大家
  'LK-002',  // 國學常識：建安七子
  'LK-003'   // 國學常識：竹林七賢
];

/**
 * 從 JSONL 檔案讀取並解析所有題目
 * @param {string} filePath - JSONL 檔案路徑
 * @returns {Array<Object>} 題目陣列
 */
function loadQuestions(filePath) {
  const content = readFileSync(filePath, 'utf-8');
  return content
    .split('\n')
    .filter(line => line.trim())
    .map((line, index) => {
      try {
        return JSON.parse(line);
      } catch (e) {
        console.error(`第 ${index + 1} 行解析失敗:`, e.message);
        return null;
      }
    })
    .filter(Boolean);
}

/**
 * 根據 ID 列表篩選題目（去除重複）
 * @param {Array<Object>} questions - 所有題目
 * @param {Array<string>} targetIds - 目標 ID 列表
 * @returns {Array<Object>} 篩選後的題目（唯一）
 */
function filterByIds(questions, targetIds) {
  const targetSet = new Set(targetIds);
  const result = [];
  const seenIds = new Set();

  for (const q of questions) {
    if (targetSet.has(q.id) && !seenIds.has(q.id)) {
      result.push(q);
      seenIds.add(q.id);
    }
  }
  return result;
}

/**
 * 簡化題目結構，只保留測試所需欄位
 * @param {Object} question - 原始題目
 * @returns {Object} 簡化後的題目
 */
function simplifyQuestion(question) {
  return {
    id: question.id,
    category: question.category,
    difficulty: question.difficulty,
    question: {
      stem: question.question.stem,
      options: question.question.options
    },
    original_answer: question.answer.correct,
    reasoning_summary: question.reasoning.principle,
    verification_source: question.verification?.verification_source || 'N/A'
  };
}

/**
 * 主程式
 */
function main() {
  const sourceFile = join(__dirname, '../../step-003-生成提問/all-questions.jsonl');
  const outputFile = join(__dirname, '../data/selected-questions.jsonl');

  console.log('=== 抽取 5 題供 OpenRouter API 測試 ===\n');

  // 1. 載入所有題目
  console.log('1. 載入題目來源...');
  const allQuestions = loadQuestions(sourceFile);
  console.log(`   共載入 ${allQuestions.length} 題\n`);

  // 2. 篩選指定題目
  console.log('2. 篩選目標題目...');
  console.log(`   目標 ID: ${TARGET_IDS.join(', ')}`);
  const selected = filterByIds(allQuestions, TARGET_IDS);
  console.log(`   成功篩選 ${selected.length} 題\n`);

  // 3. 檢查是否有遺漏
  const foundIds = new Set(selected.map(q => q.id));
  const missingIds = TARGET_IDS.filter(id => !foundIds.has(id));
  if (missingIds.length > 0) {
    console.warn(`   警告：以下 ID 未找到: ${missingIds.join(', ')}`);
  }

  // 4. 簡化並輸出
  console.log('3. 輸出選定題目...');
  const simplified = selected.map(simplifyQuestion);

  // 輸出 JSONL
  const jsonlContent = simplified.map(q => JSON.stringify(q, null, 0)).join('\n');
  writeFileSync(outputFile, jsonlContent, 'utf-8');
  console.log(`   已儲存至: ${outputFile}\n`);

  // 4. 顯示摘要
  console.log('=== 抽取結果摘要 ===');
  simplified.forEach((q, i) => {
    console.log(`\n${i + 1}. ${q.id}`);
    console.log(`   類別: ${q.category.main} > ${q.category.sub}`);
    console.log(`   難度: Level ${q.difficulty.level}`);
    console.log(`   原始答案: ${q.original_answer}`);
  });

  console.log('\n=== 完成 ===');
  return simplified;
}

// 執行
main();
