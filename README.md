# Automated AI Art Generation & Processing for POD and Stock Media

[![Donate via PayPal](https://img.shields.io/badge/Donate-PayPal-blue.svg?logo=paypal)](https://www.paypal.com/donate/?hosted_button_id=M554LA4SMCZ7G) [![Donate on Ko-fi](https://img.shields.io/badge/Donate-Ko--fi-red.svg?logo=ko-fi)](https://ko-fi.com/ascensum)

This Node.js script provides a complete solution for automating the creation and post-processing of AI-generated art, designed for creators on Print-on-Demand (POD) and stock media platforms.

It uses Midjourney (via PiAPI) for image generation, OpenAI's GPT-4o for intelligent quality control and metadata creation, and a suite of processing tools for professional-grade output.

## 🚀 Core Features

*   **Configurable Generation:** Control Midjourney's process mode (`relax`, `fast`, `turbo`), version, and aspect ratio.
*   **Intelligent Quality Control:** Uses OpenAI's Vision API to automatically check images for copyright/trademark issues, text, famous people, brands, and other disqualifying content.
*   **Advanced Image Processing:**
    *   Optional background removal via `remove.bg`.
    *   Optional aggressive trimming of transparent space.
    *   Optional image enhancement (sharpening, saturation).
    *   Convert output to high-quality JPG (with a choice of white or black background) or PNG.
*   **Dynamic Prompts:** Generate prompts using keywords from a text file and a customizable system prompt.
*   **CSV-Based Templating:** Powerful templating system for injecting structured data into prompts.
*   **Decoupled AI Features:** Independent control over quality checks and metadata generation for cost optimization.
*   **Full Configurability:** Nearly every setting can be controlled via command-line flags or a central `.env` file.
*   **Robust & Resilient:** Includes automatic retries for failed API calls and configurable timeouts for long-running jobs.
*   **Metadata Export:** Automatically generates an Excel spreadsheet (`.xlsx`) containing image paths and AI-generated titles and tags, ready for bulk uploading.
*   **Flying Upload Compatible:** Directly compatible with [Flying Upload](https://flyingresearch.net/) for multi-platform automation.

## 📋 Prerequisites

Before you begin, ensure you have the following:

1.  **Node.js:** Version 16 or higher is recommended. Download from [nodejs.org](https://nodejs.org/).
2.  **Git:** Used to clone the repository. Download from [git-scm.com](https://git-scm.com/).
3.  **API Keys:**
    *   **PiAPI (for Midjourney):** Get your key from [piapi.ai](https://piapi.ai/).
    *   **OpenAI:** Get your key from [openai.com](https://openai.com/). Ensure your account has access to the model you intend to use (e.g., `gpt-4o`, `gpt-4o-mini`).
    *   **Remove.bg (Optional):** Get your key from [remove.bg](https://www.remove.bg/) if you plan to use the background removal feature.

## 🛠️ Installation

1.  **Clone the repository:**
    ```bash
    git clone <your-repository-url>
    cd <repository-directory>
    ```

2.  **Install dependencies:**
    ```bash
    npm install
    ```

3.  **Create and configure your `.env` file:**
    In the project root, create a file named `.env` and add your configuration.

    ```
    # --- API Keys ---
    PIAPI_API_KEY=YOUR_PIAPI_API_KEY
    OPENAI_API_KEY=YOUR_OPENAI_API_KEY
    REMOVE_BG_API_KEY=YOUR_REMOVE_BG_API_KEY

    # --- Generation Settings ---
    PROCESS_MODE=relax # 'relax', 'fast', or 'turbo'
    ASPECT_RATIOS=1:1,16:9,9:16 # Comma-separated list
    MJ_VERSION=6.1 # e.g., '6.0', 'niji'
    OPENAI_MODEL=gpt-4o # e.g., 'gpt-4o', 'gpt-4o-mini'

    # --- Processing Flags ---
    REMOVE_BG=false
    IMAGE_CONVERT=false # Applies sharpen/saturate effects
    CONVERT_TO_JPG=false
    TRIM_TRANSPARENT_BACKGROUND=false

    # --- Quality & Format Settings ---
    REMOVE_BG_SIZE=auto # 'auto', 'preview', 'full', '50MP'
    JPG_BACKGROUND=white # 'white' or 'black'
    JPG_QUALITY=100 # 1-100
    PNG_QUALITY=100 # 1-100

    # --- AI System Prompts ---
    MJ_SYSTEM_PROMPT= # Path to custom Midjourney system prompt
    METADATA_SYSTEM_PROMPT= # Path to custom metadata generation prompt

    # --- AI Vision Control ---
    RUN_QUALITY_CHECK=true # Enable AI quality check (pass/fail)
    RUN_METADATA_GEN=true # Enable AI metadata generation (title/tags)

    # --- Script Behavior ---
    KEYWORD_RANDOM=false # true for random, false for sequential
    POLLING_TIMEOUT=15 # Max minutes to wait for image generation
    DEBUG_MODE=false # true for verbose logging
    ```

## 🎯 Usage

There are three ways to run the script, depending on your preference.

### 1. The Interactive Script (Recommended for Beginners)

For a guided experience, you can use the interactive `run.sh` script. It will ask you for the most common settings and build the command for you.

```bash
./run.sh
```

### 2. Direct Node Execution (Advanced)

Run the script directly with `node`, providing any command-line options to override the `.env` settings. This gives you access to all possible configuration flags.

```bash
node src/index.js [options]
```

### 3. Using Docker (Universal Setup)

If you have Docker installed, you can build and run the script in a self-contained environment. This is the most reliable method as it eliminates local setup issues.

1.  **Build the Docker image:**
    ```bash
    docker build -t art-generator .
    ```

2.  **Run the script inside the container:**
    You must pass your `.env` file to the container for it to access your API keys. The `--rm` flag automatically cleans up the container after it exits. The `-v` flag mounts your local `pictures` directory into the container, so the output files are saved to your machine.

    ```bash
    docker run --rm --env-file .env -v "$(pwd)/pictures:/usr/src/app/pictures" art-generator [options]
    ```
    **Example:** `docker run --rm --env-file .env -v "$(pwd)/pictures:/usr/src/app/pictures" art-generator -c 5 --processMode fast`

## 🔧 Key Command-Line Options

### Basic Options
*   `-c, --count <number>`: Number of images to generate. Defaults to `1`.
*   `-k, --keywordsFile <path>`: Path to a text file of keywords (one per line).
*   `-s, --mjSystemPrompt <path>`: Path to a custom system prompt for Midjourney.
*   `--metadataSystemPrompt <path>`: Path to a custom metadata generation system prompt.
*   `--qualityCheckPromptFile <path>`: Path to a custom quality check system prompt.

### AI Vision Control
*   `--runQualityCheck <boolean>`: Enable/disable AI quality check.
*   `--runMetadataGen <boolean>`: Enable/disable AI metadata generation.

### Generation Overrides
*   `--processMode <mode>`: `relax`, `fast`, or `turbo`.
*   `--aspectRatios <string>`: Comma-separated list (e.g., `16:9,4:5`).
*   `--mjVersion <version>`: e.g., `6.0`, `niji`.
*   `--openaiModel <model>`: e.g., `gpt-4o`, `gpt-4o-mini`.

### Processing Overrides
*   `--removeBg <boolean>`
*   `--imageConvert <boolean>` (apply effects)
*   `--convertToJpg <boolean>`
*   `--trimTransparentBackground <boolean>`
*   `--jpgBackground <color>`: `white` or `black`.
*   `--jpgQuality <1-100>`
*   `--pngQuality <1-100>`
*   `--removeBgSize <size>`: `auto`, `preview`, `full`, `50MP`.

### Behavior Options
*   `--keywordRandom <boolean>`: Random vs sequential keyword selection.
*   `--pollingTimeout <minutes>`: Maximum time to wait for image generation.
*   `--debugMode <boolean>`: Enable verbose logging.

## 🎨 Advanced Usage: CSV-Based Prompt Templating

For maximum control and flexibility, you can use a `.csv` file as your keywords source. This activates a powerful templating engine that allows you to inject structured data directly into your Midjourney system prompt.

### How It Works

1.  **Create a `.csv` Keywords File:** Your keywords file must have a header row. The headers will become your placeholder names (e.g., `MainSubject`, `Style`, `Setting`). Each subsequent row represents one generation task.
2.  **Create a System Prompt Template:** Your `--mjSystemPrompt` becomes a template. Use the placeholder syntax `${{HeaderName}}` to mark where the data from your CSV should be injected.
3.  **Run the Script:** The script will automatically detect the `.csv` file, read a row, and inject its data into your system prompt template before sending the final, customized instructions to the AI for prompt generation.

### Example

**1. `my_keywords.csv`:**
```csv
MainSubject,Style,CameraAngle
a majestic lion on the Serengeti,photorealistic,wide-angle shot
a futuristic robot in a neon city,cyberpunk art,low-angle shot
```

**2. `my_prompt_template.txt` (used with `--mjSystemPrompt`):**
```
You are an expert Midjourney prompt generator. Create one single, professional prompt.

The prompt must be about the following subject: ${{MainSubject}}.
The final image's aesthetic must be in the style of: ${{Style}}.
Capture the scene using a ${{CameraAngle}}.

Follow these rules:
- Include details about lighting and resolution (e.g., 8K, cinematic lighting).
- The final output must be a single line of text.
```

When the script runs with these files, it will dynamically create a unique set of instructions for the AI for each row in your CSV. The script will then automatically append the Midjourney version (e.g., `--v 6.1`) that you have configured via the `--mjVersion` flag or your `.env` file. This gives you incredible control over the final output.

## 🔍 Quality Check System

The quality check system has been redesigned to focus on copyright and trademark issues rather than technical image quality:

### What It Checks For:
- **Problematic Text/Typography:** Misspelled words, incorrect grammar, offensive language, or text that could cause legal issues
- **Famous People/Celebrities:** Any person who looks like a recognizable celebrity
- **Brand Logos/Trademarks:** Any recognizable brand logos or trademarked symbols
- **Copyrighted Characters:** Characters from movies, games, comics, etc.
- **Famous Buildings/Landmarks:** Recognizable famous buildings or monuments
- **Product Placement:** Any recognizable commercial products or brands
- **Watermarks:** Any watermarks, signatures, or ownership marks

### How It Works:
- **Passed Images:** Continue to full processing (background removal, metadata generation, etc.)
- **Failed Images:** Kept in `pictures/generated/` folder for manual review
- **User Control:** You can manually review failed images and decide if you want to use them
- **Cost Optimization:** Failed images don't incur additional processing costs

### Customizing Quality Check for Different Use Cases

The default quality check is designed for general stock photography. If you're creating specific types of designs, you may want to customize the quality check prompt:

#### For Typography Designs (T-shirts, Stickers, etc.)
If you're creating typography designs, the default prompt may be too strict. Create a custom quality check prompt file:

**Custom Quality Check Prompt Example:**
```
You are an AI content safety assessor for typography designs. Analyze the provided image for potential issues.

FOCUS ON THESE SPECIFIC ISSUES:
1. **Spelling/Grammar Errors**: Any misspelled words or incorrect grammar
2. **Offensive Content**: Any offensive, inappropriate, or controversial text
3. **Trademarked Phrases**: Any text that contains trademarked phrases or brand names
4. **Copyright Issues**: Any text that could infringe on copyrights
5. **Famous People/Brands**: Any recognizable celebrities or brand logos in the design

IMPORTANT: Well-designed typography with correct spelling and appropriate content should pass. Only fail if there are actual spelling errors, offensive content, or legal issues.

Your response must be a JSON object with these fields:
{
  "passed": boolean (true if NO issues found, false if ANY issues detected),
  "score": number (1-10, 1-3 for fails, 8-10 for passes),
  "reason": string (detailed explanation of what you found or why it's safe)
}
```

**Usage:**
```bash
node src/index.js -c 10 --qualityCheckPromptFile my_typography_qc_prompt.txt --runQualityCheck true
```

**Note:** A sample typography quality check prompt file (`typography_qc_prompt.txt`) is included in this repository for reference.

#### For Different Content Types
- **Abstract Art:** Focus on watermarks and ownership marks only
- **Product Photography:** Focus on brand logos and trademarked products
- **Character Designs:** Focus on copyrighted characters and famous people
- **Landscape Photography:** Focus on famous landmarks and watermarks

Create custom quality check prompts tailored to your specific use case for optimal results.

## 📊 AI System Prompts

You can customize the instructions given to the AI for two key tasks:

1.  **Midjourney Prompt Generation (`--mjSystemPrompt`):** This prompt guides the AI in creating the final prompt sent to Midjourney. You can use it to define a specific style, structure, or set of rules. See the "Advanced Usage: CSV-Based Prompt Templating" section for more details.

2.  **Metadata Generation (`--metadataSystemPrompt`):** This prompt instructs the AI on how to generate the title and tags for your image. You can specify the desired length of the title, the number of tags, and the overall style of the metadata.

If you don't provide a custom prompt, the script will use a built-in default for each task.

## 🍳 Recipes: Common Workflows

Here are some examples of how to combine flags to achieve specific goals.

### 1. Generate High-Quality PNG Stickers:
This runs the full pipeline: quality check, metadata generation, background removal, trimming, and enhancement.
```bash
node src/index.js -c 10 --processMode fast --runQualityCheck true --runMetadataGen true --removeBg true --trimTransparentBackground true --imageConvert true
```

### 2. Create JPGs for Stock Photography (Metadata Only):
This workflow skips the automated quality check (assuming you want to review the images manually) but uses the AI to generate titles and tags. It outputs high-quality JPGs.
```bash
node src/index.js -c 20 --processMode fast --runQualityCheck false --runMetadataGen true --convertToJpg true --jpgQuality 95
```

### 3. Ultra Cost-Saving Draft Mode:
This is the cheapest way to run a batch. It disables all expensive OpenAI Vision API calls and uses the cheaper `gpt-4o-mini` for prompt generation. It's ideal for generating a large number of drafts without high costs.
```bash
node src/index.js -c 50 --processMode relax --openaiModel gpt-4o-mini --runQualityCheck false --runMetadataGen false --pollingTimeout 30
```

### 4. Quality Check Only (Manual Review):
Generate images and run quality checks, but skip expensive metadata generation. Review failed images manually.
```bash
node src/index.js -c 15 --processMode fast --runQualityCheck true --runMetadataGen false --removeBg false
```

### 5. Typography Designs (T-shirts, Stickers):
Generate typography designs with custom quality check that allows legitimate text while catching spelling errors and problematic content.
```bash
node src/index.js -c 20 --processMode fast --runQualityCheck true --runMetadataGen true --qualityCheckPromptFile typography_qc_prompt.txt --removeBg true --trimTransparentBackground true
```

## ⏰ Background Scheduling

You can run this application in the background on a schedule using various methods:

### Linux/macOS (cron)
```bash
# Edit crontab
crontab -e

# Run every day at 2 AM
0 2 * * * cd /path/to/your/app && node src/index.js -c 5 --processMode fast

# Run every 6 hours
0 */6 * * * cd /path/to/your/app && node src/index.js -c 3 --processMode relax
```

### Windows (Task Scheduler)
1. Open Task Scheduler
2. Create Basic Task
3. Set trigger (daily, weekly, etc.)
4. Action: Start a program
5. Program: `node`
6. Arguments: `src/index.js -c 5 --processMode fast`
7. Start in: `C:\path\to\your\app`

### Docker with Cron
```dockerfile
# Add to your Dockerfile
RUN apt-get update && apt-get install -y cron
COPY crontab /etc/cron.d/app-cron
RUN chmod 0644 /etc/cron.d/app-cron
RUN crontab /etc/cron.d/app-cron
CMD ["cron", "-f"]
```

## 🖼️ Image Upscaling

This application does not include native upscaling as built-in upscaling is usually insufficient for professional use. For best results, we recommend using dedicated upscaling software:

### Recommended Upscaling Tools:
- **[Topaz Labs Gigapixel](https://www.topazlabs.com/)** - Professional AI upscaling up to 16x
- **[Topaz Labs Photo AI](https://www.topazlabs.com/)** - AI-powered image enhancement
- **[Topaz Labs Video AI](https://www.topazlabs.com/)** - Video upscaling and enhancement

### Workflow Integration:
1. Generate images with this application
2. Process failed images manually (if needed)
3. Upscale selected images with Topaz Labs tools
4. Upload to your platforms

## 🔗 Flying Upload Compatibility

This application is directly compatible with **[Flying Upload](https://flyingresearch.net/)**, the multi-platform upload tool. The Excel file generated by this application contains all the metadata needed for automated uploads across multiple platforms including:

- Merch by Amazon
- Redbubble
- Printful
- Printify
- Etsy
- Teepublic
- And many more

### Integration Steps:
1. Generate images and metadata with this application
2. Use Flying Upload to automatically upload to multiple platforms
3. Save time and scale your business efficiently

## 📁 Output Structure

*   **Initial Downloads:** `pictures/generated/`
*   **Final Processed Images:** `pictures/toupload/`
*   **Failed Quality Check Images:** `pictures/generated/` (kept for manual review)
*   **Metadata:** `pictures/toupload/redbubble_upload_data_YYYY_MM_DD.xlsx`

**Note on File Paths:** The Excel file contains only the filenames of the processed images (e.g., `my_image_1.jpg`). This is intentional. For any automated uploader to work correctly, the Excel file and the final images **must be in the same directory** (`pictures/toupload/`).

## ⚠️ Important Notes on Image Processing

*   **Trimming:** `--trimTransparentBackground true` is only effective when `--removeBg true` is also enabled. It has no effect if converting to JPG, as there is no transparency to trim. The script will automatically skip trimming and warn you in these cases.
*   **JPG Conversion:** When converting a transparent image to JPG, the transparency will be filled with the specified background color (`--jpgBackground`, defaults to `white`).
*   **Quality Check:** Failed images are preserved in the generated folder for manual review. Only passed images are processed further.

## 🔧 Troubleshooting

*   **API Errors (`Invalid response from...`):**
    *   Double-check that the API keys in your `.env` file are correct and have active billing/credits.
    *   Ensure your internet connection is stable.
*   **Image Generation Timeout:** If generations in `relax` mode frequently time out, increase the `POLLING_TIMEOUT` in your `.env` file or use the `--pollingTimeout` flag (e.g., `--pollingTimeout 30` for 30 minutes).
*   **Background Removal Fails:** The `remove.bg` service may sometimes fail to identify the foreground in complex images. The script will log this error and continue processing using the original image. This is expected behavior.
*   **Poor Quality Results:** If the AI-generated prompts or images are not meeting your expectations, refine your system prompt(s). Provide more specific instructions or examples in your custom prompt files (`--mjSystemPrompt`, `--metadataSystemPrompt`).
*   **Quality Check Issues:** If quality checks are failing unexpectedly, you can disable them with `--runQualityCheck false` and review images manually.

## 📞 Support and Contact

This project is provided as-is. I developed it for my own use and have open-sourced it in the hope that it may be useful to others.

### Social Media
You can reach out to me on the following platforms regarding this repository:

- **Facebook:** [Vjatseslav Jertsalov](https://www.facebook.com/vjatseslav.jertsalov/)
- **Discord:** [Join my Discord Server](https://discord.gg/KNnVz77e)

*Note: Please replace the placeholder links with your actual social media accounts.*

### Support Options
Please note that I am not committing to providing ongoing support, feature updates, or accepting pull requests. You are, however, completely free to fork this repository and adapt it for your own needs as you see fit under the terms of the MIT License.

If you find this tool valuable and wish to show your appreciation, a small donation for a coffee is always welcome! Your support is greatly appreciated.

*   **[Buy Me a Coffee via PayPal](https://www.paypal.com/donate/?hosted_button_id=M554LA4SMCZ7G)**
*   **[Support me on Ko-fi](https://ko-fi.com/ascensum)**

---

### 📄 License

This project is open-source and available under the [MIT License](LICENSE).

### 🙏 Credits and Acknowledgements

This project was originally based on the work of [Freezeraid/redbubble-automation](https://github.com/Freezeraid/redbubble-automation). While the codebase has been significantly refactored and enhanced with many new features, the initial foundation provided by the original repository was instrumental.

