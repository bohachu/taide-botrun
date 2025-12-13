/**
 * test-openrouter.mjs
 * 使用 OpenRouter API 測試 LLM 回答高中國文學測題目
 *
 * 設計原則：BDD/TDD/SOLID/DRY
 * - Single Responsibility: 每個函式只做一件事
 * - Open/Closed: 易於擴充新模型
 * - Dependency Inversion: 透過設定檔注入模型
 */

import { readFileSync, writeFileSync } from 'fs';
import { join, dirname } from 'path';
import { fileURLToPath } from 'url';

// 手動載入 .env 檔案
function loadEnv(envPath) {
  try {
    const content = readFileSync(envPath, 'utf-8');
    for (const line of content.split('\n')) {
      const trimmed = line.trim();
      if (trimmed && !trimmed.startsWith('#')) {
        const match = trimmed.match(/^([^=]+)=(.*)$/);
        if (match) {
          const key = match[1].trim();
          let value = match[2].trim();
          // 移除引號
          if ((value.startsWith('"') && value.endsWith('"')) ||
              (value.startsWith("'") && value.endsWith("'"))) {
            value = value.slice(1, -1);
          }
          process.env[key] = value;
        }
      }
    }
  } catch (e) {
    console.warn(`無法載入 .env: ${e.message}`);
  }
}

const __dirnameTmp = dirname(fileURLToPath(import.meta.url));
loadEnv(join(__dirnameTmp, '../../.env'));

const __dirname = dirname(fileURLToPath(import.meta.url));

// ======================
// 設定區
// ======================
const CONFIG = {
  apiKey: process.env.OPENROUTER_API_KEY,
  baseUrl: 'https://openrouter.ai/api/v1/chat/completions',
  models: [
    { id: 'google/gemma-3-12b-it', name: 'Gemma 3 12B IT' },
    { id: 'google/gemini-3-pro-preview', name: 'Gemini 3 Pro Preview' }
  ],
  timeout: 120000, // 120 秒
  maxRetries: 2
};

// ======================
// 資料載入
// ======================

/**
 * 載入驗算後的題目
 * @returns {Array<Object>} 題目陣列
 */
function loadVerifiedQuestions() {
  const filePath = join(__dirname, '../data/verified-questions.jsonl');
  const content = readFileSync(filePath, 'utf-8');
  return content
    .split('\n')
    .filter(line => line.trim())
    .map(line => JSON.parse(line));
}

// ======================
// Prompt 建構
// ======================

/**
 * 建構測驗 Prompt
 * @param {Object} question - 題目物件
 * @returns {string} 完整的 prompt
 */
function buildPrompt(question) {
  const optionsText = question.options.join('\n');

  return `你是一位台灣高中國文老師，正在協助學生進行學測模擬考。
請仔細閱讀以下題目，選出正確答案。

【題目】
${question.question_stem}

【選項】
${optionsText}

【作答要求】
1. 請直接回答選項代號（A、B、C 或 D）
2. 簡要說明你的推理過程（2-3 句話）
3. 格式範例：
   答案：B
   理由：因為...所以選擇 B。

請作答：`;
}

// ======================
// API 呼叫
// ======================

/**
 * 呼叫 OpenRouter API
 * @param {string} modelId - 模型 ID
 * @param {string} prompt - 提示詞
 * @returns {Promise<Object>} API 回應
 */
