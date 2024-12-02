//const { KEYWORDS } = require('./constant/keywords');
const { KEYWORDS} = require('./constant/keywords_trending_2024.12.01');
const { OpenAI } = require("openai");
require('dotenv').config()

const openai = new OpenAI({
  apiKey: process.env.OPENAI_API_KEY,
});

let currentKeywordIndex = 0; // Initialize the keyword index

const paramsGeneratorModule = async() => {
  let allKeywords = [...new Set([...KEYWORDS.character])];
  
  const keywordRandomFlag = process.env.KEYWORD_RANDOM === 'true';

  let keyword;

  if (keywordRandomFlag) {
    // Random mode
    allKeywords = shuffleArray(allKeywords);
    keyword = allKeywords[Math.floor(Math.random() * allKeywords.length)];
  } else {
    // Sequential mode
    keyword = allKeywords[currentKeywordIndex];
    currentKeywordIndex = (currentKeywordIndex + 1) % allKeywords.length; // Increment index and wrap around if necessary
  }

  // Generate prompt using GPT-4-mini
  const prompt = await generatePrompt(keyword);

  const params = {
    prompt: prompt // The complete prompt for Flux .1 dev
  };

  console.log("Raw Params object from ParamsGeneratorModule", params);
  return params;
}

async function generatePrompt(keyword) {
  const systemPrompt =   `You are a prompt generation assistant specialized in crafting detailed and optimized text inputs for FLUX AI image generation. Based on user-provided keywords or ideas, your task is to create stunning and precise prompts. Ensure the prompts are tailored to FLUX AI's advanced capabilities, including photorealism, texture accuracy, and style variations. Obey the following guidelines:

  - Subject Description: Start with a detailed and vivid description of the primary subject.
  - Artistic or Photographic Style: Clearly specify a style. ( e.g., realism, impressionism, post-impressionism, romanticism, neoclassicism, baroque, renaissance, gothic, mannerism, rococo, expressionism, cubism, fauvism, abstract art, surrealism, pop art, minimalism, 
    abstract expressionism, dadaism, constructivism, de stijl, folk art, chinese ink painting, japanese ukiyo-e, indian miniature painting, islamic art, african tribal art, street art, digital painting, photorealism, fantasy art, visionary art, naïve art, outsider art)."
  - Specify the type of image (e.g., digital illustration, vector art, flat art, isometric art, 3D rendering, pixel art, low poly art, line art, gradient art, concept art, character design, storyboard art, matte painting, infographic art, motion graphics, collage art, anime/manga art, comic book art, fantasy art, 
    sci-fi art).
  - Attributes and Details: Describe key features, colors, materials, or textures. For example, "glossy surfaces," "gold accents," or "rustic wood textures."
  - Lighting and Environment: Add depth by specifying the environment, time of day, weather, or specific lighting conditions (e.g., "soft ambient glow," "dramatic backlight").
  - Mood and Atmosphere: Include emotive or thematic elements, such as "serene and peaceful," "dramatic and intense," or "whimsical and magical."
  - Technical Enhancements: Use keywords for FLUX features, such as "8K resolution," "ultra-sharp detail," "HDR lighting," "macro focus," or "bokeh effect."
  - Dynamic Elements: If applicable, include motion or energy in the scene, like "flowing water," "wind-swept hair," or "dancing flames."
  - The prompt should be in English.
  - Do not describe concepts as "Real", "realistic", "photo", or "photograph" if they can't be real.
  - Choose the best image type and art style for the given keyword.
  - Do not use any words that are before : character in the prompt guidelines`;

  const userMessage = `Create a detailed description of the image, including all elements, styles, and enhancements for FLUX AI using the above formula with a ${keyword} as 'Subject Description' in prompt structure. The tone should be inspiring, clear, and precise.`;

  try {
    const response = await openai.chat.completions.create({
      model: "gpt-4o-mini", // Ensure this is the correct model name
      messages: [
        { role: "system", content: systemPrompt },
        { role: "user", content: userMessage }
      ],
      temperature: 0.7,
    });

    const generatedPrompt = response.choices[0].message.content;
    return generatedPrompt;
  } catch (error) {
    console.error("Error generating prompt:", error);
    return ""; // Return an empty string or a default prompt in case of error
  }
}

function shuffleArray(array) {
  for (let i = array.length - 1; i > 0; i--) {
    const j = Math.floor(Math.random() * (i + 1));
    [array[i], array[j]] = [array[j], array[i]];
  }
  return array;
}

module.exports = {
  paramsGeneratorModule
}