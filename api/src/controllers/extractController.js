const xlsx = require('xlsx');
const { v4: uuidv4 } = require('uuid');
const aiService = require('../services/aiService');
const { taskDB } = require('../models/database');
const { addTaskToQueue } = require('../services/queueService');
const { Logger } = require('../utils/logger');
const { asyncHandler } = require('../middleware/errorHandler');

const logger = new Logger('extractController');
const BATCH_SIZE = 250;

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
  })
};

module.exports = extractController;
