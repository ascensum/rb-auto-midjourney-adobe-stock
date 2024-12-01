const robot = require('robotjs');

function logMousePosition() {
    const mouse = robot.getMousePos();
    console.clear();  // This clears the console to avoid cluttering
    console.log(`Current mouse position: x=${mouse.x}, y=${mouse.y}`);
    setTimeout(logMousePosition, 100);  // Update every 100ms
}

console.log("Move your mouse to the desired position. Press Ctrl+C to exit.");
logMousePosition();