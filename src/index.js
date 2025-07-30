require("dotenv").config();
const fs = require("fs").promises;
const path = require("path");
const ExcelJS = require('exceljs'); // Re-enabled ExcelJS
const { pause } = require("./utils");
const { paramsGeneratorModule } = require("./paramsGeneratorModule");
const { producePictureModule } = require("./producePictureModule");
const yargs = require('yargs');
const { hideBin } = require('yargs/helpers');
const csv = require('csv-parser'); // Import csv-parser
const xlsx = require('xlsx'); // Import xlsx

const { logDebug } = require('./utils/logDebug'); // Import centralized logDebug

// Add these lines right here
const projectRoot = path.join(__dirname, '..');
const uploadDir = path.join(projectRoot, 'pictures', 'toupload');

// Helper function to read a text file
async function readTextFile(filePath) {
  try {
    const data = await fs.readFile(filePath, 'utf8');
    return data.split('\n').filter(line => line.trim() !== '');
  } catch (error) {
    console.error(`Error reading text file ${filePath}: ${error.message}`);
    throw error;
  }
}

// Helper function to read a CSV file
function readCsvFile(filePath) {
  return new Promise((resolve, reject) => {
    const results = [];
    const readStream = require('fs').createReadStream(filePath);
    readStream
      .pipe(csv())
      .on('data', (data) => results.push(data))
      .on('end', () => resolve(results))
      .on('error', (error) => reject(error));
  });
}

async function readKeywordsFromFile(filePath) {
    try {
        const data = await fs.readFile(filePath, 'utf8');
        return data.trim(); // Trim whitespace from the content
    } catch (error) {
        console.error(`Error reading keywords file ${filePath}: ${error.message}`);
        throw error;
    }
}

async function readPromptFromFile(filePath) {
    try {
        const data = await fs.readFile(filePath, 'utf8');
        return data.trim(); // Trim whitespace from the content
    } catch (error) {
        console.error(`Error reading system prompt file ${filePath}: ${error.message}`);
        throw error;
    }
}

async function ensureDirectoryExists(dirPath) {
    try {
        await fs.access(dirPath);
    } catch (error) {
        if (error.code === 'ENOENT') {
            await fs.mkdir(dirPath, { recursive: true });
            console.log(`Directory created: ${dirPath}`);
        } else {
            throw error;
        }
    }
}

