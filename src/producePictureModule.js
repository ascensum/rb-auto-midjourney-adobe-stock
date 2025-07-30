const axios = require("axios");
// const express = require('express'); // Removed express
const fs = require('fs').promises;
//const fetch = require('node-fetch');
// const FormData = require('form-data'); // Removed form-data
const path = require('path');
const sharp = require("sharp");
const { Blob } = require('node:buffer'); // Import Blob
const { logDebug } = require('./utils/logDebug'); // Corrected path
const aiVision = require('./aiVision');
//const ngrok = require('ngrok'); // Removed ngrok dependency
//require("dotenv").config(); // dotenv is already required in index.js


async function pause(isLong = false, seconds) {
  const milliseconds = isLong ? 60000 : (seconds || 3000);
  return new Promise(resolve => setTimeout(resolve, milliseconds));
}

async function removeBg(inputPath, removeBgSize) {
  try {
    const fileBuffer = await fs.readFile(inputPath);
    const formData = new FormData();
    // Convert Buffer to Blob for FormData.append
    const imageBlob = new Blob([fileBuffer], { type: 'image/png' }); // Assuming PNG, adjust if needed
    formData.append('size', removeBgSize);
    formData.append('image_file', imageBlob, 'image.png'); // Pass Blob directly with filename

    const response = await axios.post('https://api.remove.bg/v1.0/removebg', formData, {
      headers: {
        "X-Api-Key": process.env.REMOVE_BG_API_KEY,
        // ...formData.getHeaders(), // FormData from undici doesn't have getHeaders()
      },
      responseType: 'arraybuffer',
    });

    if (response.status === 200) {
      return response.data;
    } else {
      throw new Error(`Failed to remove background: ${response.status} ${response.statusText}`);
    }
  } catch (error) {
    console.error('Error in removeBg:', error);
    throw error;
  }
}

// Retry mechanism for removeBg
async function retryRemoveBg(inputPath, retries = 3, delay = 2000, removeBgSize) {
  for (let i = 0; i < retries; i++) {
    try {
      return await removeBg(inputPath, removeBgSize);
    } catch (error) {
      console.warn(`Attempt ${i + 1} for removeBg failed: ${error.message}. Retrying in ${delay / 1000} seconds...`);
      if (i < retries - 1) {
        await new Promise(resolve => setTimeout(resolve, delay));
      } else {
        throw error; // Last attempt failed, re-throw the error
      }
    }
  }
}

// Removed singleton instances for ngrok and Express server
// Removed initializeServerAndTunnel function
// Removed cleanupServerAndTunnel function

// Map to store pending image generation tasks (no longer needed for polling)
// const pendingTasks = new Map();

// Initialize a counter to keep track of the current aspect ratio index
let aspectRatioIndex = 0;

/**
 * Produces pictures based on the provided settings and image name base.
 * Implements polling mechanism for image generation status.
 * 
 * @param {Object} settings - Configuration settings for image generation.
 * @param {string} imgNameBase - Base name for the generated images.
 * @returns {Array} - List of processed images with their paths and settings.
 */
