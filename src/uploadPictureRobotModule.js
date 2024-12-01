const { exec } = require('child_process');
const robot = require('robotjs');
const fs = require('fs').promises;
const path = require('path');
const sharp = require("sharp");
/**
 * Upload generated and enhanced picture to your redbubble account
 * 
 * @param {object} parsedAnalysisResult Picture settings determined by ChatGPT
 * @param {string} outputPath picture path
 */


const COORDINATES = {
  POD_UPLOAD_FREE: { x: 605, y: 453 },  // Replace with your actual coordinates
  EDIT_BUTTON: { x: 535, y: 519 },      // Replace with your actual coordinates
  UPLOAD_BUTTON: { x: 927, y: 530 },     // Replace with your actual coordinates
  LOAD_BUTTON: { x: 221, y: 127 }
};

async function takeScreenshot(filename) {
  const screenshot = robot.screen.capture();
  await sharp(screenshot.image, {
    raw: {
      width: screenshot.width,
      height: screenshot.height,
      channels: 4
    }
  }).png().toFile(filename);
  console.log(`Screenshot saved: ${filename}`);
}

async function uploadPictureRobotModule(outputPath, analysisResult) {

  console.log()

  try {
    console.log("Starting uploadPictureRobotModule...");
    await launchApplication("Flying Upload Launcher");
    
    console.log("Waiting for application to open...");
    await new Promise(resolve => setTimeout(resolve, 15000));  // Increased to 15 seconds

    console.log("Clicking POD upload Free version square...");
    robot.moveMouse(COORDINATES.POD_UPLOAD_FREE.x, COORDINATES.POD_UPLOAD_FREE.y);
    robot.mouseClick();
    await takeScreenshot('after_pod_click.png');
    
    console.log("Waiting for second screen...");
    await new Promise(resolve => setTimeout(resolve, 10000));  // Increased to 8 seconds

    console.log("Attempting to click Edit button...");
    await takeScreenshot('before_edit_click.png');
    robot.moveMouse(COORDINATES.EDIT_BUTTON.x, COORDINATES.EDIT_BUTTON.y);
    robot.mouseClick();
    await takeScreenshot('after_edit_click.png');
    
    console.log("Waiting after Edit button click...");
    await new Promise(resolve => setTimeout(resolve, 8000));

    console.log("Clicking Load button...");
    robot.moveMouse(COORDINATES.LOAD_BUTTON.x, COORDINATES.LOAD_BUTTON.y);
    robot.mouseClick();
    await new Promise(resolve => setTimeout(resolve, 3000));

    console.log("Inputting file path...");

    // Use Command+Shift+G to open "Go to folder" dialog
    robot.keyTap('g', ['command', 'shift']);
    await new Promise(resolve => setTimeout(resolve, 1000));

    // Type the full path to the file
    robot.typeString(path.dirname(outputPath));
    robot.keyTap('enter');
    await new Promise(resolve => setTimeout(resolve, 2000));

    // Select the file
    robot.typeString(path.basename(outputPath));
    await new Promise(resolve => setTimeout(resolve, 1000));
    robot.keyTap('enter');
    await new Promise(resolve => setTimeout(resolve, 3000));

    // ... rest of the function ...

    console.log('Upload process completed');
  } catch (error) {
    console.error("Error in uploadPictureRobotModule:", error);
  }
}

function launchApplication(appName) {
  return new Promise((resolve, reject) => {
    exec(`open -a "${appName}"`, (error, stdout, stderr) => {
      if (error) {
        console.error(`Error launching ${appName}: ${error}`);
        reject(error);
      } else {
        console.log(`${appName} launched successfully`);
        resolve();
      }
    });
  });
}


module.exports = {
  uploadPictureRobotModule,
};
