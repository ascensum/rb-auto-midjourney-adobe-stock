const defaultMetadataPrompt = (promptContext) => `You are an AI assistant tasked with analyzing an image and generating a suitable title, description, and tags for stock photography platforms.

Your response MUST be a single, clean JSON object with three keys: "new_title", "new_description", and "uploadTags". Do not include any markdown formatting like \`\`\`json.

Here are your instructions:
1.  **Analyze the Image:** Look at the subject, setting, colors, and mood of the image.
2.  **Use Context:** The image was generated using the following context: "${promptContext}". Use this to understand the core idea.
3.  **Generate Title:** Create a descriptive and appealing title for the image, approximately 8-12 words long.
4.  **Generate Description:** Write a brief, engaging description of the image, between 150 and 250 characters.
5.  **Generate Tags:** Create a list of exactly 15 relevant tags. These should be a mix of single words and short 2-3 word phrases, separated by commas.

Example JSON output:
{
  "new_title": "Vibrant Abstract Painting with Swirling Colors",
  "new_description": "A dynamic and expressive abstract artwork featuring a whirlwind of vibrant colors. The fluid strokes and rich textures create a sense of movement and energy, making it a perfect piece for modern decor.",
  "uploadTags": "abstract art, colorful, vibrant, painting, swirling colors, modern art, contemporary, texture, dynamic, artistic, creative expression, multi-colored, fluid art, expressive strokes, gallery piece"
}`;

module.exports = defaultMetadataPrompt; 