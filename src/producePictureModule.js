const axios = require("axios");
const express = require('express');
const fs = require('fs').promises;
const fetch = require('node-fetch');
const FormData = require('form-data');
const path = require('path');
const sharp = require("sharp");
const { OpenAI } = require("openai");
const localtunnel = require('localtunnel');
require("dotenv").config();

async function removeBg(inputPath) {
  try {
    const fileBuffer = await fs.readFile(inputPath);
    const formData = new FormData();
    formData.append("size", "preview");
    formData.append("image_file", fileBuffer, { filename: 'image.jpg' });

    const response = await fetch("https://api.remove.bg/v1.0/removebg", {
      method: "POST",
      headers: { 
        "X-Api-Key": process.env.REMOVE_BG_API_KEY,
      },
      body: formData,
    });

    if (response.ok) {
      return await response.arrayBuffer();
    } else {
      const errorText = await response.text();
      throw new Error(`${response.status}: ${response.statusText}\n${errorText}`);
    }
  } catch (error) {
    console.error('Error in removeBg:', error);
    throw error;
  }
}

async function producePictureModule(settings, imgNameBase) {
    console.log("Input settings to producePictureModule", settings);
    const prompt = settings.prompt;
    console.log("Upload prompt:", prompt);

    const promptContext = prompt.match(/{([^}]+)}/)?.[1].trim() || "";
    console.log("Prompt context:", promptContext);

    const maxAttempts = 5;
    let attempts = 0;
    let imageUrls = [];
    let analysisResult;

    // Set up Express app for the webhook
    const app = express();
    app.use(express.json());

    // Start localtunnel to expose the webhook endpoint
    const port = process.env.PORT || 3000 + Math.floor(Math.random() * 1000);
    const tunnel = await localtunnel({ port });

    console.log(`Tunnel established at ${tunnel.url}`);

    // Variable to hold image generation promise
    let imageGenerationResolve, imageGenerationReject;

    app.post('/webhook', (req, res) => {
        console.log('Received webhook callback:', req.body);

        const data = req.body;

        if (data.task_id) {
            if (data.image_urls && data.image_urls.length > 0) {
                imageUrls = data.image_urls; // Get available images
                res.sendStatus(200);
                imageGenerationResolve();
            } else if (data.status === 'processing') {
                console.log(`Processing: ${data.percentage}%`);
                res.sendStatus(200);
            } else if (data.status === 'failed') {
                res.sendStatus(200);
                imageGenerationReject(new Error('Image generation failed on Midjourney side.'));
            } else {
                res.sendStatus(200);
                imageGenerationReject(new Error('Image generation failed or incomplete.'));
            }
        } else {
            res.sendStatus(400);
        }
    });

    const server = app.listen(port, () => {
        console.log(`Webhook server listening on port ${port}`);
    });

    try {
        while (attempts < maxAttempts) {
            attempts++;
            try {
                const imageGenerationPromise = new Promise((resolve, reject) => {
                    imageGenerationResolve = resolve;
                    imageGenerationReject = reject;
                });

                // Initiate image generation with APIFRAME API
                const response = await axios.post('https://api.apiframe.pro/imagine', {
                    prompt,
                    aspect_ratio: "2:3",
                    webhook_url: `${tunnel.url}/webhook`
                }, {
                    headers: {
                        'Content-Type': 'application/json',
                        'Authorization': process.env.APIFRAME_API_KEY
                    }
                });

                console.log('APIFRAME imagine response:', response.data);

                if (!response.data.task_id) {
                    throw new Error(`Invalid response from APIFRAME API: ${JSON.stringify(response.data)}`);
                }

                // Wait for image generation to complete via webhook
                await imageGenerationPromise;

                if (imageUrls.length === 0) {
                    console.log('No images were generated, retrying...');
                    throw new Error('No images were generated.');
                }

                console.log('Image URLs:', imageUrls);

                // Analyze the first image for quality
                analysisResult = await checkImageQualityModule(imageUrls[0], promptContext);
                console.log('Analysis result:', JSON.stringify(analysisResult, null, 2));

                if (analysisResult.image_quality === "pass") {
                    break; // Exit the loop if we have a valid image
                }

                console.log(`Image quality check failed. Attempt ${attempts}/${maxAttempts}`);
            } catch (error) {
                console.error(`Error during attempt ${attempts}:`, error.message);
            }

            if (attempts < maxAttempts) {
                const delay = Math.min(1000 * Math.pow(2, attempts), 30000); // Exponential backoff with 30s max
                await new Promise(resolve => setTimeout(resolve, delay));
            } else {
                console.error("Maximum attempts reached. Moving on to the next item.");
                break;
            }
        }
    } finally {
        // Clean up the localtunnel connection and server
        tunnel.close();
        server.close();
    }

    // Process any successfully generated images
    try {
        const outputPaths = [];

        for (let index = 0; index < imageUrls.length; index++) {
            const variationIndex = index + 1;
            const imgName = `${imgNameBase}_${variationIndex}`;
            const imageUrl = imageUrls[index];

            const downloadedImagePath = await downloadImage(imageUrl, imgName);
            const processedImagePath = await processImage(downloadedImagePath, imgName);

            await fs.unlink(downloadedImagePath).catch(err => console.error('Error deleting downloaded image:', err));

            outputPaths.push(processedImagePath);
        }

        return { outputPaths, analysisResult };
    } catch (error) {
        console.error("Error in image processing:", error.message);
        throw error;
    }
}