async function producePictureModule(
  settings,
  imgNameBase,
  customMetadataPrompt = null,
  config = {}
) {
  // Destructure config parameters
  const {
    removeBg,
    imageConvert,
    convertToJpg,
    trimTransparentBackground,
    aspectRatios,
    pollingTimeout,
    processMode,
    removeBgSize,
    runQualityCheck,
    runMetadataGen,
  } = config;

  // Removed local debug mode variables, use imported ones directly

  // const port = 3043; // Port no longer needed
  // let tunnelUrl; // No longer needed

  // Parse aspect ratios from the environment variable (now from config)
  // const aspectRatios = process.env.ASPECT_RATIOS.split(','); // Removed

  try {
    // Initialize server and tunnel (removed)
    // tunnelUrl = await initializeServerAndTunnel(port);

    // Prepare the webhook URL (no longer needed)
    // const webhookUrl = `${tunnelUrl}/webhook`;

    // Prepare the prompt
    const promptContext = settings.promptContext || ''; // Keep this for the quality check
    const prompt = settings.prompt || '';

    // Rotate through aspect ratios
    const aspect_ratio = aspectRatios[aspectRatioIndex];
    aspectRatioIndex = (aspectRatioIndex + 1) % aspectRatios.length;

    logDebug('Current aspect ration: ', aspect_ratio);

    // Initiate image generation with PIAPI API
    const response = await axios.post(
      'https://api.piapi.ai/api/v1/task', // Corrected Imagine endpoint based on docs
      {
        model: 'midjourney', // Required by PiAPI
        task_type: 'imagine', // Required by PiAPI
        input: {
          prompt: prompt,
          aspect_ratio: aspect_ratio,
          process_mode: processMode,
        },
      },
      {
        headers: {
          'Content-Type': 'application/json',
          'X-API-Key': process.env.PIAPI_API_KEY,
        },
      }
    );

    logDebug('PIAPI imagine response:', response.data);

    if (!response.data || !response.data.data || !response.data.data.task_id) {
      throw new Error(`Invalid response from PIAPI API: ${JSON.stringify(response.data)}`);
    }

    const taskId = response.data.data.task_id; // Use the task_id returned by the API

    // Polling mechanism for image generation status
    let imageUrls = [];
    const pollingInterval = 10 * 1000; // Poll every 10 seconds
    const maxPollingTime = (pollingTimeout || 10) * 60 * 1000; // Use configured timeout, default to 10 mins
    const startTime = Date.now();

    logDebug(`Polling for task ${taskId} (timeout: ${maxPollingTime / 60000} minutes)...`);

    let lastStatus = null; // Track the last reported status

    while (Date.now() - startTime < maxPollingTime) {
      try {
        const statusResponse = await axios.get(
          `https://api.piapi.ai/api/v1/task/${taskId}`, // Corrected polling endpoint based on common PiAPI pattern
          {
            headers: {
              'X-API-Key': process.env.PIAPI_API_KEY,
            },
          }
        );

        const taskData = statusResponse.data.data; // Access data.data as per response example
        
        if (taskData.status !== lastStatus) {
          logDebug(`Task ${taskId} status: ${taskData.status}`);
          lastStatus = taskData.status;
        }

        if (taskData.status.toLowerCase() === 'completed' && taskData.output) {
          // Prioritize temporary_image_urls, then image_urls, then image_url
          if (taskData.output.temporary_image_urls && taskData.output.temporary_image_urls.length > 0) {
            imageUrls = taskData.output.temporary_image_urls;
          } else if (taskData.output.image_urls && taskData.output.image_urls.length > 0) {
            imageUrls = taskData.output.image_urls;
          } else if (taskData.output.image_url) {
            // Fallback for single image_url if image_urls/temporary_image_urls are not present
            imageUrls = [taskData.output.image_url];
          }

          if (imageUrls.length > 0) {
            break; // Exit loop on completion
          }
        } else if (taskData.status.toLowerCase() === 'failed') {
          throw new Error(`Image generation failed for task ${taskId}: ${taskData.error?.message || 'Unknown error'}`);
        } else if (taskData.status.toLowerCase() === 'staged') {
          logDebug(`Task ${taskId} is staged. Waiting...`); // Use global logDebug
        }
      } catch (pollError) {
        console.error(`Error while polling for task ${taskId}: ${pollError.message}`);
        // Continue polling, but log the error
      }

      await pause(false, pollingInterval / 1000); // Wait before next poll (pause expects seconds)
    }

    if (imageUrls.length === 0) {
      throw new Error('Image generation timed out or no images were generated.');
    }

    logDebug('Image URLs:', imageUrls);

    // Process each image URL
    const processedImages = [];
    const successfulItems = [];

    for (let i = 0; i < imageUrls.length; i++) {
      const imageUrl = imageUrls[i];
      const imageSuffix = `_${i + 1}`;
      const inputImagePath = path.resolve(`./pictures/generated/${imgNameBase}${imageSuffix}.png`);

      // Download the image
      try {
        await axios
          .get(imageUrl, { responseType: 'arraybuffer' })
          .then(async (response) => {
            await fs.mkdir(path.dirname(inputImagePath), { recursive: true });
            await fs.writeFile(inputImagePath, response.data);
            logDebug(`Image downloaded and saved to ${inputImagePath}`); // Use global logDebug
          })
          .catch((error) => {
            console.error('Error downloading image:', error);
            throw error;
          });

        // --- Conditionally run Quality Check ---
        if (runQualityCheck) {
          const qualityResult = await aiVision.runQualityCheck(inputImagePath, config.openaiModel, config.customQualityCheckPrompt);
          // Handle both old format (image_quality: 'pass'/'fail') and new format (passed: true/false)
          const isPassed = qualityResult.passed === true || qualityResult.image_quality?.toLowerCase() === 'pass';
          if (!isPassed) {
            console.error(`Image failed quality check: ${qualityResult.reason}. Keeping image in generated folder for manual review.`);
            // Don't delete the image - keep it in generated folder for manual review
            // Skip further processing (metadata generation, image processing)
            continue; // Skip to the next image
          }
          logDebug('Image passed quality check.');
        }

        // --- Conditionally run Metadata Generation ---
        let updatedSettings = { ...settings }; // Create a local copy to modify
        if (runMetadataGen) {
          const metadataResult = await aiVision.generateMetadata(
            inputImagePath,
            promptContext,
            customMetadataPrompt,
            config.openaiModel
          );
          // Update settings with new metadata
          if (metadataResult.new_title) {
            // Ensure nested objects exist before assignment
            updatedSettings.title = updatedSettings.title || {};
            updatedSettings.title.title = { en: metadataResult.new_title };
          }
          if (metadataResult.new_description) {
            updatedSettings.title = updatedSettings.title || {};
            updatedSettings.title.description = { en: metadataResult.new_description };
          }
          if (metadataResult.uploadTags) {
            updatedSettings.uploadTags = { en: metadataResult.uploadTags };
          }
        }

        // PROCESS IMAGE
        logDebug('Processing image...');
        // The processImage function now handles everything and returns the final path in /toupload
        const outputPath = await processImage(inputImagePath, imgNameBase + imageSuffix, config);

        processedImages.push({
          outputPath,
          settings: updatedSettings, // Push the modified settings
        });
      } catch (error) {
        console.error('Error during image processing steps:', error);
        try {
          await fs.unlink(inputImagePath); // Attempt to clean up failed image
        } catch (e) { /* ignore */ }
        continue; // Skip to the next image
      }
    }

    if (processedImages.length === 0) {
      throw new Error('No images passed the quality check.');
    }

    // Cleanup if no pending tasks
    // await cleanupServerAndTunnel(); // Removed cleanupServerAndTunnel

    // Return the list of processed images and updated settings
    return processedImages;
  } catch (error) {
    console.error('Error during image generation:', error);
    // Cleanup in case of error
    // pendingTasks.forEach(({ reject, timeout }, taskId) => { // Removed pendingTasks
    //   clearTimeout(timeout);
    //   reject(new Error('Process terminated due to an error.'));
    //   pendingTasks.delete(taskId);
    // });
    // await cleanupServerAndTunnel(); // Removed cleanupServerAndTunnel
    throw error;
  }
}

