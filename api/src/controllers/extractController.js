const xlsx = require('xlsx');
const aiService = require('../services/aiService');
const { Logger } = require('../utils/logger');
const { asyncHandler } = require('../middleware/errorHandler');

const logger = new Logger('extractController');

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
