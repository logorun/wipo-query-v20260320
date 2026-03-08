const xlsx = require('xlsx');
const { v4: uuidv4 } = require('uuid');
const aiService = require('../services/aiService');
const { taskDB } = require('../models/database');
const { addTaskToQueue, connectionState, isRedisConnected } = require('../services/queueService');
const { Logger } = require('../utils/logger');
const { asyncHandler } = require('../middleware/errorHandler');

const logger = new Logger('extractController');
const BATCH_SIZE = 250;

function sendSSE(res, data) {
    res.write(`data: ${JSON.stringify(data)}\n\n`);
}

function sleep(ms) {
    return new Promise(resolve => setTimeout(resolve, ms));
}

const extractController = {
  extractFromExcel: asyncHandler(async (req, res) => {
    const { fileContent, fileName } = req.body;

    if (!fileContent) {
      return res.status(400).json({
        success: false,
        error: {
          code: 'MISSING_FILE',
          message: 'File content is required'
        }
      });
    }

    try {
      const buffer = Buffer.from(fileContent, 'base64');
      const workbook = xlsx.read(buffer, { type: 'buffer' });
      const firstSheet = workbook.Sheets[workbook.SheetNames[0]];
      const data = xlsx.utils.sheet_to_json(firstSheet, { header: 1 });

      if (!data || data.length === 0) {
        return res.status(400).json({
          success: false,
          error: {
            code: 'EMPTY_FILE',
            message: 'Excel file is empty or invalid'
          }
        });
      }

      logger.info('Excel parsed', { 
        fileName, 
        rows: data.length,
        cols: data[0]?.length 
      });

      const trademarks = await aiService.extractTrademarks(data);

      if (trademarks.length === 0) {
        return res.status(400).json({
          success: false,
          error: {
            code: 'NO_TRADEMARKS_FOUND',
            message: 'No trademarks found in the file'
          }
        });
      }

      res.json({
        success: true,
        data: {
          fileName,
          totalRows: data.length,
          extractedCount: trademarks.length,
          trademarks
        }
      });
    } catch (error) {
      logger.error('Excel extraction failed', { 
        error: error.message,
        fileName 
      });
      
      res.status(500).json({
        success: false,
        error: {
          code: 'EXTRACTION_FAILED',
          message: 'Failed to extract trademarks from file',
          details: error.message
        }
      });
    }
  }),

  extractFromData: asyncHandler(async (req, res) => {
    const { data, fileName } = req.body;

    if (!data || !Array.isArray(data) || data.length === 0) {
      return res.status(400).json({
        success: false,
        error: {
          code: 'MISSING_DATA',
          message: 'Data array is required'
        }
      });
    }

    try {
      logger.info('Processing data', { 
        fileName, 
        rows: data.length 
      });

      const trademarks = await aiService.extractTrademarks(data);

      if (trademarks.length === 0) {
        return res.status(400).json({
          success: false,
          error: {
            code: 'NO_TRADEMARKS_FOUND',
            message: 'No trademarks found in the data'
          }
        });
      }

      // Auto-split if more than BATCH_SIZE trademarks
      if (trademarks.length > BATCH_SIZE) {
        logger.info('Auto-splitting large upload', {
          fileName,
          totalTrademarks: trademarks.length,
          batchSize: BATCH_SIZE
        });

        const batches = [];
        const totalBatches = Math.ceil(trademarks.length / BATCH_SIZE);
        
        for (let i = 0; i < totalBatches; i++) {
          const start = i * BATCH_SIZE;
          const end = start + BATCH_SIZE;
          const batchTrademarks = trademarks.slice(start, end);
          
          const taskId = uuidv4();
          const task = {
            id: taskId,
            trademarks: batchTrademarks.map(t => t.trim().toUpperCase()),
            status: 'pending',
            priority: 5,
            callbackUrl: null,
            userId: req.user?.id || null,
            orgId: req.user?.orgId || null,
            planType: req.user?.plan || 'free',
            metadata: JSON.stringify({
              batchIndex: i,
              totalBatches: totalBatches,
              sourceFile: fileName
            })
          };

          await taskDB.create(task);
          await addTaskToQueue(taskId, task.trademarks, task.priority);

          batches.push({
            taskId,
            batchIndex: i,
            trademarkCount: batchTrademarks.length,
            status: 'pending'
          });

          logger.info('Created batch task', {
            taskId,
            batchIndex: i,
            totalBatches,
            trademarkCount: batchTrademarks.length
          });
        }

        return res.json({
          success: true,
          data: {
            needsSplit: true,
            fileName,
            totalTrademarks: trademarks.length,
            batchCount: totalBatches,
            tasks: batches
          }
        });
      }

      // No split needed - return existing response format
      res.json({
        success: true,
        data: {
          needsSplit: false,
          fileName,
          totalRows: data.length,
          extractedCount: trademarks.length,
          trademarks
        }
      });
    } catch (error) {
      logger.error('Data extraction failed', { 
        error: error.message,
        fileName 
      });
      
      res.status(500).json({
        success: false,
        error: {
          code: 'EXTRACTION_FAILED',
          message: 'Failed to extract trademarks from data',
          details: error.message
        }
      });
    }
  }),

  extractStream: async (req, res) => {
    const { data, fileName, options = {} } = req.body;
    const { autoSplit = true, priority = 5 } = options;

    const redisConnected = await isRedisConnected();
    logger.info('[DEBUG] extractStream called', { fileName, dataLength: data?.length, options, redisConnected });

    if (!data || !Array.isArray(data) || data.length === 0) {
      logger.error('[DEBUG] Invalid data received', { data: typeof data, isArray: Array.isArray(data) });
      return res.status(400).json({
        success: false,
        error: { code: 'MISSING_DATA', message: 'Data array is required' }
      });
    }

    res.setHeader('Content-Type', 'text/event-stream');
    res.setHeader('Cache-Control', 'no-cache');
    res.setHeader('Connection', 'keep-alive');
    res.setHeader('X-Accel-Buffering', 'no');

    const sendSSE = (eventData) => {
      logger.info('[DEBUG] Sending SSE event', { type: eventData.type, percent: eventData.percent });
      res.write(`data: ${JSON.stringify(eventData)}\n\n`);
    };

    try {
      const currentRedisState = await isRedisConnected();
      logger.info('[DEBUG] Stream processing started', { fileName, rows: data.length, redisConnected: currentRedisState });
      
      if (!currentRedisState) {
        logger.warn('[DEBUG] Redis not connected - tasks will be created but may not be processed');
        sendSSE({ type: 'log', level: 'warn', message: '警告: 队列服务未连接，任务创建后可能无法自动处理' });
      }
      
      sendSSE({ type: 'log', level: 'system', message: '读取 Excel 文件...' });
      await sleep(300);
      
      sendSSE({ type: 'log', level: 'info', message: `检测到 ${data.length} 行数据` });
      sendSSE({ type: 'progress', percent: 5, message: 'AI 开始提取商标...' });
      // 直接使用备用提取方法，跳过AI处理
      sendSSE({ type: 'log', level: 'info', message: '正在提取商标...' });
      
      let trademarks;
      trademarks = aiService.fallbackExtraction(data);
      logger.info('[DEBUG] Extraction completed', { trademarkCount: trademarks?.length });

      if (trademarks.length === 0) {
        sendSSE({ type: 'error', message: '未能从文件中提取到商标' });
        sendSSE({ type: 'complete', totalTrademarks: 0, totalTasks: 0 });
        return res.end();
      }

      sendSSE({ type: 'log', level: 'success', message: `AI 提取完成，发现 ${trademarks.length} 个商标` });
      sendSSE({ type: 'progress', percent: 50, message: '准备创建任务...' });
      await sleep(100);

      const shouldSplit = autoSplit && trademarks.length > BATCH_SIZE;
      
      if (shouldSplit) {
        const totalBatches = Math.ceil(trademarks.length / BATCH_SIZE);
        sendSSE({ type: 'log', level: 'info', message: `自动拆分为 ${totalBatches} 个任务` });
        
        for (let i = 0; i < totalBatches; i++) {
          const start = i * BATCH_SIZE;
          const end = start + BATCH_SIZE;
          const batchTrademarks = trademarks.slice(start, end);
          
          const taskId = uuidv4();
          const task = {
            id: taskId,
            trademarks: batchTrademarks.map(t => t.trim().toUpperCase()),
            status: 'paused',
            priority: priority,
            callbackUrl: null,
            userId: req.user?.id || null,
            orgId: req.user?.orgId || null,
            planType: req.user?.plan || 'free',
            metadata: JSON.stringify({
              batchIndex: i,
              totalBatches: totalBatches,
              sourceFile: fileName
            })
          };

          logger.info('[DEBUG] Creating task in database', { taskId, batchIndex: i, trademarkCount: batchTrademarks.length });
          await taskDB.create(task);
          logger.info('[DEBUG] Task created in database', { taskId });
          
          // Task created as paused, will be added to queue when user clicks start
          logger.info('[DEBUG] Task created as paused (waiting for user to start)', { taskId });

          sendSSE({ type: 'task', current: i + 1, total: totalBatches, id: taskId });
          sendSSE({ type: 'progress', percent: 50 + ((i + 1) / totalBatches * 45), message: `创建任务 ${i + 1}/${totalBatches}...` });
          
          logger.info('Stream created batch task', { taskId, batchIndex: i });
          await sleep(50);
        }

        sendSSE({ type: 'complete', totalTrademarks: trademarks.length, totalTasks: totalBatches });
      } else {
        const taskId = uuidv4();
        const task = {
            id: taskId,
            trademarks: trademarks.map(t => t.trim().toUpperCase()),
            status: 'paused',
            priority: priority,
          callbackUrl: null,
          userId: req.user?.id || null,
          orgId: req.user?.orgId || null,
          planType: req.user?.plan || 'free',
          metadata: JSON.stringify({ sourceFile: fileName })
        };

        logger.info('[DEBUG] Creating single task in database', { taskId, trademarkCount: trademarks.length });
        await taskDB.create(task);
        logger.info('[DEBUG] Single task created in database', { taskId });
        
        // Task created as paused, will be added to queue when user clicks start
        logger.info('[DEBUG] Single task created as paused (waiting for user to start)', { taskId });

        sendSSE({ type: 'task', current: 1, total: 1, id: taskId });
        sendSSE({ type: 'progress', percent: 95, message: '任务创建成功' });
        sendSSE({ type: 'log', level: 'success', message: `任务创建成功 (ID: ${taskId.slice(0, 8)}...)` });
        
        logger.info('Stream created single task', { taskId, trademarkCount: trademarks.length });
        await sleep(100);
        
        sendSSE({ type: 'complete', totalTrademarks: trademarks.length, totalTasks: 1 });
      }

      logger.info('[DEBUG] Stream processing completed, ending response');
      res.end();
    } catch (error) {
      logger.error('[DEBUG] Stream processing failed', { error: error.message, stack: error.stack });
      sendSSE({ type: 'error', message: error.message });
      sendSSE({ type: 'complete', totalTrademarks: 0, totalTasks: 0, error: true });
      res.end();
    }
  }
};

module.exports = extractController;