async function callOpenRouter(modelId, prompt) {
  const startTime = performance.now();

  const response = await fetch(CONFIG.baseUrl, {
    method: 'POST',
    headers: {
      'Authorization': `Bearer ${CONFIG.apiKey}`,
      'Content-Type': 'application/json',
      'HTTP-Referer': 'https://github.com/taide-botrun',
      'X-Title': 'TAIDE Botrun Test'
    },
    body: JSON.stringify({
      model: modelId,
      messages: [
        { role: 'user', content: prompt }
      ],
      temperature: 0.1, // 低溫度以獲得更確定的答案
      max_tokens: 32000 // 給推理模型充足空間（32k tokens）
    }),
    signal: AbortSignal.timeout(CONFIG.timeout)
  });

  const endTime = performance.now();
  const responseTime = endTime - startTime;

  if (!response.ok) {
    const errorBody = await response.text();
    throw new Error(`API Error ${response.status}: ${errorBody}`);
  }

  const data = await response.json();

  // 取得回應內容（支援推理模型的 reasoning 欄位）
  let content = data.choices?.[0]?.message?.content || '';
  const reasoning = data.choices?.[0]?.message?.reasoning || '';

  // 如果 content 為空但有 reasoning，從 reasoning 中提取
  if (!content && reasoning) {
    content = reasoning;
  }

  return {
    content,
    usage: data.usage || { prompt_tokens: 0, completion_tokens: 0, total_tokens: 0 },
    responseTime,
    model: modelId
  };
}

/**
 * 帶重試的 API 呼叫
 * @param {string} modelId - 模型 ID
 * @param {string} prompt - 提示詞
 * @param {number} retries - 重試次數
 * @returns {Promise<Object>} API 回應
 */
async function callWithRetry(modelId, prompt, retries = CONFIG.maxRetries) {
  for (let attempt = 0; attempt <= retries; attempt++) {
    try {
      return await callOpenRouter(modelId, prompt);
    } catch (error) {
      if (attempt === retries) {
        return {
          content: `ERROR: ${error.message}`,
          usage: { prompt_tokens: 0, completion_tokens: 0, total_tokens: 0 },
          responseTime: 0,
          model: modelId,
          error: true
        };
      }
      console.log(`  重試 ${attempt + 1}/${retries}...`);
      await new Promise(r => setTimeout(r, 2000)); // 等待 2 秒後重試
    }
  }
}

// ======================
// 答案解析
// ======================

/**
 * 從 LLM 回應中解析答案
 * @param {string} response - LLM 回應
 * @returns {Object} 解析結果
 */
function parseAnswer(response) {
  // 嘗試多種匹配模式
  const patterns = [
    /答案[：:]\s*([A-D])/i,
    /選擇\s*([A-D])/i,
    /([A-D])\s*選項/i,
    /^([A-D])[.。\s]/m,
    /\b([A-D])\b/
  ];

  for (const pattern of patterns) {
    const match = response.match(pattern);
    if (match) {
      return {
        answer: match[1].toUpperCase(),
        reasoning: response.replace(match[0], '').trim().slice(0, 200)
      };
    }
  }

  return {
    answer: 'UNKNOWN',
    reasoning: response.slice(0, 200)
  };
}

// ======================
// 測試執行
// ======================

/**
 * 對單一題目進行測試
 * @param {Object} question - 題目
 * @param {string} modelId - 模型 ID
 * @returns {Promise<Object>} 測試結果
 */
async function testSingleQuestion(question, modelId) {
  const prompt = buildPrompt(question);
  const response = await callWithRetry(modelId, prompt);

  const parsed = parseAnswer(response.content);
  const isCorrect = parsed.answer === question.verified_answer;

  return {
    questionId: question.id,
    model: modelId,
    correctAnswer: question.verified_answer,
    modelAnswer: parsed.answer,
    isCorrect,
    reasoning: parsed.reasoning,
    rawResponse: response.content,
    responseTime: response.responseTime,
    usage: response.usage,
    error: response.error || false
  };
}

/**
 * 對所有題目進行平行測試
 * @param {Array<Object>} questions - 題目陣列
 * @param {string} modelId - 模型 ID
 * @param {string} modelName - 模型名稱
 * @returns {Promise<Object>} 測試結果摘要
 */