(async () => {
  const excelData = [];
  let totalAttemptedItems = 0;
  let successfulItems = 0;

  // Parse command line arguments
  const argv = yargs(hideBin(process.argv))
    .option('keywordsFile', {
      alias: 'k',
      type: 'string',
      description: 'Path to a text file containing keywords, one per line.',
    })
    .option('mjSystemPrompt', { // Renamed option
      alias: 's',
      type: 'string',
      description: 'Path to a text file containing the custom system prompt for AI image generation.',
    })
    .option('qualityCheckPromptFile', {
      alias: 'q',
      type: 'string',
      description: 'Path to a text file containing the custom system prompt for the image quality check (OpenAI API).',
    })
    .option('metadataSystemPrompt', {
      type: 'string',
      description: 'Path to a custom system prompt file for AI metadata generation.',
      default: null,
    })
    .option('qcSystemPrompt', {
      type: 'string',
      description: 'DEPRECATED. Path to a custom system prompt file for the quality check.',
      default: null,
    })
    .option('count', {
      alias: 'c',
      type: 'number',
      description: 'Number of items to process.',
      default: 1,
    })
    .option('aspectRatios', {
      type: 'array',
      description: 'Comma-separated list of aspect ratios (e.g., 1:1,16:9,9:16). Overrides ASPECT_RATIOS in .env',
      coerce: (arg) => {
        if (typeof arg === 'string') {
          return arg.split(',');
        } else if (Array.isArray(arg)) {
          return arg;
        }
        return [];
      },
    })
    .option('removeBg', {
      type: 'boolean',
      description: 'Enable or disable background removal. Overrides REMOVE_BG in .env',
    })
    .option('imageConvert', {
      type: 'boolean',
      description: 'Enable or disable image conversion. Overrides IMAGE_CONVERT in .env',
    })
    .option('convertToJpg', {
      type: 'boolean',
      description: 'Convert images to JPG if true, PNG if false. Overrides CONVERT_TO_JPG in .env',
    })
    .option('keywordRandom', {
      type: 'boolean',
      description: 'Pick keywords randomly if true, sequentially if false. Overrides KEYWORD_RANDOM in .env',
    })
    .option('trimTransparentBackground', {
      type: 'boolean',
      description: 'Automatically trim excess transparent background if true. Overrides TRIM_TRANSPARENT_BACKGROUND in .env',
    })
    .option('debugMode', {
      type: 'boolean',
      description: 'Enable or disable detailed debug logging. Overrides DEBUG_MODE in .env',
    })
    .option('pollingTimeout', {
      alias: 'pt',
      type: 'number',
      description: 'Set the maximum polling time in minutes for image generation (e.g., 15).',
      default: null,
    })
    .option('processMode', {
      alias: 'pm',
      type: 'string',
      description: 'Set the generation mode for Midjourney.',
      choices: ['relax', 'fast', 'turbo'],
    })
    .option('jpgBackground', {
      alias: 'jb',
      type: 'string',
      description: 'Set the background color for JPG conversion.',
      choices: ['white', 'black'],
    })
    .option('openaiModel', {
      alias: 'om',
      type: 'string',
      description: 'Set the OpenAI model for prompt generation and quality checks.',
      default: null,
    })
    .option('mjVersion', {
      alias: 'mv',
      type: 'string',
      description: 'Set the Midjourney version flag (e.g., 6.0, niji).',
      default: null,
    })
    .option('removeBgSize', {
      alias: 'rs',
      type: 'string',
      description: 'Set the output image size for remove.bg.',
      default: null,
    })
    .option('jpgQuality', {
      alias: 'jq',
      type: 'number',
      description: 'Set the quality for JPG output (1-100).',
      default: null,
    })
    .option('pngQuality', {
      alias: 'pq',
      type: 'number',
      description: 'Set the quality for PNG output (1-100).',
      default: null,
    })
    .option('runQualityCheck', {
      type: 'boolean',
      description: 'Enable the AI image quality check.',
      default: null,
    })
    .option('runMetadataGen', {
      type: 'boolean',
      description: 'Enable AI metadata (title/tags) generation.',
      default: null,
    })
    .help()
    .alias('help', 'h').argv;

  const customKeywordsFile = argv.keywordsFile;
  const customSystemPromptFile = argv.mjSystemPrompt; // Changed variable name
  const qualityCheckPromptFile = argv.qualityCheckPromptFile; // New variable for quality check

  // Centralized configuration object
  const config = {
    aspectRatios: argv.aspectRatios && argv.aspectRatios.length > 0 ? argv.aspectRatios : process.env.ASPECT_RATIOS.split(','),
    removeBg: argv.removeBg !== undefined ? argv.removeBg : (process.env.REMOVE_BG === 'true'),
    imageConvert: argv.imageConvert !== undefined ? argv.imageConvert : (process.env.IMAGE_CONVERT === 'true'),
    convertToJpg: argv.convertToJpg !== undefined ? argv.convertToJpg : (process.env.CONVERT_TO_JPG === 'true'),
    keywordRandom: argv.keywordRandom !== undefined ? argv.keywordRandom : (process.env.KEYWORD_RANDOM === 'true'),
    trimTransparentBackground:
      argv.trimTransparentBackground !== null
        ? argv.trimTransparentBackground
        : process.env.TRIM_TRANSPARENT_BACKGROUND === 'true',
    debugMode: argv.debugMode !== undefined && argv.debugMode !== null ? argv.debugMode : process.env.DEBUG_MODE === 'true',
    pollingTimeout: argv.pollingTimeout !== null ? argv.pollingTimeout : (process.env.POLLING_TIMEOUT || 10),
    processMode: argv.processMode || process.env.PROCESS_MODE || 'relax',
    jpgBackground: argv.jpgBackground || process.env.JPG_BACKGROUND || 'white',
    openaiModel: argv.openaiModel || process.env.OPENAI_MODEL || 'gpt-4o',
    mjVersion: argv.mjVersion || process.env.MJ_VERSION || '6.1',
    removeBgSize: argv.removeBgSize || process.env.REMOVE_BG_SIZE || 'auto',
    jpgQuality: argv.jpgQuality || parseInt(process.env.JPG_QUALITY, 10) || 100,
    pngQuality: argv.pngQuality || parseInt(process.env.PNG_QUALITY, 10) || 100,
    runQualityCheck: argv.runQualityCheck !== null ? argv.runQualityCheck : (process.env.RUN_QUALITY_CHECK !== 'false'), // Default true
    runMetadataGen: argv.runMetadataGen !== null ? argv.runMetadataGen : (process.env.RUN_METADATA_GEN !== 'false'), // Default true
  };

  // Set debug mode in process.env so it's available globally for the logDebug utility
  process.env.DEBUG_MODE = config.debugMode.toString();

  // --- Keyword and Prompt Loading ---
  let keywordsData = [];
  const keywordFilePath = argv.keywordsFile;
  if (keywordFilePath) {
    logDebug(`Loading keywords from ${keywordFilePath}`);
    const fileExtension = path.extname(keywordFilePath).toLowerCase();
    if (fileExtension === '.csv') {
      keywordsData = await readCsvFile(keywordFilePath);
    } else {
      keywordsData = await readTextFile(keywordFilePath);
    }
    if (keywordsData.length === 0) {
      throw new Error("Keyword file is empty or contains no valid data.");
    }
  } else {
    const { KEYWORDS } = require('./constant/keywords_food');
    keywordsData = KEYWORDS.character; // Default to food keywords
  }

  let customSystemPrompt = null;
  if (argv.mjSystemPrompt) {
    logDebug(`Loading custom system prompt from ${argv.mjSystemPrompt}`);
    customSystemPrompt = await fs.readFile(argv.mjSystemPrompt, 'utf8');
  }

  let customQualityCheckPrompt = null;
  if (argv.qualityCheckPromptFile) {
    logDebug(`Loading custom quality check prompt from ${argv.qualityCheckPromptFile}`);
    customQualityCheckPrompt = await fs.readFile(argv.qualityCheckPromptFile, 'utf8');
  }

  let customMetadataSystemPrompt = null;
  if (argv.metadataSystemPrompt) {
    logDebug(`Loading custom metadata system prompt from ${argv.metadataSystemPrompt}`);
    customMetadataSystemPrompt = await fs.readFile(argv.metadataSystemPrompt, 'utf8');
  }

  // Add custom prompts to config after they're loaded
  config.customQualityCheckPrompt = customQualityCheckPrompt;

  // --- Main Processing Loop ---
  try {
    const today = new Date();
    const formattedDate = today.toISOString().slice(0, 10).replace(/-/g, '.');
    const timeStr = today.toTimeString().slice(0, 8).replace(/:/g, '');

    const uploadDir = path.resolve('./pictures/toupload');
    await fs.mkdir(uploadDir, { recursive: true });

    const processedImages = [];

    for (let i = 0; i < argv.count; i++) {
      logDebug(`Starting item ${i + 1} of ${argv.count}`);

      try {
        // Determine the current set of keywords for this iteration
        let currentKeywords;
        if (Array.isArray(keywordsData) && keywordsData.length > 0 && typeof keywordsData[0] === 'object') {
          // CSV data - pass the row object directly
          currentKeywords = config.keywordRandom
            ? keywordsData[Math.floor(Math.random() * keywordsData.length)]
            : keywordsData[i % keywordsData.length];
        } else {
          // Text file data - wrap in array
          currentKeywords = config.keywordRandom
            ? [keywordsData[Math.floor(Math.random() * keywordsData.length)]]
            : [keywordsData[i % keywordsData.length]];
        }

        // Generate parameters
        const rawParams = await paramsGeneratorModule(
          currentKeywords,
          customSystemPrompt,
          keywordFilePath || '', // Pass the file path for extension checking
          config
        );

        // Generate picture
        const imgNameBase = `${formattedDate.replace(/\./g, '')}_${timeStr}_${i + 1}`;
        const producePictureResults = await producePictureModule(
          rawParams,
          imgNameBase,
          customMetadataSystemPrompt,
          config
        );

          if (!producePictureResults || producePictureResults.length === 0) {
            // This is not an error, just no images passed QC.
            logDebug('No images were processed in this run (likely failed QC).');
            continue; // Go to the next item in the loop
          }

          for (const result of producePictureResults) {
            const { outputPath, settings: updatedSettings } = result;

            // This check is now redundant if producePictureModule handles its errors
            // but we keep it as a final safeguard.
            if (
              config.runMetadataGen &&
              (!updatedSettings.title?.title?.en || !updatedSettings.uploadTags?.en)
            ) {
              console.error('Incomplete settings after metadata generation. Skipping item.');
              continue;
            }

            processedImages.push({
              outputPath,
              settings: updatedSettings, // Use the returned, updated settings
            });

            successfulItems++;
          }

          totalAttemptedItems++;
        } catch (error) {
          console.error(`Error processing item ${i + 1}: ${error.message}`);
          // Continue with the next item without exiting the loop
          continue;
        }
      }

      if (processedImages.length > 0) {
        console.log(`Successfully generated ${processedImages.length} images.`);

        // Only create Excel file if metadata generation is enabled
        if (config.runMetadataGen) {
          const worksheetData = processedImages.map(item => ({
            'Image Path': path.basename(item.outputPath),
            'Title': item.settings.title?.title?.en || '',
            'Description': item.settings.title?.description?.en || '',
            'Tags': item.settings.uploadTags?.en || '',
          }));

          const worksheet = xlsx.utils.json_to_sheet(worksheetData);
          const workbook = xlsx.utils.book_new();
          xlsx.utils.book_append_sheet(workbook, worksheet, 'Upload Data');

          const date = new Date().toISOString().split('T')[0].replace(/-/g, '_');
          const excelFileName = `redbubble_upload_data_${date}.xlsx`;
          const excelFilePath = path.join(process.cwd(), 'pictures', 'toupload', excelFileName);
          
          try {
            await fs.mkdir(path.dirname(excelFilePath), { recursive: true });
            await fs.writeFile(excelFilePath, xlsx.write(workbook, { bookType: 'xlsx', type: 'buffer' }));
            console.log(`Excel file with metadata created at ${excelFilePath}`);
          } catch (error) {
            console.error('Failed to create Excel file:', error.message);
          }
        } else {
          logDebug('Skipping Excel file generation as metadata generation is disabled.');
        }
      } else {
        logDebug('No valid items generated. Excel file not created.');
      }
  } catch (error) {
    console.error('An error occurred during the process:', error.message);
  } finally {
    console.log('Script finished.');
  }
})();