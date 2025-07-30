const { OpenAI } = require("openai");
const path = require('path');
const { logDebug } = require('./utils/logDebug');
require('dotenv').config();

async function paramsGeneratorModule(
  keywordsData,
  customSystemPrompt,
  keywordFilePath,
  config = {}
) {
  const { keywordRandom, openaiModel, mjVersion } = config;

  const openai = new OpenAI({
    apiKey: process.env.OPENAI_API_KEY,
  });

  try {
    let systemPrompt;
    let userPrompt;
    let selectedKeyword = ''; // For promptContext

    // --- CSV Templating Logic ---
    if (typeof keywordsData === 'object' && !Array.isArray(keywordsData)) {
      logDebug('CSV data detected. Using templating engine.');
      const selectedRow = keywordsData; // Already selected in index.js

      logDebug('Selected CSV row:', selectedRow);

      // Use the custom system prompt as the template
      if (!customSystemPrompt) {
        throw new Error('System prompt template is required for CSV mode');
      }

      // Replace variables in the system prompt template
      systemPrompt = customSystemPrompt;
      for (const header in selectedRow) {
        const placeholder = new RegExp(`\\$\\{\\{${header}\\}\\}`, 'g');
        systemPrompt = systemPrompt.replace(placeholder, selectedRow[header]);
      }
      
      // Store the first column value for context
      selectedKeyword = selectedRow[Object.keys(selectedRow)[0]];
      
      // Set up the user prompt
      userPrompt = 'Generate one prompt now based on your instructions.';
      
      logDebug('Final system prompt after template processing:', systemPrompt);
    } 
    // --- TXT Logic ---
    else {
      logDebug('TXT data detected. Using standard keyword logic.');
      let keywords = Array.isArray(keywordsData) ? keywordsData : [keywordsData];
      selectedKeyword = keywords[0]; // Already selected in index.js

      logDebug('Selected keyword:', selectedKeyword);

      if (customSystemPrompt) {
        // If we have a template, use it with the keyword as Subject
        systemPrompt = customSystemPrompt.replace(/\$\{\{Subject\}\}/g, selectedKeyword);
        // Set empty values for other template variables
        systemPrompt = systemPrompt
          .replace(/\$\{\{Setting\}\}/g, '')
          .replace(/\$\{\{Style\}\}/g, '')
          .replace(/\$\{\{Mood\}\}/g, '');
        userPrompt = 'Generate one prompt now based on your instructions.';
      } else {
        systemPrompt = `You are an assistant creating high-quality stock photo prompts for an AI image generator. Your response must be a single JSON object with one key: "prompt". The prompt should describe a stock photo image based on the provided keywords. The prompt must be in a single line and in English.`;
        userPrompt = `Create a prompt for this keyword: ${selectedKeyword}`;
      }
    }

    const completion = await openai.chat.completions.create({
      model: openaiModel,
      messages: [
        { role: "system", content: systemPrompt },
        { role: "user", content: userPrompt }
      ],
      temperature: 0.7,
    });

    const response = completion.choices[0].message.content;
    logDebug('OpenAI response:', response);

    let parsedResponse;
    try {
      // Remove any markdown code blocks and trim whitespace
      const cleanedResponse = response.replace(/```json\n|\n```|```/g, '').trim();
      
      // Try to parse as JSON first
      try {
        parsedResponse = JSON.parse(cleanedResponse);
      } catch (jsonError) {
        // If it's not JSON, check if it's a quoted string
        if (cleanedResponse.startsWith('"') && cleanedResponse.endsWith('"')) {
          // Remove the quotes and use as prompt
          parsedResponse = { prompt: cleanedResponse.slice(1, -1) };
        } else {
          // Use as-is
          parsedResponse = { prompt: cleanedResponse };
        }
      }
    } catch (error) {
      logDebug('Error processing response. Using raw response as prompt.');
      parsedResponse = { prompt: response };
    }

    // Add version to the prompt if specified
    const versionSuffix = mjVersion ? ` --v ${mjVersion}` : '';
    parsedResponse.prompt += versionSuffix;

    return {
      prompt: parsedResponse.prompt,
      promptContext: selectedKeyword
    };

  } catch (error) {
    console.error('Error in paramsGeneratorModule:', error);
    throw error;
  }
}

module.exports = { paramsGeneratorModule };