async function testAllQuestions(questions, modelId, modelName) {
  console.log(`\n=== 測試模型: ${modelName} ===`);
  console.log(`模型 ID: ${modelId}`);
  console.log(`平行測試 ${questions.length} 題...\n`);

  // 平行執行所有題目測試
  const startTime = performance.now();
  const results = await Promise.all(
    questions.map(q => testSingleQuestion(q, modelId))
  );
  const endTime = performance.now();

  // 顯示結果
  results.forEach((result, i) => {
    const status = result.error ? '錯誤' : (result.isCorrect ? '✓ 正確' : '✗ 錯誤');
    console.log(`[${i + 1}] ${result.questionId}: ${status} | 答案: ${result.modelAnswer} (正確: ${result.correctAnswer}) | ${(result.responseTime / 1000).toFixed(2)}s`);
  });

  // 計算統計
  const correctCount = results.filter(r => r.isCorrect && !r.error).length;
  const errorCount = results.filter(r => r.error).length;
  const totalTime = endTime - startTime; // 實際平行執行時間
  const sumResponseTime = results.reduce((sum, r) => sum + r.responseTime, 0);
  const totalInputTokens = results.reduce((sum, r) => sum + r.usage.prompt_tokens, 0);
  const totalOutputTokens = results.reduce((sum, r) => sum + r.usage.completion_tokens, 0);

  console.log(`\n統計: ${correctCount}/${questions.length} 正確 | 總耗時: ${(totalTime / 1000).toFixed(2)}s`);

  return {
    modelId,
    modelName,
    totalQuestions: questions.length,
    correctCount,
    errorCount,
    accuracy: ((correctCount / (questions.length - errorCount)) * 100).toFixed(1),
    totalTime,
    avgTime: sumResponseTime / questions.length,
    totalInputTokens,
    totalOutputTokens,
    results
  };
}

// ======================
// 報告生成
// ======================

/**
 * 生成測試報告
 * @param {Array<Object>} summaries - 各模型測試摘要
 * @param {Array<Object>} questions - 原始題目
 * @returns {string} Markdown 格式報告
 */
function generateReport(summaries, questions) {
  const timestamp = new Date().toISOString();

  let report = `# OpenRouter API 模型測試報告

## 測試資訊
- 測試日期: ${timestamp}
- 題目數量: ${questions.length}
- 測試模型: ${summaries.map(s => s.modelName).join(', ')}

## 整體結果摘要

| 模型 | 正確率 | 正確/總題 | 總時間 | 平均回應 | 輸入 Token | 輸出 Token |
|------|--------|----------|--------|----------|-----------|-----------|
`;

  for (const s of summaries) {
    report += `| ${s.modelName} | ${s.accuracy}% | ${s.correctCount}/${s.totalQuestions} | ${(s.totalTime / 1000).toFixed(1)}s | ${(s.avgTime / 1000).toFixed(2)}s | ${s.totalInputTokens} | ${s.totalOutputTokens} |\n`;
  }

  report += `\n## 各題詳細結果\n\n`;

  for (const q of questions) {
    report += `### ${q.id}: ${q.category}\n\n`;
    report += `**題目**: ${q.question_stem.slice(0, 100)}...\n\n`;
    report += `**正確答案**: ${q.verified_answer}\n\n`;
    report += `| 模型 | 回答 | 正確 | 時間 |\n`;
    report += `|------|------|------|------|\n`;

    for (const s of summaries) {
      const result = s.results.find(r => r.questionId === q.id);
      if (result) {
        const status = result.error ? '錯誤' : (result.isCorrect ? '✓' : '✗');
        report += `| ${s.modelName} | ${result.modelAnswer} | ${status} | ${(result.responseTime / 1000).toFixed(2)}s |\n`;
      }
    }

    report += '\n';
  }

  report += `## 錯誤分析\n\n`;

  for (const s of summaries) {
    const wrongAnswers = s.results.filter(r => !r.isCorrect && !r.error);
    if (wrongAnswers.length > 0) {
      report += `### ${s.modelName} 錯誤答案\n\n`;
      for (const wrong of wrongAnswers) {
        const q = questions.find(q => q.id === wrong.questionId);
        report += `- **${wrong.questionId}**: 模型答 ${wrong.modelAnswer}，正確答案 ${wrong.correctAnswer}\n`;
        report += `  - 模型推理: ${wrong.reasoning}\n`;
        report += `  - 可能原因: ${analyzeError(q, wrong)}\n\n`;
      }
    }
  }

  report += `---\n\n*報告生成時間: ${timestamp}*\n`;

  return report;
}

