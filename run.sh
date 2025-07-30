#!/bin/bash

# Simple interactive script to run the AI art generator

echo "--- AI Art Generator ---"

# --- Configuration ---
COUNT=1
KEYWORDS_FILE=""
PROCESS_MODE="fast"
REMOVE_BG="false"
CONVERT_TO_JPG="false"
DEBUG_MODE="true"

# --- User Input ---
read -p "How many images to create? (default: 1): " count_input
if [[ ! -z "$count_input" ]]; then
    COUNT=$count_input
fi

read -p "Path to keywords file? (leave blank for default): " keywords_input
if [[ ! -z "$keywords_input" ]]; then
    KEYWORDS_FILE="--keywordsFile $keywords_input"
fi

read -p "Process mode? (relax/fast/turbo) (default: fast): " mode_input
if [[ ! -z "$mode_input" ]]; then
    PROCESS_MODE=$mode_input
fi

read -p "Enable background removal? (y/n) (default: n): " remove_bg_input
if [[ "$remove_bg_input" == "y" ]]; then
    REMOVE_BG="--removeBg true"
else
    REMOVE_BG="--removeBg false"
fi

read -p "Convert to JPG? (y/n) (default: n): " convert_jpg_input
if [[ "$convert_jpg_input" == "y" ]]; then
    CONVERT_TO_JPG="--convertToJpg true"
else
    CONVERT_TO_JPG="--convertToJpg false"
fi

# --- Construct and run the command ---
CMD="node src/index.js --count $COUNT --processMode $PROCESS_MODE $KEYWORDS_FILE $REMOVE_BG $CONVERT_TO_JPG --debugMode $DEBUG_MODE"

echo ""
echo "Executing command:"
echo "$CMD"
echo ""

eval $CMD 