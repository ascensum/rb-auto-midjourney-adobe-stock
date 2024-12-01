const fs = require('fs');
const path = require('path');
const dotenv = require('dotenv');
dotenv.config();

function processTrendingKeywordsDataModule() {
    const currentDate = new Date().toISOString().split('T')[0].replace(/-/g, '.');
    const inputDirPath = path.resolve(process.env.FILE_PATH || 'src/keywords_data_raw');
    let inputFilePath = path.join(inputDirPath, `trending_keywords_data_raw_${currentDate}.json`);
    
    try {
        if (!fs.existsSync(inputFilePath)) {
            console.log("Today's trending keywords file not found. Using the most recent file.");
            const files = fs.readdirSync(inputDirPath);
            const mostRecentFile = files
                .filter(file => file.startsWith('trending_keywords_data_raw_'))
                .sort((a, b) => fs.statSync(path.join(inputDirPath, b)).mtime.getTime() - 
                                fs.statSync(path.join(inputDirPath, a)).mtime.getTime())[0];
            
            if (!mostRecentFile) {
                throw new Error("No trending keywords data files found.");
            }
            
            inputFilePath = path.join(inputDirPath, mostRecentFile);
        }

        const data = JSON.parse(fs.readFileSync(inputFilePath, 'utf8'));
        if (!Array.isArray(data)) {
            throw new Error("Data is not in the expected format (array).");
        }

        const filteredData = data.filter(item => {
            if (!item || typeof item !== 'object') return false;
            const avgMonthlySearches = parseInt(item["Avg. Monthly Searches"]?.replace(/,/g, ''), 10);
            const result = parseInt(item["Result"], 10);
            return !isNaN(avgMonthlySearches) && !isNaN(result) &&
                   avgMonthlySearches > 0 && avgMonthlySearches <= 1000000 && 
                   result >= 10 && result <= 1000000;
        });

        const trendingKeywords = filteredData.map(item => item.Keyword).filter(Boolean);
        return trendingKeywords;
    } catch (error) {
        console.error('Error processing trending keywords data:', error);
        return []; // Return an empty array if there's an error
    }
}

module.exports = processTrendingKeywordsDataModule;