/**
 * 分析錯誤原因
 * @param {Object} question - 題目
 * @param {Object} result - 測試結果
 * @returns {string} 錯誤原因分析
 */
function analyzeError(question, result) {
  if (result.modelAnswer === 'UNKNOWN') {
    return '無法從回應中解析出明確答案，可能是回應格式問題';
  }

  if (question.category.includes('字形')) {
    return '形近字辨識錯誤，可能缺乏繁體中文字形訓練資料';
  }

  if (question.category.includes('國學常識')) {
    return '文學史知識錯誤，可能是訓練資料中相關知識不足或有誤';
  }

  return '推理錯誤或知識不足';
}

// ======================
// 主程式
// ======================

async function main() {
  console.log('============================================');
  console.log('  OpenRouter API 高中國文學測測試');
  console.log('============================================\n');

  // 檢查 API Key
  if (!CONFIG.apiKey) {
    console.error('錯誤: 未設定 OPENROUTER_API_KEY');
    process.exit(1);
  }

  // 載入題目
  console.log('1. 載入驗算後的題目...');
  const questions = loadVerifiedQuestions();
  console.log(`   共 ${questions.length} 題\n`);

  // 平行測試所有模型
  console.log('2. 平行測試所有模型...');
  const summaries = await Promise.all(
    CONFIG.models.map(async (model) => {
      try {
        const summary = await testAllQuestions(questions, model.id, model.name);

        // 輸出單一模型結果
        const resultFile = join(__dirname, `../reports/result-${model.id.replace(/[/:]/g, '_')}.json`);
        writeFileSync(resultFile, JSON.stringify(summary, null, 2), 'utf-8');
        console.log(`已儲存: ${resultFile}`);

        return summary;
      } catch (error) {
        console.error(`模型 ${model.name} 測試失敗:`, error.message);
        return null;
      }
    })
  );

  // 過濾失敗的測試
  const validSummaries = summaries.filter(Boolean);

  // 生成報告
  console.log('\n3. 生成測試報告...');
  const report = generateReport(validSummaries, questions);
  const reportFile = join(__dirname, '../reports/baseline-report.md');
  writeFileSync(reportFile, report, 'utf-8');
  console.log(`已儲存: ${reportFile}`);

  // 輸出 JSON 摘要
  const jsonSummary = {
    timestamp: new Date().toISOString(),
    questions: questions.length,
    models: validSummaries.map(s => ({
      modelId: s.modelId,
      modelName: s.modelName,
      accuracy: s.accuracy,
      correctCount: s.correctCount,
      totalTime: s.totalTime,
      avgTime: s.avgTime,
      totalInputTokens: s.totalInputTokens,
      totalOutputTokens: s.totalOutputTokens
    }))
  };
  const jsonFile = join(__dirname, '../reports/baseline-summary.json');
  writeFileSync(jsonFile, JSON.stringify(jsonSummary, null, 2), 'utf-8');
  console.log(`已儲存: ${jsonFile}`);

  // 最終摘要
  console.log('\n============================================');
  console.log('  測試完成摘要');
  console.log('============================================');
  for (const s of validSummaries) {
    console.log(`\n${s.modelName}:`);
    console.log(`  正確率: ${s.accuracy}% (${s.correctCount}/${s.totalQuestions})`);
    console.log(`  平均回應時間: ${(s.avgTime / 1000).toFixed(2)} 秒`);
    console.log(`  總 Token: ${s.totalInputTokens + s.totalOutputTokens}`);
  }
  console.log('\n');
}

// 執行
main().catch(console.error);