async function downloadImage(imageUrl, imgName) {
  const response = await axios.get(imageUrl, { responseType: 'arraybuffer' });
  const downloadedImagePath = path.resolve(`./pictures/downloaded/${imgName}.jpg`);
  await fs.mkdir(path.dirname(downloadedImagePath), { recursive: true });
  await fs.writeFile(downloadedImagePath, Buffer.from(response.data));
  console.log('Image downloaded from Replicate:', downloadedImagePath);
  return downloadedImagePath;
}

async function processImage(inputImagePath, imgName) {
  let imageData;
  
  if (process.env.REMOVE_BG === 'false') {
    console.log('Background removal disabled, using original image');
    imageData = await fs.readFile(inputImagePath);
  } else {
    console.log('Removing background with remove.bg...');
    try {
      imageData = await removeBg(inputImagePath);
      console.log('Background removal successful');
    } catch (error) {
      console.error('Background removal failed:', error);
      console.log('Using original image as fallback');
      imageData = await fs.readFile(inputImagePath);
    }
  }

  const generatedImagePath = path.resolve(`./pictures/generated/${imgName}.jpg`);
  await fs.mkdir(path.dirname(generatedImagePath), { recursive: true });
  await fs.writeFile(generatedImagePath, Buffer.from(imageData));
  console.log('Processed image saved to:', generatedImagePath);

  let outputPath;

  if (process.env.IMAGE_RESIZE === 'true') {
    console.log('Resizing image...');
    outputPath = await resizePicture(generatedImagePath, imgName);
    console.log('Image resized, final image path:', outputPath);
    // Optionally, delete the intermediate generated image if it's no longer needed
    await fs.unlink(generatedImagePath).catch(e =>
      console.error('Error deleting generated image:', e)
    );
  } else {
    console.log('Image resizing disabled, using processed image:', generatedImagePath);
    outputPath = generatedImagePath;
  }

  console.log('Final image path:', outputPath);

  return outputPath;
}

async function resizePicture(inputImagePath, imgName) {
  try {
    const extension = ".jpg";
    const outputPath = path.resolve(`./pictures/toupload/${imgName}${extension}`);

    // Ensure output directory exists
    await fs.mkdir(path.dirname(outputPath), { recursive: true });

    console.log('Resizing image to:', outputPath);
    
    const width = 2870;
    const height = 4100;

    await sharp(inputImagePath)
      .resize(width, height, {
        kernel: sharp.kernel.lanczos3,
        fit: 'contain',
        background: { r: 0, g: 0, b: 0, alpha: 0 }  // Transparent background
      })
      .sharpen({ sigma: 5 })
      .modulate({ saturation: 1.4 })
      .jpg({ quality: 100 })  // Ensure output is JPG
      .toFile(outputPath);
    console.log('Image resized successfully');

    console.log('Final outputPath:', outputPath);
    console.log('Deleting input file:', inputImagePath);
    await fs.unlink(inputImagePath);
    return outputPath;
  } catch (error) {
    console.error("Error in resizePicture:", error);
    if (await fs.access(inputImagePath).then(() => true).catch(() => false)) {
      await fs.unlink(inputImagePath).catch(e => console.error('Error deleting input file:', e));
    }
    throw error;
  }
}

