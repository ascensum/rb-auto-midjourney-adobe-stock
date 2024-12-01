const fs = require("fs").promises;
const path = require("path");
const ExcelJS = require('exceljs');
const { pause } = require("./utils");
const { paramsGeneratorModule } = require("./paramsGeneratorModule");
const { producePictureModule } = require("./producePictureModule");
require("dotenv").config();

// Add these lines right here
const projectRoot = path.join(__dirname, '..');
const uploadDir = path.join(projectRoot, 'pictures', 'toupload');

async function createExcelFile(data, fileName) {
    const workbook = new ExcelJS.Workbook();
    const worksheet = workbook.addWorksheet('Sheet1');

    worksheet.columns = [
        { header: 'Image Path', key: 'imagePath', width: 30 },
        { header: 'Language', key: 'language', width: 10 },
        { header: 'Title', key: 'title', width: 30 },
        { header: 'Description', key: 'description', width: 50 },
        { header: 'Tags', key: 'tags', width: 30 },
        { header: 'Type', key: 'type', width: 15 },
        { header: 'Color', key: 'color', width: 15 }
    ];

    // Modify the data to use relative paths
    const modifiedData = data.map(item => ({
        ...item,
        imagePath: path.basename(item.imagePath)
    }));

    modifiedData.forEach(item => worksheet.addRow(item));

    try {
        await workbook.xlsx.writeFile(fileName);
        console.log(`Excel file created successfully: ${fileName}`);
    } catch (error) {
        console.error(`Error writing Excel file: ${error.message}`);
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
    try {
        const today = new Date();
        const formattedDate = today.toISOString().slice(0, 10).replace(/-/g, '.');
        const timeStr = today.toTimeString().slice(0, 8);

        const launchDate = new Date(process.env.START_DATE);
        const waitingDays = 7;
        
        let difference = -Math.floor((today - launchDate.setDate(launchDate.getDate() + waitingDays)) / (1000 * 60 * 60 * 24));
        if (difference > 0) {
            console.log(`Still waiting at least ${difference} days for the store to be online.`);
            return;
        }

        if (process.env.USE_RANDOM_DELAY === 'true') {
            const maxDelaySeconds = 5 * 60;
            console.log("Random timeout to pass bot detection...");
            await pause(true, maxDelaySeconds);
        }
        
        console.log("Script starts now");

        const excelData = [];
        const itemCount = 30;

        // Ensure the redbubble_upload_data directory exists
        await ensureDirectoryExists(uploadDir);

        let successfulItems = 0;

        for (let i = 0; i < itemCount; i++) {
            console.log(`Starting item ${i + 1} of ${itemCount}`);
            
            try {
                console.log(`Generating item ${i + 1} of ${itemCount}`);
                
                let pictureSettings;
                try {
                    pictureSettings = await paramsGeneratorModule();
                    console.log("Picture settings before calling producePictureModule:", JSON.stringify(pictureSettings, null, 2));
                    if (pictureSettings.error) {
                        throw new Error(pictureSettings.error);
                    }
                } catch (error) {
                    console.error(`Error generating picture settings for item ${i + 1}:`, error.message);
                    continue;
                }
                
                const imgName = `${formattedDate.replace(/\./g, '')}_${timeStr.replace(/:/g, '')}_${i + 1}`;
                console.log("Generating picture with Flux .1 dev ...");
                
                let producePictureResult;
                try {
                    console.log("Calling producePictureModule");
                    producePictureResult = await producePictureModule(pictureSettings, imgName);
                    console.log(`Full result from producePictureModule for item ${i + 1}:`, JSON.stringify(producePictureResult, null, 2));
            
                    if (producePictureResult.error) {
                        throw new Error(producePictureResult.error);
                    }
            
                    if (!producePictureResult.outputPath || !producePictureResult.analysisResult) {
                        throw new Error('Invalid result structure from producePictureModule');
                    }
            
                    const { outputPath, analysisResult } = producePictureResult;
            
                    if (!analysisResult.new_title || !analysisResult.new_description || !analysisResult.uploadTags) {
                        console.error(`Incomplete analysis result for item ${i + 1}:`, analysisResult);
                        continue;
                    }
            
                    const fullImagePath = path.resolve(outputPath);
                    excelData.push({
                        imagePath: fullImagePath,
                        language: "EN",
                        title: analysisResult.new_title.en,
                        description: analysisResult.new_description.en,
                        tags: analysisResult.uploadTags.en,
                        type: "man, woman",
                        color: "black"
                    });
            
                    console.log(`Successfully processed item ${i + 1} of ${itemCount}`);
                    successfulItems++;
                } catch (error) {
                    console.error(`Error in producePictureModule for item ${i + 1}:`, error.message);
                    continue;
                }
            } catch (error) {
                console.error(`Error in main loop for item ${i + 1}:`, error);
            }
        }
        
        if (excelData.length > 0) {
            const excelFileName = path.join(uploadDir, `redbubble_upload_data_${formattedDate.replace(/\./g, '_')}.xlsx`);
            try {
                await createExcelFile(excelData, excelFileName);
            } catch (error) {
                console.error("Failed to create Excel file:", error);
            }
        } else {
            console.log("No valid items generated. Excel file not created.");
        }
       
        console.log(`Total items attempted: ${itemCount}`);
        console.log(`Total successful items: ${successfulItems}`);
        console.log(`Total items in excelData: ${excelData.length}`);
                
    } catch (error) {
        console.error("ERROR: An error occurred during script execution", error);
    }
})();