async function processImage(inputImagePath, imgName, config = {}) {
  const {
    removeBg,
    imageConvert,
    convertToJpg,
    trimTransparentBackground,
    jpgBackground,
    removeBgSize,
    jpgQuality,
    pngQuality,
  } = config;

  let imageBuffer;
  try {
    imageBuffer = await fs.readFile(inputImagePath);
  } catch (error) {
    console.error(`Error reading initial image file ${inputImagePath}:`, error);
    throw error;
  }

  // 1. Remove Background (optional)
  if (removeBg) {
    logDebug('Removing background with remove.bg...');
    try {
      imageBuffer = await retryRemoveBg(inputImagePath, 3, 2000, removeBgSize);
      logDebug('Background removal successful');
    } catch (error) {
      console.error('Background removal failed:', error);
      logDebug('Using original image as fallback for subsequent steps.');
      // imageBuffer already contains the original image, so we can proceed
    }
  }

  let sharpInstance = sharp(imageBuffer);

  // 2. Trim (optional, with conditions)
  if (trimTransparentBackground) {
    if (!removeBg) {
      console.warn("Warning: --trimTransparentBackground requires --removeBg to be true. Skipping trim.");
    } else if (convertToJpg) {
      console.warn("Warning: --trimTransparentBackground has no effect when converting to JPG. Skipping trim.");
    } else {
      logDebug('Trimming transparent background...');
      sharpInstance = sharpInstance.trim({ threshold: 50 });
    }
  }

  // 3. Apply Conversion Effects (optional)
  if (imageConvert) {
    logDebug('Applying image conversion effects (sharpen, modulate)...');
    sharpInstance = sharpInstance
      .sharpen({ sigma: 5 })
      .modulate({ saturation: 1.4 });
  }

  // 4. Determine Final Format and Path
  const finalExtension = convertToJpg ? ".jpg" : ".png";
  const outputPath = path.resolve(`./pictures/toupload/${imgName}${finalExtension}`);
  await fs.mkdir(path.dirname(outputPath), { recursive: true });

  // 5. Encode to Final Format and Save
  try {
    if (finalExtension === '.jpg') {
      const backgroundColor = jpgBackground === 'black' ? '#000000' : '#ffffff';
      await sharpInstance
        .flatten({ background: backgroundColor })
        .jpeg({ quality: jpgQuality, chromaSubsampling: '4:4:4' })
        .toFile(outputPath);
    } else {
      await sharpInstance.png({ quality: pngQuality }).toFile(outputPath);
    }
    logDebug('Final image saved to:', outputPath);
  } catch (error) {
    console.error(`Error saving final image to ${outputPath}:`, error);
    throw error;
  }

  // 6. Cleanup Original Downloaded Image
  try {
    await fs.unlink(inputImagePath);
    logDebug('Cleaned up original downloaded image.');
  } catch (error) {
    console.error(`Error deleting original downloaded image ${inputImagePath}:`, error);
  }

  return outputPath;
}

module.exports = { producePictureModule };