async function checkImageQualityModule(imageUrl, promptContext) {
  const openai = new OpenAI({
    apiKey: process.env.OPENAI_API_KEY,
  });

  console.log('Starting checkImageQualityModule with imageUrl:', imageUrl);
  console.log('Prompt context:', promptContext);
  
  try {
    const timeoutPromise = new Promise((_, reject) =>
      setTimeout(() => reject(new Error('OpenAI API request timed out')), 60000)
    );

    const responsePromise = openai.chat.completions.create({
      model: "gpt-4o",
      messages: [
        {
          role: "system",
          content: `You are a graphic design QA engineer and a web editor known for the quality of 
          your texts from the point of view of understanding and optimizing natural referencing. 
          Evaluate the following image for any medium or significant artifacts and inconsistencies. 
          The criteria include: canvas frame, body out of frame, deformed face, ugly, bad art, extra limbs, 
          close up, blurry, fusion, inexpressive, duplicate, nude, blurry hands, blurry face, blurry eyes, 
          poorly drawn eyes, mutation, bad anatomy, bad proportions (except if it's inline with image style. 
          Example: it is anime, kawaii, chibi style image where characters can have bigger head than all other 
          body or some fantasy creature), malformed limbs, missing limbs, fused fingers, too many fingers, 
          long neck, extra objects, cross-eye, double-bladed sword, hand and weapon fusion, hand and sword fusion, 
          extra wings, extra tail, any broken or misspelled text (if you find any text then it is fail right away), 
          extra wings, extra fingers, extra legs, fused legs, 3 legs. If a human character has bad hands anatomy e.g. missing more than one finger on human hands 
          and it is clearly recognizable on the image then consider it as a fail. If a human character has bad hands anatomy e.g. one or more extra finger(s) on human hand(s) 
          and it is clearly recognizable on the image then consider it as a fail. If this is a cartoon, anime, fantasy, sci-fi, or mecha 
          character or creature then having less than 5 fingers/claws/mechanic hands on hand(s)/paw(s)/mechanic finger(s) is a 'pass' when it has the same amount 
          of fingers/claws on both hands. Totally unacceptable are fused fingers on hands of one or both hands, consider it as 'fail'. 
          Minor inconsistencies are acceptable e.g. there are 4 fingers on human hand(s) but it is not so clearly 
          visible and/or the angle of the hand(s) makes the viewer think as if there might be a 5th finger hidden behind other fingers. 
          Another quality aspect is that the image should not represent some famous character/creature or very similar character/creature 
          from any big media companies such as Disney, Marvel, Netflix, Nickelodeon, Sony etc. or representing some famous celebrities, actors,
          singers, sportsmen, bands, brands etc. Consider it as a fail, because we want to avoid any copyright infringement. For example, 
          if the image represents a comic book character wearing a suit in Batman colors with Batman logo or suit of Superman colors.
          Ensure the title and description match the image content. If not, do not consider the image as failed if there are no 
          medium or significant artifacts and inconsistencies described above. 
          Write a title and description to match the image content and consider it as passed. 
          The new title should be 8 words long and the description 100 to 150 characters long and must be in English. 
          If the title and description are suitable to the image at least approximately, consider it as passed.
          Also, create exactly 15 tags relevant to the image title and description which 
          must be in English and consist mostly of 2 and 3 word tags separated 
          by a comma. For example: cute cat, big black feline, long fur etc.
          
          IMPORTANT: The image was generated based on the following prompt context: "${promptContext}". 
          If you cannot clearly identify specific elements in the image, refer to this context for guidance. 
          Use this information to provide more accurate and specific titles, descriptions, and tags, 
          especially for unique or exotic elements that might be hard to identify visually.`
        },
        {
          role: "user",
          content: [
            { type: "text", text: `Analyze the following image:` },
            {
              type: "image_url",
              image_url: {
                "url": imageUrl,
              },
            },
            {
              type: "text",
              text: `Analyze the image and return a JSON object with the following structure, without any markdown formatting or code blocks:
              {
                "image_quality": "pass or fail",
                "reason": "explanation for the decision"
                "new_title": {
                  "en": "English title"
                },
                "new_description": {
                  "en": "English description"
                },
                "uploadTags": {
                  "en": "English tags"
                }
              }`,
            },
          ],
        },
      ],
    });

    const response = await Promise.race([responsePromise, timeoutPromise]);

    //console.log('OpenAI API Response in checkImageQualityModule:', JSON.stringify(response, null, 2));

    if (!response.choices || response.choices.length === 0 || !response.choices[0].message) {
      throw new Error('Invalid response from OpenAI API');
    }

    const analysis = response.choices[0].message.content;
    //console.log('Raw analysis in checkImageQualityModule:', analysis);

    const parsedAnalysis = JSON.parse(analysis);
    //console.log('Parsed analysis in checkImageQualityModule:', JSON.stringify(parsedAnalysis, null, 2));
    return parsedAnalysis;
  } catch (error) {
    console.error('Error in checkImageQualityModule:', error);
    throw error;
  }
}

module.exports = { producePictureModule };