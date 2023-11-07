/*
@TODO: 
- add the ability to take in a UUID and run tasks on that image
-̶ a̶d̶d̶ q̶u̶e̶s̶t̶i̶o̶n̶ t̶o̶ e̶a̶c̶h̶ m̶o̶d̶e̶ t̶o̶ a̶s̶k̶ i̶f̶ y̶o̶u̶ w̶a̶n̶t̶ t̶o̶ s̶a̶v̶e̶ t̶h̶e̶ q̶u̶a̶d̶ f̶i̶l̶e̶s̶
-̶ a̶d̶d̶ q̶u̶e̶s̶t̶i̶o̶n̶ t̶o̶ e̶a̶c̶h̶ m̶o̶d̶e̶ t̶o̶ a̶s̶k̶ i̶f̶ t̶h̶e̶ u̶s̶e̶r̶ w̶a̶n̶t̶s̶ t̶o̶ s̶a̶v̶e̶ a̶n̶y̶ f̶i̶l̶e̶s̶ o̶r̶ j̶u̶s̶t̶ r̶u̶n̶ t̶h̶e̶ b̶o̶t̶
- add question to each mode to ask if you want to use a custom folder and sequential naming
- add feature to upload an image to Midjourney and run it with a keyword. Perhaps have a list 
    of keywords to choose from, or run the whole list.
- fix issue with modify t̶h̶e̶m̶e̶, prompts, and options not returning to the main menu
- add suggestions when modifying prompts, t̶h̶e̶m̶e̶s̶, and options
-̶ c̶l̶e̶a̶r̶ s̶c̶r̶e̶e̶n̶ a̶n̶d̶ r̶e̶d̶r̶a̶w̶ i̶n̶t̶r̶o̶ w̶h̶e̶n̶ t̶h̶e̶ m̶j̶.̶m̶a̶i̶n̶ p̶r̶o̶c̶e̶s̶s̶ s̶t̶a̶r̶t̶s̶
-̶ N̶e̶e̶d̶ t̶o̶ a̶d̶d̶ l̶o̶g̶i̶c̶ t̶o̶ d̶e̶t̶e̶r̶m̶i̶n̶e̶ i̶f̶ t̶o̶k̶e̶n̶ i̶s̶ v̶a̶l̶i̶d̶
-̶ O̶n̶c̶e̶ w̶e̶ s̶t̶a̶r̶t̶ r̶u̶n̶n̶i̶n̶g̶ a̶ j̶o̶b̶,̶ i̶f̶ t̶h̶e̶ u̶p̶s̶c̶a̶l̶e̶r̶ i̶s̶ s̶t̶i̶l̶l̶ r̶u̶n̶n̶i̶n̶g̶ w̶h̶e̶n̶ a̶l̶l̶ t̶h̶e̶ j̶o̶b̶s̶ f̶i̶n̶i̶s̶h̶,̶ 
    w̶a̶i̶t̶ f̶o̶r̶ t̶h̶e̶ u̶p̶s̶c̶a̶l̶e̶r̶ t̶o̶ f̶i̶n̶i̶s̶h̶ b̶e̶f̶o̶r̶e̶ g̶o̶i̶n̶g̶ b̶a̶c̶k̶ t̶o̶ t̶h̶e̶ m̶a̶i̶n̶ m̶e̶n̶u̶


*/


// Import necessary libraries and modules
import { MidjourneyDiscordBridge } from "midjourney-discord-bridge"; // Importing the 'MidjourneyDiscordBridge' class from a package.
import axios from "axios"; // Importing the 'axios' library for making HTTP requests.
import sharp from 'sharp'; // Importing the 'sharp' library for image processing.
import fs from 'fs'; // Importing the 'fs' library for file system operations.
import { ChatGPTAPI } from 'chatgpt'; // Importing the 'ChatGPTAPI' class from a package.
import { select, input, confirm, Separator } from '@inquirer/prompts'; // Importing functions for interactive command-line prompts.
import chalk from 'chalk'; // Importing 'chalk' for terminal text styling.
import figlet from 'figlet'; // Importing 'figlet' for creating ASCII art text.
import stringifyObject from 'stringify-object'; // Importing a module for converting objects to strings.
import Discordie from "discordie"; // Importing the 'Discordie' library for Discord bot functionality.
// import express from "express"; // Importing the 'express' library for creating a web server.
import Upscaler from 'ai-upscale-module'; // Importing the 'Upscaler' class from a package.
import EXIF from 'exiftool-js-read-write';
import puppeteer from 'puppeteer';
import * as cheerio from 'cheerio';
import DiscordImageUploader from "discordimageuploader";

try {
    process.stdout.write(String.fromCharCode(27) + "]0;" + "Midjourney Automata - Discord Bot" + String.fromCharCode(7)); // Set the title of the terminal window to "Midjourney Automata - Discord Bot
} catch (err) {
    console.log("Error setting terminal title: ", err);
}
console.log("Starting Midjourney Discord Bot...");
let experimentalChatPromptEnabled = true;
let exifToolLoggingEnabled = false;

/**
 * @type {DiscordImageUploader}
 */
let discordUploader = null;

let doLoginEnabled = true;

// Define a set of question messages for prompts
const questionMessages = {
    SENDTOCHATGPT: "Do you want to send your prompt to ChatGPT? The response will be sent as is to MJ.",
    SAVEQUADS: "Do you want to save the quad files?",
    SAVEUPSCALES: "Do you want to save the upscaled images?",
    CUSTOMFILENAME: "Use custom folder and sequential naming?",
    PROMPT: "What is your prompt?",
    GENERATIONS: "How many runs per prompt do you want to run?",
    UPSCALE: "How many generations of upscaling do you want to allow? (Initial run + # of variation runs + # of zoom runs)",
    VARIATION: "How many generations of variations do you want to allow? (Started from the initial run)",
    ZOOM: "How many generations of zoom out do you want to allow? (Cumulative of all MJ upscales)",
    MJUPSCALE: "Do you want to call the Midjourney x4 upscaler on the upscaled images?",
    FOLDER: "What is your folder name?",
    READY: "Ready to run?",
    THEME: 'What are your theme keywords? (comma separated)',
    AIUPSCALE: 'Do you want to run additional AI upscale on the images? (This may take a long time)'
};

const loggerTitle = {
    MJ: "Midjourney log",
    exifTool: "EXIF Tool",
    runner: "Runner log",
};

const MJLogger_runner = (data) => {
    MJlogger({ title: loggerTitle.runner, text: data, line: 1, jsonStringify: false });
}
const MJlogger_MJbridge = (data) => {
    MJlogger({ title: loggerTitle.MJ, text: data, line: 6, jsonStringify: false });
}
const MJLogger_exifTool = (data) => {
    MJlogger({ title: loggerTitle.exifTool, text: data, line: 20, jsonStringify: true });
}

// Initialize a variable to control logging
let MJloggerEnabled = false;

// Create an instance of the 'Upscaler' class with a default output path
let upscaler = new Upscaler({ defaultOutputPath: "output/upscaled/" });

let exifTool = new EXIF((...data) => {
    if (exifToolLoggingEnabled) MJLogger_exifTool({ ...data });
});

// Define a destination path for the upscaled images to be used later
const upscaleDest = "output/upscaled/";

class MJ_imgInfo {
    constructor(uuid) {
        this.UUID = uuid;
        this.imageData = {};
        this.imageDataIsSet = false;
    }

    async getInfoFromServer() {
        // TODO: as it turns out, you have to be logged into Midjourney website to get the job status. So this is not going to work with fetch. Maybe try it with puppeteer or axios?
        // const jobStatusResponse = await fetch("https://www.midjourney.com/api/app/job-status/", {
        //     method: "POST",
        //     headers: { "Content-Type": "application/json" },
        //     body: JSON.stringify({ jobIds: ["\""+this.uuid+"\""] }),
        // });
        // this.imageData = await jobStatusResponse.json();

        this.imageDataIsSet = true;
    }
}

class MJ_Handler {

    constructor(config) {
        // initialize the config and check for required values. Throw an error if any are missing.
        if (config == null || config == undefined) throw new Error("Configuration must be provided");
        this.config = config;
        if (this.config.token == null || this.config.token == undefined) throw new Error("Token must be provided");
        if (this.config.guild_id == null || this.config.guild_id == undefined) throw new Error("Guild ID must be provided");
        if (this.config.channel_id == null || this.config.channel_id == undefined) throw new Error("Channel ID must be provided");
        this.mj = new MidjourneyDiscordBridge(config.token, config.guild_id, config.channel_id, 20);
        this.runningProcess = false;
        this.killCalled = false;
    }

    // register a callback function to be called when the MJ logger is called
    registerMJLoggerCB(cb) {
        this.mj.registerLoggerCB(cb);
        this.logger = cb;
    }

    // close the MJ instance
    async close() {
        await this.mj.close();
    }

    // kill the current process
    async killProcess() {
        this.killCalled = true;
    }

    // check if the kill process was called and exit the loop if it was
    breakout() {
        if (this.killCalled) {
            this.runningProcess = false;
            this.killCalled = false;
            //this.mj.close();
        }
        return this.runningProcess;
    }

    async writeEXIFdataToPNG(filePath, MJ_imgObj) {
        // TODO: see https://chat.openai.com/c/dd7488f2-733b-444f-a350-d8fa9a5c64fe for info on custom tags
        // await MJ_imgObj.getInfoFromServer();
        // while(!MJ_imgObj.imageDataIsSet) {
        //     await waitSeconds(1);
        // }
        // console.log("MJ_imgObj: ", MJ_imgObj); 
        // let data = {};
        // data.document = "Midjourney";
        // data.comment = "Prompt: " + MJ_imgObj.prompt;
        // data.label = MJ_imgObj.UUID;
        // data.make = MJ_imgObj.parentUUID;
        // data.artist = MJ_imgObj.theme;
        //exifTool.setExifData(filePath, true, false, data).then((res) => { MJLogger_exifTool({ res }); }).catch((err) => { MJLogger_exifTool({ err }); });

        // TODO: finish this
        // let keywordsString = "";
        // convert the keywords array to a string
        // keywords.forEach((k) => {
        //     keywordsString += k + ", ";
        // });
        // keywordsString = keywordsString.substring(0, keywordsString.length - 2); // remove the last comma and space

    }

    /**
     * Run an infinite zoom loop, calling for a random upscale and then a zoom out
     * @param {string} MJprompt - The prompt to send to Midjourney
     * @param {boolean} saveQuadFiles - Whether to save the quad files
     * @param {boolean} autoNameFiles - Whether to automatically name using a counter or to use the name from the prompt / url
     * @param {string} folder - The folder name to save the files to. defaults to output
     * @param {boolean} aiUpscale - Whether to run an additional local AI upscaling on the images
     * @param {boolean} saveUpscales - Whether to save the upscaled images
     * @returns {Promise<void>} - Returns a promise that resolves when the function is killed
     */
    async infiniteZoom(MJprompt, saveQuadFiles = true, autoNameFiles = false, folder = "", aiUpscale = false, saveUpscales = true) {
        return new Promise(async (resolve, reject) => {
            // set the running process flag to true
            this.runningProcess = true;

            let parentUUID = "";
            // send the prompt to Midjourney and wait for the response. img is an object holding the response
            let img = await this.mj.generateImage(MJprompt, (obj, progress) => {
                // if the progress is not null, print it to the console
                if (progress != null) {
                    // process.stdout.write(progress + "%  ");
                    this.logger(progress + "  ");
                }
                // check if the kill process was called and exit the loop if it was
                this.breakout();
            });
            if (img == null) {
                this.logger("Initial Midjourney image generation failed.");
                await waitSeconds(2);
                return;
            }
            parentUUID = img.uuid.value;
            // at this point, we need to check if the kill process was called and exit the loop if it was
            if (!this.breakout()) resolve();
            // console.log("\nInitial Midjourney image generation completed\n");
            this.logger("Initial Midjourney image generation completed");
            // if saveQuadFiles is true, save the quad files
            if (saveQuadFiles) this.makeFileFromIMGobj(img).then(async (res) => {
                await this.writeEXIFdataToPNG(res, keywords);
            });
            // set the image to zoom to the initial image
            let imgToZoom = img;
            let imgToScale = img;
            // set the filename base to the folder name
            let filenameBase = folder + "/";
            // check to see if the folder exists, if not, create it
            try {
                if (!fs.existsSync("output/" + filenameBase)) {
                    fs.mkdirSync("output/" + filenameBase);
                }
            } catch (err) {
                console.log(err);
            }
            // set the file count to 1, used for naming the files when autoNameFiles is true
            let fileCount = 1;
            // loop while the running process flag is true
            while (this.runningProcess) {
                // if the kill process was called, exit the loop
                if (!this.breakout()) {
                    resolve();
                    break;
                }
                // generate a filename using the file count and the filename base
                let fileCountString = fileCount.toString().padStart(4, "0");
                let filename = filenameBase + fileCountString;
                // generate random number between 1 and 4
                let random1to4 = Math.floor(Math.random() * 4) + 1;
                // upscale the image (random 1 to 4), and send the breakout function as a callback
                imgToZoom = await this.mj.upscaleImage(imgToScale, random1to4, img.prompt, this.breakout);
                if (imgToZoom == null) break;
                // at this point, we need to check if the kill process was called and exit the loop if it was
                if (!this.breakout()) {
                    resolve();
                    break;
                }
                if (saveUpscales) {
                    // save the upscaled image and then AI upscale it again if aiUpscale is true
                    this.makeFileFromIMGobj(imgToZoom, autoNameFiles ? filename : "", aiUpscale);
                }
                // run the zoom out function and send the breakout function as a callback
                imgToScale = await this.mj.zoomOut(imgToZoom, img.prompt, this.breakout);
                if (imgToScale == null) break;
                // at this point, we need to check if the kill process was called and exit the loop if it was
                if (!this.breakout()) {
                    resolve();
                    break;
                }
                // if saveQuadFiles is true, save the quad files. Do not run AI upscale on the quad files
                if (saveQuadFiles) this.makeFileFromIMGobj(imgToScale, autoNameFiles ? filename : "");
                // increment the file count for auto naming
                fileCount++;
            }
        });
    }

    // run an infinite prompt->variation->upscale loop
    // MJprompt: the prompt to send to Midjourney
    // saveQuadFiles: whether to save the quad files
    // autoNameFiles: whether to automatically name using a counter or to use the name from the prompt / url
    // folder: the folder name to save the files to. defaults to output
    // cb: unused?
    // aiUpscale: whether to run an additional AI upscale on the images
    infinitePromptVariationUpscales(MJprompt, saveQuadFiles = true, autoNameFiles = false, folder = "", cb = null, aiUpscale = false, saveUpscales = true) {
        return new Promise(async (resolve, reject) => {
            // set the running process flag to true
            this.runningProcess = true;
            // send the prompt to Midjourney and wait for the response. img is an object holding the response
            let img = await this.mj.generateImage(MJprompt, (obj, progress) => {
                // if the progress is not null, print it to the console
                if (progress != null) {
                    // process.stdout.write(progress + "%  ");
                    this.logger(progress + "  ");
                }
                // check if the kill process was called and exit the loop if it was
                this.breakout();
            });
            if (img == null) {
                this.logger("Initial Midjourney image generation failed.");
                await waitSeconds(2);
                return;
            }
            // at this point, we need to check if the kill process was called and exit the loop if it was
            if (!this.breakout()) resolve();
            // console.log("\nInitial Midjourney image generation completed");
            this.logger("Initial Midjourney image generation completed");
            // if saveQuadFiles is true, save the quad files
            if (saveQuadFiles) await this.makeFileFromIMGobj(img);
            // set the image to upscale to the initial image
            let imgToUpscale = img;
            let filenameBase = folder + "/";
            // check if the folder exists, if not, create it
            try {
                if (!fs.existsSync("output/" + filenameBase)) {
                    fs.mkdirSync("output/" + filenameBase);
                }
            } catch (err) {
                console.log(err);
            }
            // set the file count to 1, used for naming the files when autoNameFiles is true
            let fileCount = 1;
            // loop while the running process flag is true
            while (this.runningProcess) {
                // if the kill process was called, exit the loop
                if (!this.breakout()) {
                    resolve();
                    break;
                }
                // loop through 4 times and upscale each image
                for (let i = 1; i <= 4; i++) {
                    // pad the file count with 0s to make it 4 digits long (0001, 0002, etc)
                    let fileCountString = fileCount.toString().padStart(4, "0");
                    let filename = filenameBase + fileCountString;
                    fileCount++;
                    // upscale the image and save it
                    let temp = await this.mj.upscaleImage(imgToUpscale, i, img.prompt, this.breakout);
                    if (temp == null) break;
                    if (!this.breakout()) {
                        resolve();
                        break;
                    }
                    if (saveUpscales) {
                        this.makeFileFromIMGobj(temp, autoNameFiles ? filename : "", aiUpscale);
                    }
                }
                // reroll the image and save it
                imgToUpscale = await this.mj.rerollImage(imgToUpscale, img.prompt, this.breakout, (obj, progress) => {
                    // if the progress is not null, print it to the console
                    if (progress != null) {
                        // process.stdout.write(progress + "%  ");
                        this.logger(progress + "  ");
                    }
                    // check if the kill process was called and exit the loop if it was
                    this.breakout();
                });
                if (imgToUpscale == null) break;
                if (!this.breakout()) {
                    resolve();
                    break;
                }
                if (saveQuadFiles) {
                    let fileCountString = fileCount.toString().padStart(4, "0");
                    fileCount++;
                    // create the filename with the base and the padded file count
                    filename = filenameBase + fileCountString;
                    this.makeFileFromIMGobj(imgToUpscale, autoNameFiles ? filename : "");
                }
            }
            resolve();
        });
    }

    async showCommand(uuid) {
        let msg = await this.mj.showCommand(uuid);
        if (msg == null) return null;
        console.log({ msg });
        let regex = /\** - Image #[1-4] <@/g;
        let matches = msg.fullPrompt.match(regex);
        if (matches.length > 0) {
            msg.commands = ["Vary (Strong)", "Vary (subtle)", "Upscale 2x", "Upscale 4x", "Zoom Out 2x", "Zoom Out 4x", "Make Square", "Expand Left", "Expand Right", "Expand Up", "Expand Down"];
        }else{
            msg.command = ["ReRoll", "Upscale #1", "Upscale #2", "Upscale #3", "Upscale #4", "Variations #1", "Variations #2", "Variations #3", "Variations #4", "Upscale All", "Variations All"];
        }
        return msg;
    }

    // the main function runner
    // MJprompt: the prompt to send to Midjourney
    // maxGenerations: the max number of times to run the outer loop
    // maxUpscales: the max number of times to run the upscale loop
    // maxVariations: the max number of times to run the variation loop
    // maxZooms: the max number of times to run the zoom loop
    // printInfo: whether to print the Midjourney info to the console
    // aiUpscale: whether to run an additional AI upscale on the images
    main(MJprompt, maxGenerations = 100, maxUpscales = 4, maxVariations = 4, maxZooms = 4, printInfo = false, aiUpscale = false, saveUpscales = true, saveQuads = true, x4_upscales = null) {
        return new Promise(async (resolve, reject) => {
            if (x4_upscales == null) {
                x4_upscales = {};
                x4_upscales.enabled = false;
                x4_upscales.max = 0;
                x4_upscales.save = false;
                x4_upscales.aiUpscale = false;
            }
            this.runningProcess = true;
            maxZooms = maxZooms * 4; // zooms are 4x faster than upscales and variations
            // get the Midjourney instance
            const mj = this.mj;
            // set the max generations count to 0
            let maxGenerationsCount = 0;
            // print the Midjourney info to the console if printInfo is true
            if (printInfo) {
                let info = await mj.getInfo();
                // console.log("Midjourney info:\n\n", info.embeds[0].description);
                this.logger("\n\n\nMidjourney info:\n\n" + info);
            }
            // loop while the max generations count is less than the max generations
            while (maxGenerationsCount < maxGenerations) {
                if (!this.breakout()) {
                    resolve();
                    break;
                }
                // send the prompt to Midjourney and wait for the response. img is an object holding the response
                let img = await mj.generateImage(MJprompt, (obj, progress) => {
                    // if the progress is not null, print it to the console
                    if (progress != null) {
                        // process.stdout.write(progress + "%  ");
                        this.logger(progress + "  ");
                    }
                    // check if the kill process was called and exit the loop if it was
                    this.breakout();
                });
                if (img == null) break;
                if (!this.breakout()) {
                    resolve();
                    break;
                }
                let MJ_imgInfoObj = new MJ_imgInfo(img.uuid.value);

                this.logger("Initial Midjourney image generation completed");

                // save the quad files
                if (saveQuads) {
                    this.makeFileFromIMGobj(img).then(async (res) => {
                        this.writeEXIFdataToPNG(res, MJ_imgInfoObj);
                    });
                }
                // set up the queues
                let upscaleQueue = [];
                upscaleQueue.push(img);
                let variationQueue = [];
                variationQueue.push(img);
                let zoomQueue = [];
                let x4_upscaleQueue = [];
                // init the max counts
                let maxUpscalesCount = 0;
                let maxVariationsCount = 0;
                let maxZoomsCount = 0;
                let maxX4_upscalesCount = 0;
                let loop = [true, true, true, true];

                // loop as long as there are images in the queue and we haven't reached the max number of generations
                while (loop[0] || loop[1] || loop[2] || loop[3]) {
                    if (!this.breakout()) {
                        resolve();
                        break; // Exit the loop if breakout() returns false
                    }
                    this.logger("Processing request queues....");
                    // loop through the queues and run the appropriate function
                    while (upscaleQueue.length > 0 && maxUpscalesCount < maxUpscales) {
                        // get the image from the queue
                        let img = upscaleQueue.shift();
                        for (let i = 1; i <= 4; i++) {
                            // Upscale the image based on the loop counter 'i'
                            let upscaledImg = await mj.upscaleImage(img, i, img.prompt);
                            if (upscaledImg == null) break;
                            let MJ_imgInfoObj = new MJ_imgInfo(upscaledImg.uuid.value);
                            if (saveUpscales) {
                                // Save the upscaled image, add it to the zoom queue, and AI upscale it if aiUpscale is true
                                this.makeFileFromIMGobj(upscaledImg, "", aiUpscale).then(async (res) => {
                                    this.writeEXIFdataToPNG(res, MJ_imgInfoObj);
                                });
                            }
                            if (!this.breakout()) {
                                resolve();
                                break; // Exit the loop if breakout() returns false
                            }
                            zoomQueue.push(upscaledImg);
                            if (x4_upscales.enabled) x4_upscaleQueue.push(upscaledImg);
                        }
                        // increment the max upscales count to keep track of how many upscales we've done
                        maxUpscalesCount++;
                    }
                    // check to see if the upscale queue still has items and if the max upscales is reached. If so, clear the queue.
                    let upscaleQueueStillHasItemsAndMaxUpscalesReached = upscaleQueue.length > 0 && maxUpscalesCount >= maxUpscales;
                    if (upscaleQueueStillHasItemsAndMaxUpscalesReached) while (upscaleQueue.length > 0) upscaleQueue.shift();
                    // loop through the queues and run the appropriate function
                    while (variationQueue.length > 0 && maxVariationsCount < maxVariations) {
                        // get the image from the queue
                        let img = variationQueue.shift();
                        for (let i = 1; i <= 4; i++) {
                            // Run the variation function on the image based on the loop counter 'i'
                            let variationImg = await mj.variation(img, i, img.prompt, (obj, progress) => {
                                // if the progress is not null, print it to the console
                                if (progress != null) {
                                    // process.stdout.write(progress + "%  ");
                                    this.logger(progress + "  ");
                                }
                                // check if the kill process was called and exit the loop if it was
                                this.breakout();
                            });
                            if (variationImg == null) break;
                            let MJ_imgInfoObj = new MJ_imgInfo(variationImg.uuid.value);
                            if (saveQuads) {
                                // Save the variation image
                                this.makeFileFromIMGobj(variationImg).then(async (res) => {
                                    this.writeEXIFdataToPNG(res, MJ_imgInfoObj);
                                });
                            }
                            if (!this.breakout()) {
                                resolve();
                                break; // Exit the loop if breakout() returns false
                            }
                            // Add the images to the upscale and variation queues
                            upscaleQueue.push(variationImg);
                            variationQueue.push(variationImg);
                        }
                        maxVariationsCount++;
                    }
                    // check to see if the variation queue still has items and if the max variations is reached. If so, clear the queue.
                    let variationQueueStillHasItemsAndMaxVariationsReached = variationQueue.length > 0 && maxVariationsCount >= maxVariations;
                    if (variationQueueStillHasItemsAndMaxVariationsReached) while (variationQueue.length > 0) variationQueue.shift();
                    // loop through the queues and run the appropriate function
                    while (zoomQueue.length > 0 && maxZoomsCount < maxZooms) {
                        // get the image from the queue
                        let img = zoomQueue.shift();
                        // run the zoom out function on the image and save it
                        let zoomedImg = await mj.zoomOut(img, img.prompt, (obj, progress) => {
                            // if the progress is not null, print it to the console
                            if (progress != null) {
                                // process.stdout.write(progress + "%  ");
                                this.logger(progress + "  ");
                            }
                            // check if the kill process was called and exit the loop if it was
                            this.breakout();
                        });
                        if (zoomedImg == null) break;
                        let MJ_imgInfoObj = new MJ_imgInfo(zoomedImg.uuid.value);
                        if (saveQuads) {
                            // save the image but don't AI upscale it
                            this.makeFileFromIMGobj(zoomedImg).then(async (res) => {
                                this.writeEXIFdataToPNG(res, MJ_imgInfoObj);
                            });
                        }
                        if (!this.breakout()) {
                            resolve();
                            break; // Exit the loop if breakout() returns false
                        }
                        // add the image to the upscale queue and the zoom queue
                        variationQueue.push(zoomedImg);
                        upscaleQueue.push(zoomedImg);
                        // increment the max zooms count
                        maxZoomsCount++;
                    }
                    // check to see if the zoom queue still has items and if the max zooms is reached. If so, clear the queue.
                    let zoomQueueStillHasItemsAndMaxZoomsReached = zoomQueue.length > 0 && maxZoomsCount >= maxZooms;
                    if (zoomQueueStillHasItemsAndMaxZoomsReached) while (zoomQueue.length > 0) zoomQueue.shift();
                    while (x4_upscaleQueue.length > 0 && maxX4_upscalesCount < x4_upscales.max && x4_upscales.enabled) {
                        // get the image from the queue
                        let img = x4_upscaleQueue.shift();
                        // run the zoom out function on the image and save it
                        let x4_upscaledImg = await mj.x4_upscale(img, img.prompt, (obj, progress) => {
                            // if the progress is not null, print it to the console
                            if (progress != null) {
                                // process.stdout.write(progress + "%  ");
                                this.logger(progress + "  ");
                            }
                            // check if the kill process was called and exit the loop if it was
                            this.breakout();
                        });
                        if (x4_upscaledImg == null) break;
                        let MJ_imgInfoObj = new MJ_imgInfo(x4_upscaledImg.uuid.value);
                        if (x4_upscales.save) {
                            this.makeFileFromIMGobj(x4_upscaledImg, "", x4_upscales.aiUpscale).then(async (res) => {
                                this.writeEXIFdataToPNG(res, MJ_imgInfoObj);
                            });
                        }
                        if (!this.breakout()) {
                            resolve();
                            break; // Exit the loop if breakout() returns false
                        }
                    }
                    // check to see if the x4 upscale queue still has items and if the max x4 upscales is reached. If so, clear the queue.
                    let x4_upscaleQueueStillHasItemsAndMaxX4_upscalesReached = x4_upscaleQueue.length > 0 && maxX4_upscalesCount >= x4_upscales.max && x4_upscales.enabled;
                    if (x4_upscaleQueueStillHasItemsAndMaxX4_upscalesReached) while (x4_upscaleQueue.length > 0) x4_upscaleQueue.shift();
                    // check if we should continue looping
                    loop[0] = upscaleQueue.length > 0 && maxUpscalesCount < maxUpscales;
                    loop[1] = variationQueue.length > 0 && maxVariationsCount < maxVariations;
                    loop[2] = zoomQueue.length > 0 && maxZoomsCount < maxZooms;
                    loop[3] = x4_upscaleQueue.length > 0 && maxX4_upscalesCount < x4_upscales.max && x4_upscales.enabled;
                }
                // increment the max generations count
                maxGenerationsCount++;
            }
            resolve();
        });
    }

    // save an image from an IMG object
    // img: the IMG object
    // filename: the filename to save the image as
    // upscaleImg: whether to run an additional AI upscale on the image
    async makeFileFromIMGobj(img, filename = "", upscaleImg = false) {
        return new Promise(async (resolve, reject) => {
            // check to make sure output folder exists, if not, create it
            try {
                if (!fs.existsSync("output/")) {
                    fs.mkdirSync("output/");
                }
                // check to make sure upscale folder exists, if not, create it
                if (upscaleImg) {
                    if (!fs.existsSync(upscaleDest)) {
                        fs.mkdirSync(upscaleDest);
                    }
                }
            } catch (err) {
                console.log(err);
            }
            await waitSeconds(1);
            // get image from the url and store it in response as an arraybuffer
            axios.get(img.url, { responseType: 'arraybuffer' }).then(async (response) => {
                // if the filename is empty, try to parse it from the url
                if (filename == "") {
                    // get the UUID from the url
                    const regexString = "([A-Za-z]+(_[A-Za-z]+)+).*([A-Za-z0-9]+(-[A-Za-z0-9]+)+)";
                    const regex = new RegExp(regexString);
                    const matches = regex.exec(img.url);
                    // if the UUID is not null, use it as the filename
                    try {
                        filename = matches[0];
                    } catch (e) {
                        // if we couldn't parse the filename, we'll use another method that ends up incorporating the Discord username
                        filename = img.url.substring(img.url.lastIndexOf("/") + 1, img.url.lastIndexOf("."));
                    }
                }
                // send the data to sharp and save it as a png
                sharp(response.data).toFile("output/" + filename + '.png').then(async () => {
                    this.logger("Image saved to " + "output/" + filename + '.png');
                    //await waitSeconds(1);
                    // if aiUpscale is true, run the AI upscale on the image
                    if (upscaleImg) {
                        // filepath of the output image
                        let file = "output/" + filename + '.png';
                        // run the AI upscale on the image sending it the filepath and the destination folder
                        // the destination folder is derived from the filepath by removing the filename and adding "upscaled/"
                        upscaler.upscale(file, file.substring(0, file.lastIndexOf("/")) + "/upscaled/").then(async () => { // async so that we can await the waitSeconds function making sure we see the log message
                            this.logger("Upscale job started for image: " + upscaleDest + filename + '.jpg');
                        });
                    }
                });
                resolve("output/" + filename + '.png');
            }).catch((err) => { console.log(err); });
        });
    }
}

// get user config from file
let userConfig;
try {
    userConfig = JSON.parse(fs.readFileSync('user.json', 'utf8'));
} catch (e) {
    console.log("Error: Could not read user.json. Please make sure it exists and is valid JSON.");
    process.exit(1);
}
if (userConfig.openai_key == null || userConfig.openai_key == undefined) {
    console.log("Error: openai_key is not set in user.json. Please set it and try again.");
    process.exit(1);
}
if (userConfig.max_ChatGPT_Responses == null || userConfig.max_ChatGPT_Responses == undefined) {
    userConfig.max_ChatGPT_Responses = 25;
}
if (userConfig.wait_time_after_done == null || userConfig.wait_time_after_done == undefined) {
    userConfig.wait_time_after_done = 10;
}
if (userConfig.relaxedEnabled == null || userConfig.relaxedEnabled == undefined) {
    userConfig.relaxedEnabled = false;
}

// doLogin handles the login process when a token isn't provided in user.json
const doLogin = async () => {
    let newToken = "";
    console.log("Logging in to Discord using headless browser...")
    const browser = await puppeteer.launch({ headless: false, timeout: 60000 });
    const page = await browser.newPage();

    page.on('request', async (request) => {
        const headers = request.headers();
        if (headers['authorization'] != undefined) {
            newToken = headers['authorization'];
            console.log(headers['authorization']);
        }
        if (headers['Authorization'] != undefined) {
            newToken = headers['authorization'];
            console.log(headers['authorization']);
        }
    });

    await page.goto('https://discord.com/login', { waitUntil: 'networkidle2', timeout: 60000 });
    await page.setViewport({ width: 1920, height: 1080 });

    let selectFound = false;
    while (!selectFound) {
        page.click('input[name="email"]').then(() => { selectFound = true; }).catch(() => { selectFound = false; });
        await waitSeconds(1);
    }

    let email = await input({ message: 'What is your email?' });
    let password = await input({ message: 'What is your password?', type: 'password' });

    let typingRandomTimeMin = 0.1;
    let typingRandomTimeMax = 0.3;

    for (let i = 0; i < email.length; i++) {
        await page.type('input[name="email"]', email.charAt(i));
        let randomTime = Math.random() * (typingRandomTimeMin) + typingRandomTimeMax;
        await waitSeconds(randomTime);
    }

    await page.keyboard.press('Tab');
    for (let i = 0; i < password.length; i++) {
        await page.type('input[name="password"]', password.charAt(i));
        let randomTime = Math.random() * (typingRandomTimeMin) + typingRandomTimeMax;
        await waitSeconds(randomTime);
    }

    await Promise.all([
        page.click('button[type="submit"]').then(async () => { await waitSeconds(2); })
    ]);

    let htmlContent = await page.content(); // returns the html content of page
    const $ = cheerio.load(htmlContent);

    let h1 = $('form').find('div').find('h1').text();
    console.log(h1);
    if (h1 == "Multi-Factor Authentication") {
        let mfaCode = await input({ message: 'What is your MFA code?' });
        await page.type('input[placeholder="6-digit authentication code"]', mfaCode);
        await Promise.all([
            page.click('button[type="submit"]'),
            waitSeconds(1)
        ]);
    }
    await page.goto('https://discord.com/channels/@me', { waitUntil: 'networkidle2', timeout: 60000 });
    let waitCount = 0;
    console.log("Waiting for token to be set...");
    while (newToken == "") {
        await waitSeconds(1);
        waitCount++;
        if (waitCount > 60) {
            console.log("Error: Could not get token from login process. Please try again.");
            process.exit(1);
        }
    }
    await browser.close();
    return newToken;
}


var DiscordEvents = Discordie.Events;
var DiscordClient = new Discordie();
var DiscordieReady = false;
var midjourney = null;

// get data from prompts file
let prompts;
try {
    prompts = JSON.parse(fs.readFileSync('prompts.json', 'utf8'));
} catch (e) {
    console.log("Error: Could not read prompts.json. Please make sure it exists and is valid JSON.");
    process.exit();
}

// setup() runs when the program starts and inits most everything
async function setup() {
    // if we don't have a token, do the login process
    if (userConfig.token == "" || userConfig.token == null || userConfig.token == undefined) {
        userConfig.token = await doLogin();
        fs.writeFileSync('user.json', JSON.stringify(userConfig, null, 2));
    }

    // connect to discord using the token that was either provided or received from the login process
    DiscordClient.connect({
        token: userConfig.token
    });

    // Event handler for when Discordie is ready
    DiscordClient.Dispatcher.on(DiscordEvents.GATEWAY_READY, e => {
        process.stdout.moveCursor(0, -1);
        process.stdout.clearLine();
        console.log("Connected as: " + DiscordClient.User.username);
        DiscordieReady = true;
    });

    DiscordClient.Dispatcher.on(DiscordEvents.REQUEST_AUTH_LOGIN_ERROR, e => {
        console.log("Error: Could not log in to Discord. Please check your token and try again.");
        process.exit(1);
    });

    // Event handler for when a message is received
    DiscordClient.Dispatcher.on(DiscordEvents.MESSAGE_CREATE, e => {
        if (e.message.content == "ping")
            e.message.channel.sendMessage("pong");
    });

    // wait for discordie to be ready
    console.log("Waiting for Discordie to be ready...");
    while (!DiscordieReady) {
        await waitSeconds(1);
    }

    // get list of guilds AKA servers
    let guilds = await DiscordClient.Guilds.toArray();

    let guildsObjArray = [];
    guilds.forEach((g) => {
        guildsObjArray.push({ value: g.name });
    });

    // ask for the guild
    const guildAnswer = await select({ message: 'What is your server name?', choices: guildsObjArray });

    // find the guild object from the answer name
    let guild;
    guilds.forEach((g, i) => {
        if (g.name == guildAnswer) guild = guilds[i];
    });

    // get list of channels
    let channels = await DiscordClient.Channels.textForGuild(guild);

    let channelsObjArray = [];
    channels.forEach((c) => {
        channelsObjArray.push({ value: c.name });
    });

    // ask for the channel
    const channelAnswer = await select({ message: 'Which channel would you like to use?', choices: channelsObjArray });

    // find the channel object from the answer name
    let channel;
    channels.forEach((c, i) => {
        if (c.name == channelAnswer) channel = channels[i];
    });

    // set the guild id and channel id
    userConfig.guild_id = guild.id;
    userConfig.channel_id = channel.id;
    // console.log("Shutting down Discordie client...");
    // await DiscordClient.disconnect();
    // start the Midjourney instance
    midjourney = new MJ_Handler({
        token: userConfig.token,
        guild_id: userConfig.guild_id,
        channel_id: userConfig.channel_id,
    });
    // start up the Discord image uploader
    discordUploader = new DiscordImageUploader(userConfig.token);

    // register the MJ logger callback
    midjourney.registerMJLoggerCB(MJlogger_MJbridge);
}

// Logging function designed to print to the console in a specific location so that it doesn't interfere with the prompts
async function MJlogger(msg) {
    if (!MJloggerEnabled) return;
    if (msg.mj != null && msg.mj != undefined) {
        printToLineRelative(3, "Midjourney log:\n" + msg.mj);
    }
    if (msg.runner != null && msg.runner != undefined) {
        printToLineRelative(1, "Runner log:\n" + msg.runner);
    }
    if (msg.exif_logger != null && msg.exif_logger != undefined) {
        printToLineRelative(10, "ExifTool log:\n\r" + JSON.stringify(msg.exif_logger, null, 2));
    }
    for (let key in msg) {
        if (msg[key].title == null || msg[key].title == undefined) continue;
        if (msg[key].text != null && msg[key].text != undefined) continue;
        if (msg[key].line == null || msg[key].line == undefined) continue;
        let logTitle = msg[key].title;
        let logText = msg[key].text;
        let logLine = msg[key].line;
        if (msg[key].jsonStringify != null && msg[key].jsonStringify != undefined) {
            if (msg[key].jsonStringify) logText = JSON.stringify(logText, null, 2);
        }
        printToLineRelative(logLine, logTitle + ":\n" + logText);
    }
    if (msg.title != null && msg.title != undefined &&
        msg.text != null && msg.text != undefined &&
        msg.line != null && msg.line != undefined) {
        let logTitle = msg.title;
        let logText = msg.text;
        let logLine = msg.line;
        if (msg.jsonStringify !== null && msg.jsonStringify !== undefined) {
            if (msg.jsonStringify) logText = JSON.stringify(logText, null, 2);
        }
        if (typeof logText == "object") logText = JSON.stringify(logText, null, 2);
        printToLineRelative(logLine, logTitle + ":\n" + logText);
    }
}

function findSpecialStringsAndReplace(str) {
    const calcRelativeTime = (date1, date2) => {
        const msPerMinute = 60 * 1000;
        const msPerHour = msPerMinute * 60;
        const msPerDay = msPerHour * 24;
        const msPerMonth = msPerDay * (365 / 12);
        const msPerYear = msPerDay * 365;

        let diff = Math.abs(date1 - date2);

        if (diff < msPerMinute) {
            return `${Math.round(diff / 1000)} seconds ago`;
        } else if (diff < msPerHour) {
            return `${Math.round(diff / msPerMinute)} minutes ago`;
        } else if (diff < msPerDay) {
            return `${Math.round(diff / msPerHour)} hours ago`;
        } else if (diff < msPerMonth) {
            return `${Math.round(diff / msPerDay)} days ago`;
        } else if (diff < msPerYear) {
            return `${Math.round(diff / msPerMonth)} months ago`;
        } else {
            return `${Math.round(diff / msPerYear)} years ago`;
        }
    }

    let regex = /<@!([0-9]+)>/g; // matches @user
    let matches = str.match(regex);
    if (matches != null) {
        matches.forEach((m) => {
            let id = m.substring(3, m.length - 1);
            let user = DiscordClient.Users.get(id);
            str = str.replace(m, "@" + user.username);
        });
    }

    regex = /<t:([0-9]+):R>/g; // matches relative time stamp
    matches = str.match(regex);
    if (matches != null) {
        matches.forEach((m) => {
            let time = m.substring(3, m.length - 3);
            let date = new Date(time * 1000)
            str = str.replace(m, calcRelativeTime(date, new Date()));
        });
    }

    regex = /<t:([0-9]+)>/g; // matches absolute time stamp
    matches = str.match(regex);
    if (matches != null) {
        matches.forEach((m) => {
            let time = m.substring(3, m.length - 1);
            let date = new Date(time * 1000)
            str = str.replace(m, date.toLocaleString());
        });
    }

    regex = /🚀/g; // matches rocket ship
    matches = str.match(regex);
    if (matches != null) {
        matches.forEach((m) => {
            str = str.replace(m, "!RocketShip!");
        });
    }

    regex = /<#([0-9]+)>/g; // matches #channel
    matches = str.match(regex);
    if (matches != null) {
        matches.forEach((m) => {
            let id = m.substring(2, m.length - 1);
            let channel = DiscordClient.Channels.get(id);
            str = str.replace(m, "#" + channel.name);
        });
    }
    return str;
}

// print a message to the console in a location relative to the current cursor position
function printToLineRelative(line, text) {
    text = findSpecialStringsAndReplace(text);
    //get line count
    let textLines = text.split("\n");
    let lineCount = textLines.length;
    let screenWidth = process.stdout.columns;
    textLines.forEach((l) => {
        l.replace("\t", "    ");
        if (l.length > screenWidth) {
            lineCount += Math.floor(l.length / screenWidth);
        }
    });

    // move to start of the location
    process.stdout.cursorTo(0);
    process.stdout.moveCursor(0, line);


    // we're gonna do this twice because if the screen has to scroll it screws it up otherwise
    ///////////////////////////////////////////////////////////////////
    // clear the entire location
    for (let i = 0; i < lineCount; i++) {
        process.stdout.clearLine();
        process.stdout.moveCursor(0, 1);
    }

    // move back to the start of the location
    process.stdout.cursorTo(0);
    for (let i = 0; i < lineCount; i++) {
        process.stdout.moveCursor(0, -1);
    }

    // print the text
    process.stdout.write(text);

    // move back to the start of the location
    process.stdout.cursorTo(0);
    process.stdout.moveCursor(0, -(lineCount - 1)); // go back to the start of the line

    // do it again
    //////////////////////////////////////////////////////////////////
    // clear the entire location
    for (let i = 0; i < lineCount; i++) {
        process.stdout.clearLine();
        process.stdout.moveCursor(0, 1);
    }

    // move back to the start of the location
    process.stdout.cursorTo(0);
    for (let i = 0; i < lineCount; i++) {
        process.stdout.moveCursor(0, -1);
    }

    // print the text
    process.stdout.write(text);


    // move back to the start of the location
    process.stdout.cursorTo(0);
    process.stdout.moveCursor(0, -(lineCount - 1)); // go back to the start of the line

    // and we're done
    //////////////////////////////////////////////////////////
    process.stdout.moveCursor(0, -line); // move all the way to where the cursor was to begin with
}

let chatGPTmostRecentResId = null;
// send a prompt to chatgpt and return the response
async function sendChatGPTPrompt(prompt) {
    const chatgpt = new ChatGPTAPI({
        apiKey: userConfig.openai_key,
        completionParams: {
            /**
             * You can think of tokens as pieces of words, where 1,000 tokens is about 750 words.
             */
            model: 'gpt-4-1106-preview', // in: $0.01 / 1K tokens	out: $0.03 / 1K tokens
            // model: 'gpt-4', // in: $0.03 / 1K tokens	out: $0.06 / 1K tokens
            // model: 'gpt-4-32k', // in: $0.06 / 1K tokens     out: $0.12 / 1K tokens
            // model: 'gpt-3.5-turbo-16k', // in: $0.003 / 1K tokens	out: $0.004 / 1K tokens
            temperature: 1.5,
            top_p: 0.8
        }
    });
    // cancelTheGPT keeps track of whether the user has pressed enter to cancel the GPT
    let cancelTheGPT = false;
    // cancellation is a promise that will be resolved when the user presses enter to cancel the GPT.
    // This is used to cancel the prompt is the user never presses enter.
    let cancellation = input({ message: 'Press enter to cancel and return to menu.' }).then(() => { cancelTheGPT = true; });
    // res is the response from chatgpt
    let res = null;
    // count is used to print a dot every 2 seconds to show that the GPT is still running
    let count = 0;
    // send the prompt to chatgpt
    chatgpt.sendMessage(prompt,
        {
            onProgress: (partialResponse) => {
                // every other time we get a partial response, print a dot
                count++;
                if (!cancelTheGPT) { // but only if the user hasn't pressed enter to cancel
                    if (count % 3 == 0) {
                        process.stdout.write(".");
                    }
                }
            },
            parentMessageId: chatGPTmostRecentResId
        }).then((response) => {
            if (!cancelTheGPT) res = response; // set res to the response if the user hasn't pressed enter to cancel
        }).catch((err) => {
            console.log("ChatGPT error statusCode: ", err.statusCode);
        }).finally(() => {
            if (typeof cancellation.cancel == "function") {
                // cancel the cancellation promise
                cancellation.cancel();
            }
        });
    // wait for the response or for the user to press enter to cancel
    while (res == null && !cancelTheGPT) {
        await waitSeconds(1);
    }

    if (typeof cancellation.cancel == "function") {
        cancellation.cancel();
    }
    if (cancelTheGPT) {
        console.log("Prompt cancelled");
        await waitSeconds(1);
        return null;
    }
    chatGPTmostRecentResId = res.id;
    if (res === null) return null;
    return res.text;
}

let chatResponsesArr = [];
// generate a prompt from a theme object
async function generatePromptFromThemKeywords(theme, count = 10) {
    let chatPrompt = "Your role is to design theme based prompts for an AI image generator, midjourney. Your theme should be based upon the following keywords but you can get creative with it: ";
    let experimentalChatPrompt = "Your role is to design theme based prompts for an AI image generator, midjourney. Your theme should be based upon the following keywords and phrases (keywords / phrases may need to be interpreted as commands e.g. \"the nearest holiday less than one week before\" would return \"halloween\" during the week preceding halloween, and nothing otherwise) but you can get creative with it: ";
    if (experimentalChatPromptEnabled) chatPrompt = experimentalChatPrompt;
    theme.keywords.forEach((themeKeyword) => {
        chatPrompt += themeKeyword + ", ";
    });
    chatPrompt += ". The selected style is: ";
    chatPrompt += theme.style;
    chatPrompt += ".";
    chatPrompt += " If contrasting words or themes appear in the keyword / phrases list, break each prompt into parts and append \" ::value \" to the end of each part where \"value\" is a value between 1 and 200. Note the space before the \"::\". Do not immediately follow the \" ::value\" with punctuation. Select that value based on how you want to weight the importance of two parts of the prompt. ";
    chatPrompt += " Try to impart a little randomness into that value. Break the prompt into a number of parts that is congruent with the number of contrasting themes. Include as many contrasting themes as your prompt can handle.";
    chatPrompt += " An example prompt would look like this: \"An abstract interpretation of a half-real, half-cartoon robot, ::60 exploring a techno landscape with neon ferns ::30 and silicon trees ::75, amidst a viking settlement ::80 bathed in twilight hues ::42. Art style: photograph.\" ";
    chatPrompt += " Be sure to specify the art style at the end of the prompt. The prompts you write need to be output in JSON with the following schema: {\"prompts\":[\"your first prompt here\",\"your second prompt here\"]}. Do not respond with any text other than the JSON. Generate " + count + " prompts for this theme. Avoid words that can be construed as offensive, sexual, overly violent, or related.";
    let chatResponse = await sendChatGPTPrompt(chatPrompt);
    if (chatResponse == null) return null;
    if (!fs.existsSync("chatResponse.txt")) {
        fs.writeFileSync("chatResponse.txt", chatResponse);
    } else {
        fs.appendFileSync("chatResponse.txt", chatResponse);
    }

    chatResponse = chatResponse.replace('```json', "");
    chatResponse = chatResponse.replace('```', "");

    // regex to match 
    const regex = /::(0|[1-9]|[1-9][0-9]|[1-9][0-9]{2}|[1-9][0-9][0-9]|[1-9][0-9][0-9]{3})\b/g; // matches ::value
    const regex2 = /(\.\")|(\.\\\")|([a-z]\"[^\:])/gi; // matches .", .\" and a"b
    let highestValue = 0;
    if (chatResponse != null) {
        chatResponse = chatResponse.replace(regex, `$& `); // makes sure the value is followed by a space
        // we're going to find all the matches and make sure the values are far enough apart i.e. ::30 ::35 is too close together, so we'll multiply the second value by 2
        const matches = chatResponse.match(regex);
        if (matches != null) {
            matches.forEach((m) => {
                // get the index where the match starts
                let index = chatResponse.indexOf(m);
                // get the value from the match
                let value = m.substring(2);
                if (value > highestValue) highestValue = value;
                // get the next match if it isn't null
                let nextMatch = matches[matches.indexOf(m) + 1];
                // get the value of the next match if it isn't null
                let nextValue = null;
                if (nextMatch != null) nextValue = nextMatch.substring(2);
                if (nextValue != null) {
                    if (nextValue > highestValue) highestValue = nextValue;
                    // if the values are too close together, multiply the second value by 2
                    const ratio = value / nextValue;
                    const percentageDifference = Math.abs((ratio - 2) / 2) * 100;
                    if (percentageDifference < 80) {
                        if (value < nextValue) {
                            nextValue = Math.abs(Math.floor(nextValue * 2));
                            if (nextValue > highestValue) highestValue = nextValue;
                            // replace the next match with the new value
                            chatResponse = chatResponse.replace(nextMatch, "::" + nextValue);
                        } else {
                            value = Math.abs(Math.floor(value * 2));
                            if (value > highestValue) highestValue = value;
                            // replace the match with the new value
                            chatResponse = chatResponse.replace(m, "::" + value + " ");
                        }
                    }
                }
            });
        }
        const matchReplacer = (match, offset, str) => {
            let returnString = match.substring(0, 1);
            returnString += " ::" + highestValue + " ";
            returnString += match.substring(1);
            return returnString;
        }
        chatResponse = chatResponse.replace(regex2, matchReplacer); // append the highest value to the end of the prompt
    }

    try {
        chatResponsesArr.push(JSON.parse(chatResponse));
    } catch (e) {
        console.log("Error parsing chatResponse: ", e);
    }
    try {
        fs.writeFileSync("chatRequest.txt", chatPrompt);
        fs.writeFileSync("chatResponse.json", JSON.stringify(chatResponsesArr, null, '\t'));
    } catch (e) {
        console.log(e);
    }
    return chatResponse;
}

async function generatePromptFromThemKeywordsBatch(theme, count = 10) {
    chatGPTmostRecentResId = null;
    console.log("Generating prompts from theme: ", JSON.stringify(theme));
    let batchJobCount = Math.ceil(count / 10);
    if (batchJobCount > 1) {
        console.log("Prompt count > 10. Running " + batchJobCount + " chatGPT jobs.");
    }
    let prompts = [];
    for (let i = 0; i < batchJobCount; i++) {
        let isLastRun = i == batchJobCount - 1;
        let isDivisibleByTen = count % 10 == 0;
        let thisRunCount = 10;
        if (isLastRun && !isDivisibleByTen) {
            thisRunCount = count % 10;
        } else if (isLastRun && isDivisibleByTen) {
            thisRunCount = 10;
        }
        console.log("Running chatGPT job " + (i + 1) + " of " + batchJobCount + "... Generating " + thisRunCount + " prompts.");
        let chatResponse = await generatePromptFromThemKeywords(theme, thisRunCount);

        if (chatResponse != null) {
            try {
                JSON.parse(chatResponse).prompts.forEach((p) => { prompts.push(p); });
            } catch (e) {
                console.log("Error parsing prompts: ", e);
            }
        }
        if (i < batchJobCount - 1 && chatResponse != null) {
            console.log();
            console.log("Waiting 5 seconds between OpenAI requests...");
            await waitSeconds(5);
        }
    }
    console.log("Generated " + prompts.length + " prompts from theme: ", JSON.stringify(theme));
    if (prompts.length == 0) return null;
    return JSON.stringify({ prompts: prompts });
}

async function waitSeconds(count, cancelable = false) {
    // this holds the promise returned by the confirm function
    let confirmation = null;
    return await new Promise((resolve) => {
        // if the wait is cancelable, set the confirmation promise to the promise returned by the confirm function
        if (cancelable) {
            confirmation = confirm({ message: 'Waiting ' + count + ' seconds. Enter to cancel.' }).then(() => {
                // if the user presses enter, resolve the promise with true
                resolve(true);
            });
        }
        setTimeout(() => {
            // if the user hasn't pressed enter to cancel, cancel the confirmation promise and resolve the wait promise with false
            if (confirmation != null) confirmation.cancel();
            resolve(false);
        }, count * 1000);
    });
};

const clearScreenBelowIntro = () => {
    let screenHeight = process.stdout.rows;
    let introHeight = 22;
    process.stdout.cursorTo(0, introHeight);
    // clear the screen below the intro
    for (let i = introHeight; i < screenHeight; i++) {
        process.stdout.clearLine();
        process.stdout.cursorTo(0, i);
    }
    // move the cursor back to the top
    process.stdout.cursorTo(0, introHeight);
}

const intro = () => {
    // clear the screen
    process.stdout.write('\x1B[2J\x1B[0f');
    console.log(chalk.greenBright('='.repeat(process.stdout.columns)));
    console.log(
        chalk.green(
            figlet.textSync('Midjourney\nAutomata', {
                font: 'roman',
                horizontalLayout: 'default',
                verticalLayout: 'default',
                width: process.stdout.columns
            })
        )
    );
    console.log(chalk.greenBright('='.repeat(process.stdout.columns)));
}

const printDone = () => {
    let MJloggerEnabledState = MJloggerEnabled;
    MJloggerEnabled = true;
    // MJlogger({ mj: "", runner: "" });
    MJLogger_runner("");
    MJlogger_MJbridge("");
    MJloggerEnabled = MJloggerEnabledState;
    console.log(chalk.greenBright('='.repeat(process.stdout.columns)));
    console.log(
        chalk.green(
            figlet.textSync('Done', {
                font: 'doh',
                horizontalLayout: 'full',
                verticalLayout: 'full',
                width: process.stdout.columns
            })
        )
    );
    console.log(chalk.greenBright('='.repeat(process.stdout.columns)));
}

const printRunComplete = () => {
    console.log(chalk.greenBright('='.repeat(process.stdout.columns)));
    console.log(
        chalk.green(
            figlet.textSync('Run Complete', {
                font: 'roman',
                horizontalLayout: 'full',
                verticalLayout: 'full',
                width: process.stdout.columns
            })
        )
    );
    console.log(chalk.greenBright('='.repeat(process.stdout.columns)));
    console.log();
}

const shortenObject = (obj, maxLength = 10) => {
    let tempObj = JSON.parse(JSON.stringify(obj));
    for (let key in tempObj) {
        if (Array.isArray(tempObj[key])) {
            if (tempObj[key].length > maxLength) {
                tempObj[key] = tempObj[key].slice(0, maxLength);
                tempObj[key].push("...");
            }
        }
        if (typeof tempObj[key] == "object") {
            tempObj[key] = shortenObject(tempObj[key]);
        }
    }
    return tempObj;
}

const printPromptsFile = (choice = "all") => {
    if (choice == "themes" || choice == "all") {
        if (prompts.themes == null) prompts.themes = [];
        console.log(chalk.yellowBright("Loaded themes: "));
        prompts.themes.forEach((theme, i) => {
            let shortObj = shortenObject(theme);
            console.log(chalk.white((i + 1) + ":  " + JSON.stringify(shortObj)));
        });
    }
    if (choice == "prompts" || choice == "all") {
        if (prompts.prompts != null) {
            console.log(chalk.yellowBright("Loaded prompts: "));
            prompts.prompts.forEach((prompt, i) => {
                let shortObj = shortenObject(prompt);
                console.log(chalk.white((i + 1) + ":  " + JSON.stringify(shortObj)));
            });
        }
    }
    if (choice == "options" || choice == "all") {
        if (prompts.options != null) {
            console.log(chalk.yellowBright("Loaded options: "));
            prompts.options.forEach((option, i) => {
                let shortObj = shortenObject(option);
                console.log(chalk.white((i + 1) + ":  " + JSON.stringify(shortObj)));
            });
        }
    }
    if (choice == "keywords" || choice == "all") {
        if (prompts.keyword_lists != null) {
            console.log(chalk.yellowBright("Loaded keywords: "));
            prompts.keyword_lists.forEach((item, i) => {
                let shortItem = shortenObject(item);
                console.log(chalk.white((i + 1) + ":  " + JSON.stringify(shortItem)));
            });
        }
    }
}

const printMainMenu = () => {
    clearScreenBelowIntro();
    console.log(chalk.yellowBright("Main Menu: "));
    console.log(chalk.white("1. Show loaded themes, prompts, and options"));
    console.log(chalk.white("2. Modify prompts"));
    console.log(chalk.white("3. Modify themes"));
    console.log(chalk.white("4. Modify options (applies to all generations)"));
    console.log(chalk.white("5. Modify keyword lists"));
    console.log(chalk.white("6. Start thematic generation from saved theme"));
    console.log(chalk.white("7. Start thematic generation from questions"));
    console.log(chalk.white("8. Start prompt generation from saved prompt"));
    console.log(chalk.white("9. Start prompt generation from questions"));
    console.log(chalk.white("10. Start prompt generation from last questions"));
    console.log(chalk.white("11. Start infinite zoom"));
    console.log(chalk.white("12. Start infinite variation upscales from prompt"));
    console.log(chalk.white("13. Run commands on a job UUID"));
    console.log(chalk.white("14. Start generation based on keyword list (run prompt / file against all the keywords in a list)"));
    console.log(chalk.white("0. Exit"));
}

// main menu
// params:  validate is a function that returns true if the answer is valid, otherwise it returns false
// return:  the answer to the question as a string
const askMenuOption = async (validate = null) => {
    // if validate is null, just ask for input
    if (validate == null) return await input({ message: 'What is your choice?' });
    else { // otherwise, ask for input and validate it
        let valid = false;
        let answer = "";
        while (!valid) { // keep asking for input until it is valid
            answer = await input({ message: 'What is your choice?' });
            // if the answer is valid, set valid to true and return the answer
            valid = validate(answer); // validate is a function that returns true if the answer is valid
        }
        return answer;
    }
}

const askInfiniteQuestions = async () => {
    let res = {};
    res.SENDTOCHATGPT = await confirm({ message: questionMessages.SENDTOCHATGPT });
    res.SAVEQUADS = await confirm({ message: questionMessages.SAVEQUADS });
    res.CUSTOMFILENAME = await confirm({ message: questionMessages.CUSTOMFILENAME });
    res.PROMPT = await input({ message: questionMessages.PROMPT });
    res.AIUPSCALE = await confirm({ message: questionMessages.AIUPSCALE });
    return res;
}

const pressEnterToReturnToMenu = async () => {
    let res = {};
    res.ENTER = await input({ message: 'Press enter to return to the main menu.' });
    return res;
}

const customFolderQuestion = async () => {
    let res = {};
    res.FOLDER = await input({ message: questionMessages.FOLDER });
    return res;
}

const readyToRun = async () => {
    let res = {};
    res.READY = await confirm({ message: 'Ready to run?' });
    return res;
}

const askPromptQuestions = async () => {
    let res = {};
    res.PROMPT = await input({ message: questionMessages.PROMPT });
    res.GENERATIONS = await input({ message: questionMessages.GENERATIONS, default: "1" });
    res.UPSCALE = await input({ message: questionMessages.UPSCALE, default: "4" });
    res.SAVEUPSCALES = await confirm({ message: questionMessages.SAVEUPSCALES });
    res.SAVEQUADS = await confirm({ message: questionMessages.SAVEQUADS });
    res.AIUPSCALE = await confirm({ message: questionMessages.AIUPSCALE });
    res.VARIATION = await input({ message: questionMessages.VARIATION, default: "0" });
    res.ZOOM = await input({ message: questionMessages.ZOOM, default: "0" });
    return res;
}

const askPromptQuestionShort = async () => {
    let res = {};
    res.PROMPT = await input({ message: 'What is your prompt?' });
    return res;
}

const askThemeQuestionsShort = async (theme = null) => {
    let res = {};
    res.THEME = await input({
        message: questionMessages.THEME, transformer: (input) => {
            let inputSplit = input.split(",");
            for (let i = 0; i < inputSplit.length; i++) {
                inputSplit[i] = inputSplit[i].trim().toLowerCase();
            }
            let returnString = "";
            if (theme == null || theme == undefined) return input.toLowerCase();
            if (input == "") return theme.keywords[0];
            // find the theme keyword that is closest to the input
            // TODO: use levenshtein distance to find the closest keyword
            let matches = theme.keywords.filter((word) => {
                return word.trim().toLowerCase().startsWith(inputSplit[inputSplit.length - 1]);
            });
            // remove all entries from matches that are already in the input
            matches = matches.filter((word) => {
                return !inputSplit.includes(word);
            });
            if (matches.length > 0) {
                for (let i = 0; i < inputSplit.length - 1; i++) {
                    returnString += inputSplit[i] + ",";
                }
                returnString += matches[0];
                return returnString.toLowerCase();
            } else if (matches.length == 0 && theme.keywords.every((word) => { return inputSplit.includes(word); })) {
                return input.toLowerCase();
            } else if (matches.length == 0 && inputSplit.every((word) => { return theme.keywords.includes(word); })) {
                return input.toLowerCase();
            } else {
                for (let i = 0; i < inputSplit.length; i++) {
                    returnString += inputSplit[i] + ",";
                }
                return returnString.toLowerCase();
            }
        }
    });
    res.STYLE = await input({ message: 'What is your style?' });
    res.THEME = res.THEME.toLowerCase();
    res.STYLE = res.STYLE.toLowerCase();
    return res;
}

const askThemeQuestions = async () => {
    let res = {};
    res.THEME = await input({ message: questionMessages.THEME });
    res.STYLE = await input({ message: 'What is your style?' });
    let chatGPTCount = 100000;
    while (chatGPTCount > parseInt(userConfig.max_ChatGPT_Responses)) {
        res.CHATGPTGENERATIONS = await input({ message: 'How many prompts do you want to generate with chatgpt? (max ' + userConfig.max_ChatGPT_Responses + ')', default: "5" });
        chatGPTCount = parseInt(res.CHATGPTGENERATIONS);
        if (chatGPTCount > parseInt(userConfig.max_ChatGPT_Responses)) console.log("Error: You can only generate a maximum of " + userConfig.max_ChatGPT_Responses + " prompts with chatgpt.");
    }
    res.GENERATIONS = await input({ message: questionMessages.GENERATIONS, default: "1" });
    res.UPSCALE = await input({ message: questionMessages.UPSCALE, default: "4" });
    res.SAVEUPSCALES = await confirm({ message: questionMessages.SAVEUPSCALES });
    res.SAVEQUADS = await confirm({ message: questionMessages.SAVEQUADS });
    res.AIUPSCALE = await confirm({ message: questionMessages.AIUPSCALE });
    res.VARIATION = await input({ message: questionMessages.VARIATION, default: "0" });
    res.ZOOM = await input({ message: questionMessages.ZOOM, default: "0" });
    return res;
}

const askImageGenQuestions = async () => {
    let res = {};
    let chatGPTCount = 100000;
    while (chatGPTCount > parseInt(userConfig.max_ChatGPT_Responses)) {
        res.CHATGPTGENERATIONS = await input({ message: 'How many prompts do you want to generate with chatgpt? (max ' + userConfig.max_ChatGPT_Responses + ')', default: "5" });
        chatGPTCount = parseInt(res.CHATGPTGENERATIONS);
        if (chatGPTCount > parseInt(userConfig.max_ChatGPT_Responses)) console.log("Error: You can only generate a maximum of " + userConfig.max_ChatGPT_Responses + " prompts with chatgpt.");
    }
    res.GENERATIONS = await input({ message: questionMessages.GENERATIONS, default: "1" });
    res.UPSCALE = await input({ message: questionMessages.UPSCALE, default: "4" });
    if (res.UPSCALE > 0) res.MJx4UPSCALE = await confirm({ message: questionMessages.MJUPSCALE });
    else res.MJx4UPSCALE = false;
    res.SAVEUPSCALES = await confirm({ message: questionMessages.SAVEUPSCALES });
    res.SAVEQUADS = await confirm({ message: questionMessages.SAVEQUADS });
    res.AIUPSCALE = await confirm({ message: questionMessages.AIUPSCALE });
    res.VARIATION = await input({ message: questionMessages.VARIATION, default: "0" });
    res.ZOOM = await input({ message: questionMessages.ZOOM, default: "0" });
    return res;
}

const askOptionQuestions = async () => {
    let res = {};
    res.NAME = await input({ message: 'What is the option name?' });
    res.VALUE = await input({ message: 'What is the option value?' });
    res.ENABLED = await input({ message: 'Is the option enabled? (y/n)' });
    return res;
}

const printModifyOptionsMenu = (optType) => {
    console.log(chalk.yellowBright("Modify " + optType + "s Menu: "));
    console.log(chalk.white("1. Add " + optType));
    console.log(chalk.white("2. Remove " + optType));
    console.log(chalk.white("3. Modify " + optType));
    console.log(chalk.white("0. Back"));
}

class RunOptions {
    constructor(
        upscaleAnswer = 0,
        promptAnswer = [],
        generationAnswer = 4,
        variationAnswer = 0,
        zoomAnswer = 0,
        saveUpscalesAnswer = false,
        saveQuadsAnswer = false,
        mjX4UpscaleAnswer = false,
        themeKeywords = [],
        basicAnswers = {},
        theme = {},
        res = {},
        aiUpscale = false,
        promptChoice = "",
        addOption = "",
        option = "",
        removeTheme = "",
        runningProcess = false) {
        this.upscaleAnswer = upscaleAnswer;
        this.promptAnswer = promptAnswer;
        this.generationAnswer = generationAnswer;
        this.variationAnswer = variationAnswer;
        this.zoomAnswer = zoomAnswer;
        this.saveUpscalesAnswer = saveUpscalesAnswer;
        this.saveQuadsAnswer = saveQuadsAnswer;
        this.mjX4UpscaleAnswer = mjX4UpscaleAnswer;
        this.themeKeywords = themeKeywords;
        this.basicAnswers = basicAnswers;
        this.theme = theme;
        this.res = res;
        this.aiUpscale = aiUpscale;
        this.promptChoice = promptChoice;
        this.addOption = addOption;
        this.option = option;
        this.removeTheme = removeTheme;
        this.runningProcess = runningProcess;
    }
};

const showLoadedThemesPromptsOptions = async () => {
    clearScreenBelowIntro();
    console.log("Show loaded themes, prompts, and options");
    // print the info from the prompts file
    printPromptsFile();
    // wait for enter to be pressed
    await pressEnterToReturnToMenu();
};

const modifyPrompts = async (runOpts) => {
    clearScreenBelowIntro();
    console.log("Modify prompts");
    let modifyPromptsMenuOption = "";
    while (modifyPromptsMenuOption != "0") {
        printPromptsFile("prompts");
        // print the modify prompts menu
        printModifyOptionsMenu("prompt");
        // ask for the menu option
        modifyPromptsMenuOption = await askMenuOption((value) => {
            value = parseInt(value);
            if (value >= 0 <= 3) return true;
            else return false;
        });
        switch (modifyPromptsMenuOption) {
            case "1":
                console.log("Add prompt");
                // ask for the prompt
                let addPrompt = await askPromptQuestionShort();
                // add the prompt to the prompts object
                if (prompts.prompts == null) prompts.prompts = [];
                prompts.prompts.push(addPrompt);
                // save the prompts object to the prompts.json file
                fs.writeFileSync('prompts.json', JSON.stringify(prompts, null, 2));
                break;
            case "2":
                console.log("Remove prompt");
                // ask for the prompt number
                let removePrompt = await askMenuOption((value) => {
                    value = parseInt(value);
                    if (value >= 0 <= prompts.prompts.length) return true;
                    else return false;
                });
                // remove the prompt from the prompts object
                if (prompts.prompts == null) prompts.prompts = [];
                prompts.prompts.splice(parseInt(removePrompt) - 1, 1);
                // save the prompts object to the prompts.json file
                fs.writeFileSync('prompts.json', JSON.stringify(prompts, null, 2));
                break;
            case "3":
                console.log("Modify prompt");
                // ask for the prompt number
                let modifyPrompt = await askMenuOption((value) => {
                    value = parseInt(value);
                    if (value >= 0 <= prompts.prompts.length) return true;
                    else return false;
                });
                // ask for the prompt
                let modifyPromptQuestions = await askPromptQuestionShort();
                // modify the prompt in the prompts object
                if (prompts.prompts == null) prompts.prompts = [];
                prompts.prompts[parseInt(modifyPrompt) - 1] = modifyPromptQuestions.PROMPT;
                // save the prompts object to the prompts.json file
                fs.writeFileSync('prompts.json', JSON.stringify(prompts, null, 2));
                break;
            case "0":
                console.log("Exit");
                break;
            default:
                console.log("Invalid option");
                break;
        }
    }
};

const modifyThemes = async (runOpts) => {
    clearScreenBelowIntro();
    console.log("Modify themes");
    let modifyThemesMenuOption = "";
    while (modifyThemesMenuOption != "0") {
        printPromptsFile("themes");
        // print the modify themes menu
        printModifyOptionsMenu("theme");
        // ask for the menu option
        modifyThemesMenuOption = await askMenuOption((value) => {
            value = parseInt(value);
            if (value >= 0 <= 3) return true;
            else return false;
        });
        switch (modifyThemesMenuOption) {
            case "1":
                console.log("Add theme");
                // ask for the theme
                let addTheme = await askThemeQuestionsShort();
                // add the theme to the prompts object
                if (prompts.themes == null) prompts.themes = [];
                //split the theme keywords into an array
                let themeKeywords = addTheme.THEME.split(",");
                // create the theme object
                let theme = {
                    keywords: themeKeywords,
                    style: addTheme.STYLE
                };
                prompts.themes.push(theme);
                // save the prompts object to the prompts.json file
                fs.writeFileSync('prompts.json', JSON.stringify(prompts, null, 2));
                break;
            case "2":
                console.log("Remove theme");
                // ask for the theme number
                runOpts.removeTheme = await askMenuOption((value) => {
                    value = parseInt(value);
                    if (value >= 0 <= prompts.themes.length) return true;
                    else return false;
                });
                // remove the theme from the prompts object
                if (prompts.themes == null) prompts.themes = [];
                prompts.themes.splice(parseInt(runOpts.removeTheme) - 1, 1);
                // save the prompts object to the prompts.json file
                fs.writeFileSync('prompts.json', JSON.stringify(prompts, null, 2));
                break;
            case "3":
                console.log("Modify theme");
                //console.log("Which theme do you want to modify?");
                // ask for the theme number
                let modifyTheme = await askMenuOption((value) => {
                    value = parseInt(value);
                    if (value >= 0 <= prompts.themes.length) return true;
                    else return false;
                });
                // ask for the theme
                let modifyThemeQuestions = await askThemeQuestionsShort(prompts.themes[parseInt(modifyTheme) - 1]);
                // modify the theme in the prompts object
                if (prompts.themes == null) prompts.themes = [];
                //split the theme keywords into an array
                let modifyThemeKeywords = modifyThemeQuestions.THEME.split(",");
                // create the theme object
                let modifyThemeObject = {
                    keywords: modifyThemeKeywords,
                    style: modifyThemeQuestions.STYLE
                };
                prompts.themes[parseInt(modifyTheme) - 1] = modifyThemeObject;
                // save the prompts object to the prompts.json file
                fs.writeFileSync('prompts.json', JSON.stringify(prompts, null, 2));
                break;
            case "0":
                console.log("Exit");
                break;
            default:
                console.log("Invalid option");
                break;
        }
    }
};

const modifyOptions = async (runOpts) => {
    clearScreenBelowIntro();
    console.log("Modify MJ options (applies to all generations)");
    let modifyOptionsMenuOption = "";
    while (modifyOptionsMenuOption != "0") {
        printPromptsFile("options");
        // print the modify options menu
        printModifyOptionsMenu("option");
        // ask for the menu option
        modifyOptionsMenuOption = await askMenuOption((value) => {
            value = parseInt(value);
            if (value >= 0 <= 3) return true;
            else return false;
        });
        switch (modifyOptionsMenuOption) {
            case "1":
                console.log("Add option");
                // ask for the option
                runOpts.addOption = await askOptionQuestions();
                // add the option to the prompts object
                if (prompts.options == null) prompts.options = [];
                // create the option object
                let option = {
                    name: runOpts.addOption.NAME,
                    value: runOpts.addOption.VALUE,
                    enabled: runOpts.addOption.ENABLED == "y" || runOpts.addOption.ENABLED == "Y" ? true : false
                };
                prompts.options.push(option);
                // save the prompts object to the prompts.json file
                fs.writeFileSync('prompts.json', JSON.stringify(prompts, null, 2));
                break;
            case "2":
                console.log("Remove option");
                // ask for the option number
                let removeOption = await askMenuOption((value) => {
                    value = parseInt(value);
                    if (value >= 0 <= prompts.options.length) return true;
                    else return false;
                });
                // remove the option from the prompts object
                if (prompts.options == null) prompts.options = [];
                prompts.options.splice(parseInt(removeOption) - 1, 1);
                // save the prompts object to the prompts.json file
                fs.writeFileSync('prompts.json', JSON.stringify(prompts, null, 2));
                break;
            case "3":
                console.log("Modify option");
                // ask for the option number
                let modifyOption = await askMenuOption((value) => {
                    value = parseInt(value);
                    if (value >= 0 <= prompts.options.length) return true;
                    else return false;
                });
                // ask for the option
                let modifyOptionQuestions = await askOptionQuestions();
                // modify the option in the prompts object
                if (prompts.options == null) prompts.options = [];
                // create the option object
                let modifyOptionObject = {
                    name: modifyOptionQuestions.NAME,
                    value: modifyOptionQuestions.VALUE,
                    enabled: modifyOptionQuestions.ENABLED == "y" || modifyOptionQuestions.ENABLED == "Y" ? true : false
                };
                prompts.options[parseInt(modifyOption) - 1] = modifyOptionObject;
                // save the prompts object to the prompts.json file
                fs.writeFileSync('prompts.json', JSON.stringify(prompts, null, 2));
                break;
            case "0":
                console.log("Exit");
                break;
            default:
                console.log("Invalid option");
                break;
        }
    }
};

const modifyKeywordLists = async (runOpts) => {
    clearScreenBelowIntro();
    console.log("Modify keyword lists");
    let modifyKeywordListsMenuOption = "";
    while (modifyKeywordListsMenuOption != "0") {
        printPromptsFile("keywords");
        // print the modify options menu
        printModifyOptionsMenu("keyword list");
        // ask for the menu option
        modifyKeywordListsMenuOption = await askMenuOption((value) => {
            value = parseInt(value);
            if (value >= 0 <= 3) return true;
            else return false;
        });
        switch (modifyKeywordListsMenuOption) {
            case "1":
                console.log("Add keyword list");
                // ask for the keyword list
                let listName = await input({ message: 'What is the name of the keyword list?' });
                let listKeywords = await input({ message: 'What are the keywords in the list? (comma separated)' });
                let listKeywordsArray = listKeywords.split(",");
                // add the keyword list to the prompts object
                if (prompts.keyword_lists == null) prompts.keyword_lists = [];
                // create the keyword list object
                let keywordList = {
                    name: listName,
                    keywords: listKeywordsArray
                };
                prompts.keyword_lists.push(keywordList);
                // save the prompts object to the prompts.json file
                fs.writeFileSync('prompts.json', JSON.stringify(prompts, null, 2));
                break;
            case "2":
                console.log("Remove keyword list");
                // ask for the option number
                let removeOption = await askMenuOption((value) => {
                    value = parseInt(value);
                    if (value >= 0 <= prompts.keyword_lists.length) return true;
                    else return false;
                });
                // remove the option from the prompts object
                if (prompts.keyword_lists == null) prompts.keyword_lists = [];
                prompts.keyword_lists.splice(parseInt(removeOption) - 1, 1);
                // save the prompts object to the prompts.json file
                fs.writeFileSync('prompts.json', JSON.stringify(prompts, null, 2));
                break;
            case "3":
                console.log("Modify keyword list");
                // ask for the option number
                let modifyOption = await askMenuOption((value) => {
                    value = parseInt(value);
                    if (value >= 0 <= prompts.keyword_lists.length) return true;
                    else return false;
                });
                // TODO:
                break;
            case "0":
                console.log("Exit");
                break;
            default:
                console.log("Invalid option");
                break;
        }
    }
};

const startThematicGenerationFromSavedTheme = async (runOpts) => {
    clearScreenBelowIntro();
    console.log("Start thematic generation from saved theme");
    // print the themes
    printPromptsFile("themes");
    // ask for the theme number
    let themeChoice = await askMenuOption((value) => {
        value = parseInt(value);
        if (value >= 0 <= prompts.themes.length) return true;
        else return false;
    });
    let basicAnswers = await askImageGenQuestions();
    //split the theme keywords into an array
    let themeKeywords = prompts.themes[parseInt(themeChoice) - 1].keywords;
    // create the theme object
    let theme = {
        keywords: themeKeywords,
        style: prompts.themes[parseInt(themeChoice) - 1].style
    };
    basicAnswers.CHATGPTGENERATIONS = parseInt(basicAnswers.CHATGPTGENERATIONS);
    if (basicAnswers.CHATGPTGENERATIONS > userConfig.max_ChatGPT_Responses) basicAnswers.CHATGPTGENERATIONS = userConfig.max_ChatGPT_Responses;
    // generate the prompt from the theme
    let res = await generatePromptFromThemKeywordsBatch(theme, basicAnswers.CHATGPTGENERATIONS);
    if (res == null) return;
    // find and replace all "-" in res with " " (space)
    res = res.replaceAll("-", " ");
    if (res.indexOf("{") == -1) {
        console.log("Error: ChatGPT returned a badly formatted string. Please try again.");
        await waitSeconds(2);
        return;
    }
    try {
        res = JSON.parse(res.substring(res.indexOf("{"), res.indexOf("}") + 1));
    }
    catch (e) {
        console.log("Error: ChatGPT returned a badly formatted string. Please try again.");
        await waitSeconds(2);
        return;
    }
    console.log("");
    //log the prompt
    res.prompts.forEach((prompt, i) => {
        if (parseInt(prompt.substring(0, 1)) == i + 1) console.log(chalk.green((i + 1) + ":  " + prompt.substring(2)));
        else if (parseInt(prompt.substring(0, 2)) == i + 1) console.log(chalk.green((i + 1) + ":  " + prompt.substring(3)));
        else console.log(chalk.green((i + 1) + ":  " + prompt));
    });
    runOpts.promptAnswer = [];
    res.prompts.forEach((prompt, i) => {
        runOpts.promptAnswer.push(prompt);
    });
    // set the answers
    runOpts.generationsAnswer = parseInt(basicAnswers.GENERATIONS);
    runOpts.upscaleAnswer = parseInt(basicAnswers.UPSCALE);
    runOpts.saveUpscalesAnswer = basicAnswers.SAVEUPSCALES;
    runOpts.saveQuadsAnswer = basicAnswers.SAVEQUADS;
    runOpts.variationAnswer = parseInt(basicAnswers.VARIATION);
    runOpts.zoomAnswer = parseInt(basicAnswers.ZOOM);
    runOpts.aiUpscale = basicAnswers.AIUPSCALE;
    runOpts.mjX4UpscaleAnswer = basicAnswers.MJx4UPSCALE;
    runOpts.runnerGo = true;
}

const startThematicGenerationFromQuestions = async (runOpts) => {
    clearScreenBelowIntro();
    console.log("Start thematic generation from questions");
    // ask theme questions
    let themeQuestions = await askThemeQuestions();

    //split the theme keywords into an array
    let themeKeywords = themeQuestions.THEME.split(",");
    // create the theme object
    let theme = {
        keywords: themeKeywords,
        style: themeQuestions.STYLE
    };
    // generate the prompt from the theme
    if (themeQuestions.CHATGPTGENERATIONS > userConfig.max_ChatGPT_Responses) themeQuestions.CHATGPTGENERATIONS = userConfig.max_ChatGPT_Responses;
    let res = await generatePromptFromThemKeywordsBatch(theme, themeQuestions.CHATGPTGENERATIONS);
    if (res == null) return;
    // find and replace all "-" in res with " " (space)
    res = res.replaceAll("-", " ");
    if (res.indexOf("{") == -1) {
        console.log("Error: ChatGPT returned a badly formatted string. Please try again.");
        return;
    }
    try {
        res = JSON.parse(res.substring(res.indexOf("{"), res.indexOf("}") + 1));
    }
    catch (e) {
        console.log("Error: ChatGPT returned a badly formatted string. Please try again.");
        await waitSeconds(2);
        return;
    }
    //log the prompt
    console.log("");
    res.prompts.forEach((prompt, i) => {
        if (parseInt(prompt.substring(0, 1)) == i + 1) console.log(chalk.green((i + 1) + ":  " + prompt.substring(2)));
        else if (parseInt(prompt.substring(0, 2)) == i + 1) console.log(chalk.green((i + 1) + ":  " + prompt.substring(3)));
        else console.log(chalk.green((i + 1) + ":  " + prompt));
    });
    // get the prompt from the user
    //promptChoice = await askMenuOption();
    // set the prompt answer
    //promptAnswer = res.prompts[Math.min(parseInt(promptChoice.OPTION) - 1, res.prompts.length - 1)];
    runOpts.promptAnswer = [];
    res.prompts.forEach((prompt, i) => {
        runOpts.promptAnswer.push(prompt);
    });
    // set the answers
    runOpts.generationsAnswer = parseInt(themeQuestions.GENERATIONS);
    runOpts.upscaleAnswer = parseInt(themeQuestions.UPSCALE);
    runOpts.variationAnswer = parseInt(themeQuestions.VARIATION);
    runOpts.saveUpscalesAnswer = themeQuestions.SAVEUPSCALES;
    runOpts.saveQuadsAnswer = themeQuestions.SAVEQUADS;
    runOpts.zoomAnswer = parseInt(themeQuestions.ZOOM);
    runOpts.aiUpscale = themeQuestions.AIUPSCALE;
    runOpts.runnerGo = true;
};

const startPromptGenerationFromSavedPrompt = async (runOpts) => {
    clearScreenBelowIntro();
    console.log("Start prompt generation from saved prompt");
    // print the prompts
    printPromptsFile("prompts");
    // ask for the prompt number
    let promptChoice2 = await askMenuOption((value) => {
        value = parseInt(value);
        if (value >= 0 <= prompts.prompts.length) return true;
        else return false;
    });
    // set the prompt answer
    runOpts.promptAnswer[0] = prompts.prompts[parseInt(promptChoice2) - 1];
    // ask basic questions
    let basicAnswers = await askImageGenQuestions();
    // set the answers
    runOpts.generationsAnswer = parseInt(basicAnswers.GENERATIONS);
    runOpts.upscaleAnswer = parseInt(basicAnswers.UPSCALE);
    runOpts.variationAnswer = parseInt(basicAnswers.VARIATION);
    runOpts.saveUpscalesAnswer = basicAnswers.SAVEUPSCALES;
    runOpts.saveQuadsAnswer = basicAnswers.SAVEQUADS;
    runOpts.zoomAnswer = parseInt(basicAnswers.ZOOM);
    runOpts.aiUpscale = basicAnswers.AIUPSCALE;
    runOpts.runnerGo = true;
};

const startPromptGenerationFromQuestions = async (runOpts) => {
    clearScreenBelowIntro();
    console.log("Start prompt generation from questions");
    // ask prompt questions
    let promptQuestions = await askPromptQuestions();
    // set the answers
    runOpts.promptAnswer[0] = promptQuestions.PROMPT;
    runOpts.generationsAnswer = parseInt(promptQuestions.GENERATIONS);
    runOpts.upscaleAnswer = parseInt(promptQuestions.UPSCALE);
    runOpts.variationAnswer = parseInt(promptQuestions.VARIATION);
    runOpts.saveUpscalesAnswer = promptQuestions.SAVEUPSCALES;
    runOpts.saveQuadsAnswer = promptQuestions.SAVEQUADS;
    runOpts.zoomAnswer = parseInt(promptQuestions.ZOOM);
    runOpts.aiUpscale = promptQuestions.AIUPSCALE;
    runOpts.runnerGo = true;
};

const startInfiniteZoom = async (runOpts) => {
    clearScreenBelowIntro();
    console.log("Start infinite zoom");
    let infiniteZoomQuestions = await askInfiniteQuestions();
    let folder2 = "";
    if (infiniteZoomQuestions.CUSTOMFILENAME) {
        let folderRes = await customFolderQuestion();
        folder2 = folderRes.FOLDER;
        // sanitize the folder name
        folder2 = folder2.replace(/[^a-z0-9]/gi, '_').toLowerCase();
    }
    if (infiniteZoomQuestions.SENDTOCHATGPT) {
        let res = await sendChatGPTPrompt(infiniteZoomQuestions.PROMPT);
        res = res.replaceAll("\"", "");
        midjourney.infiniteZoom(res, infiniteZoomQuestions.SAVEQUADS, infiniteZoomQuestions.CUSTOMFILENAME, folder2, infiniteZoomQuestions.AIUPSCALE);
        runOpts.runningProcess = true;
    } else {
        midjourney.infiniteZoom(infiniteZoomQuestions.PROMPT, infiniteZoomQuestions.SAVEQUADS, infiniteZoomQuestions.CUSTOMFILENAME, folder2, infiniteZoomQuestions.AIUPSCALE);
        runOpts.runningProcess = true;
    }
    runOpts.promptAnswer.length = 0;
    runOpts.runnerGo = true;
};

const startInfiniteVariationUpscales = async (runOpts) => {
    clearScreenBelowIntro();
    console.log("Start infinite variation upscales from prompt");
    let infinitePromptQuestions = await askInfiniteQuestions();
    let folder = "";
    if (infinitePromptQuestions.CUSTOMFILENAME) {
        let folderRes = await customFolderQuestion();
        folder = folderRes.FOLDER;
        // sanitize the folder name
        folder = folder.replace(/[^a-z0-9]/gi, '_').toLowerCase();
    }
    if (infinitePromptQuestions.SENDTOCHATGPT) {
        let res = await sendChatGPTPrompt(infinitePromptQuestions.PROMPT);
        res = res.replaceAll("\"", "");
        midjourney.infinitePromptVariationUpscales(res, infinitePromptQuestions.SAVEQUADS, infinitePromptQuestions.CUSTOMFILENAME, folder, null, infinitePromptQuestions.AIUPSCALE);
        runOpts.runningProcess = true;
    } else {
        midjourney.infinitePromptVariationUpscales(infinitePromptQuestions.PROMPT, infinitePromptQuestions.SAVEQUADS, infinitePromptQuestions.CUSTOMFILENAME, folder, null, infinitePromptQuestions.AIUPSCALE);
        runOpts.runningProcess = true;
    }
    runOpts.promptAnswer.length = 0;
    runOpts.runnerGo = true;
};

const runCommandsOnImageUUID = async (runOpts) => {
    clearScreenBelowIntro();
    console.log("Run commands on an image UUID");
    let uuid = await input({ message: 'What is the image / job UUID?' });

    let regex = /^[0-9a-fA-F]{8}\b-[0-9a-fA-F]{4}\b-[0-9a-fA-F]{4}\b-[0-9a-fA-F]{4}\b-[0-9a-fA-F]{12}$/g;

    if (!regex.test(uuid)) {
        console.log("Invalid UUID");
        await waitSeconds(2);
        return;
    }

    let img = await midjourney.showCommand(uuid);
    await waitSeconds(200);
    if (img == null) return;

    // ab608c1a-6156-41ec-be4f-a84b7239bac5

    // need to figure out how to get the available commands for the particular uuid

    // commands that could be run:
    // 1. if the image is a quad, call for upscale of 1, 2, 3, or 4
    // 2. if the image is a quad, call for variation of 1, 2, 3, or 4
    // 3. if the image is a quad, call for a variation on the prompt
    // 4. if the image is an upscale call for a weak variation
    // 5. if the image is an upscale call for a strong variation
    // 6. if the image is an upscale call for a 1.5x zoom
    // 7. if the image is an upscale call for a 2x zoom
    // 8. if the image is an upscale call for a 4x zoom
    // 9. if the image is an upscale download / save and local AI upscale
};

const startGenerationBasedOnKeywordList = async (runOpts) => {
    clearScreenBelowIntro();
    console.log("Start geneation based on keyword list");

    // ask for which keyword list to run against
    let keywordListNames = [];
    prompts.keyword_lists.forEach(list => {
        let name = list.name;
        keywordListNames.push({ name: name, value: name });
    });
    let keywordListAnswer = await select({ message: 'Which keyword list?', choices: keywordListNames });
    let connectMethod = await select({
        message: 'How do you want to connect your prompt and list items?',
        choices: [
            new Separator(" = For Artists/Illustrators/Creators = "),
            { name: "in the style of...", value: "in the style of" },
            { name: "as if created by...", value: "as if created by" },
            { name: "Inspired by...", value: "Inspired by" },
            { name: "Channeling the essence of...", value: "Channeling the essence of" },
            { name: "Mimicking the artistry of...", value: "Mimicking the artistry of" },
            { name: "Through the lens of...", value: "Through the lens of" },
            { name: "Echoing the aesthetics of...", value: "Echoing the aesthetics of" },
            { name: "Infused with the creativity of...", value: "Infused with the creativity of" },
            { name: "Blending the styles of...", value: "Blending the styles of" },
            new Separator(" = For Different Themes / Genres = "),
            { name: "Enveloped in...", value: "Enveloped in" },
            { name: "Radiating the vibe of...", value: "Radiating the vibe of" },
            { name: "Embodied with...", value: "Embodied with" },
            { name: "Suffused with...", value: "Suffused with" },
            { name: "Immersed in the atmosphere of...", value: "Immersed in the atmosphere of" },
            { name: "Incorporating elements of...", value: "Incorporating elements of" },
            { name: "Infused with the spirit of...", value: "Infused with the spirit of" },
            { name: "Evoking the feeling of...", value: "Evoking the feeling of" },
            { name: "Capturing the essence of...", value: "Capturing the essence of" },
            { name: "Conveying the mood of...", value: "Conveying the mood of" },
            new Separator(" = For Time Periods = "),
            { name: "Transported to the era of...", value: "Transported to the era of" },
            { name: "In the tradition of...", value: "In the tradition of" },
            { name: "Capturing the zeitgeist of...", value: "Capturing the zeitgeist of" },
            { name: "Anchored in the period of...", value: "Anchored in the period of" },
            { name: "Reimagined in the times of...", value: "Reimagined in the times of" },
            new Separator(" = For Locations = "),
            { name: "Springing from the lands of...", value: "Springing from the lands of" },
            { name: "Imbued with the spirit of...", value: "Imbued with the spirit of" },
            { name: "Harboring the mystique of...", value: "Harboring the mystique of" },
            { name: "Crafted with the allure of...", value: "Crafted with the allure of" },
            { name: "Breathing the air of...", value: "Breathing the air of" },
            new Separator(" = For Materials / Textures = "),
            { name: "Cloaked in the texture of...", value: "Cloaked in the texture of" },
            { name: "Fashioned with...", value: "Fashioned with" },
            { name: "Ornamented by the materials of...", value: "Ornamented by the materials of" },
            { name: "Interplaying with the substances of...", value: "Interplaying with the substances of" },
            { name: "Revealing in the medium of...", value: "Revealing in the medium of" },
            new Separator(" = For Mood / Emotions = "),
            { name: "Steeped in the emotion of...", value: "Steeped in the emotion of" },
            { name: "Resonating with the feeling of...", value: "Resonating with the feeling of" },
            { name: "Awash with the sentiment of...", value: "Awash with the sentiment of" },
            { name: "Drenched in the mood of...", value: "Drenched in the mood of" },
            { name: "Tinged with the emotional palette of...", value: "Tinged with the emotional palette of" },
            new Separator(" = For Colors = "),
            { name: "Drenched in the color of...", value: "Drenched in the color of" },
            { name: "Tinged with the color of...", value: "Tinged with the color of" },
            { name: "Washed in the color of...", value: "Washed in the color of" },
            { name: "Saturated with the color of...", value: "Saturated with the color of" },
            { name: "Immersed in the color of...", value: "Immersed in the color of" },
            new Separator(" = For Shapes = "),
            { name: "Shaped like...", value: "Shaped like" },
            { name: "Formed like...", value: "Formed like" },
            { name: "Structured like...", value: "Structured like" },
            { name: "Outlined like...", value: "Outlined like" },
            { name: "Outlined like...", value: "Outlined like" },
            new Separator(" = For Objects = "),
            { name: "Adorned with...", value: "Adorned with" },
            { name: "Decorated with...", value: "Decorated with" },
            { name: "Embellished with...", value: "Embellished with" },
            { name: "Ornamented with...", value: "Ornamented with" },
            { name: "Fashioned with...", value: "Fashioned with" },
            { name: "Crafted with...", value: "Crafted with" },
            { name: "Constructed with...", value: "Constructed with" },
            { name: "Made with...", value: "Made with" },
            { name: "Built with...", value: "Built with" },
            { name: "Composed of...", value: "Composed of" },
            new Separator(" = For People = "),
            { name: "In the image of...", value: "In the image of" },
            { name: "In the likeness of...", value: "In the likeness of" },
            { name: "Resembling...", value: "Resembling" },
            { name: "Depicting...", value: "Depicting" },
            { name: "Portraying...", value: "Portraying" },
            new Separator(" = For Techniques = "),
            { name: "Created with the technique of...", value: "Created with the technique of" },
            { name: "Using the technique of...", value: "Using the technique of" },
            { name: "Using the method of...", value: "Using the method of" },
            new Separator(" = For Lighting = "),
            { name: "Illuminated by...", value: "Illuminated by" },
            new Separator(" = For Camera Effects = "),
            { name: "Captured with the effect of...", value: "Captured with the effect of" },
            { name: "Captured with the lens of...", value: "Captured with the lens of" },
            { name: "Captured with the filter of...", value: "Captured with the filter of" },
            { name: "As if shot with the effect of...", value: "As if shot with the effect of" }
        ]
    });
    let listIndex = 0;
    for (let list_i = 0; list_i < keywordListNames.length; list_i++) {
        if (keywordListNames[list_i].value == keywordListAnswer) listIndex = list_i;
    }
    let keywordListArray = prompts.keyword_lists[listIndex].keywords;

    // ask for how many times to run each combination
    let runCount = await input({ message: 'How many times to run each combination?', default: "1" });

    // ask basic questions (save, local upscaling, save quads, etc)
    let saveQuads = await confirm({ message: 'Save quads?', default: "y" });
    let callForUpscales = await confirm({ message: 'Call for upscales?', default: "y" });
    let saveUpscales = false;
    let localUpscale = false;
    if (callForUpscales) {
        saveUpscales = await confirm({ message: 'Save upscales?', default: "y" });
        if (saveUpscales) {
            localUpscale = await confirm({ message: 'Run local AI upscale?', default: "y" });
        }
    }
    let callForx4Upscales = await confirm({ message: 'Call for x4 upscales?', default: "y" });

    // ask what to run the list against (prompt or file)
    let whatToRunAgainst = await select({ message: 'What to run the list against?', choices: [{ name: "Custom prompt", value: "custom" }, { name: "Saved Prompt", value: "saved" }, { name: "Generate Prompt", value: "generate" }, { name: "File", value: "file" }] });
    let prompt = "";
    // if prompt, ask if load prompt or type prompt
    if (whatToRunAgainst == "custom") {
        prompt = await input({ message: 'What is the prompt?' });
    } else if (whatToRunAgainst == "saved") {
        // print the prompts
        printPromptsFile("prompts");
        // ask for the prompt number
        let promptChoice2 = await askMenuOption((value) => {
            value = parseInt(value);
            if (value >= 0 <= prompts.prompts.length) return true;
            else return false;
        });
        // set the prompt answer
        prompt = prompts.prompts[parseInt(promptChoice2) - 1];
    } else if (whatToRunAgainst == "generate") {
        // ask theme questions
        let themeQuestions = await askThemeQuestionsShort();
        //split the theme keywords into an array
        let themeKeywords = themeQuestions.THEME.split(",");
        // create the theme object
        let theme = {
            keywords: themeKeywords,
            style: themeQuestions.STYLE
        };
        let chatGPTGenerations = await input({ message: 'How many prompts do you want to generate with ChatGPT? (max ' + userConfig.max_ChatGPT_Responses + ')', default: "1" });
        chatGPTGenerations = parseInt(chatGPTGenerations);
        // generate the prompt from the theme
        if (chatGPTGenerations > userConfig.max_ChatGPT_Responses) chatGPTGenerations = userConfig.max_ChatGPT_Responses;
        let res = await generatePromptFromThemKeywordsBatch(theme, chatGPTGenerations);
        if (res == null) return;
        // find and replace all "-" in res with " " (space)
        res = res.replaceAll("-", " ");
        if (res.indexOf("{") == -1) {
            console.log("Error: ChatGPT returned a badly formatted string. Please try again.");
            return;
        }
        try {
            res = JSON.parse(res.substring(res.indexOf("{"), res.indexOf("}") + 1));
        }
        catch (e) {
            console.log("Error: ChatGPT returned a badly formatted string. Please try again.");
            await waitSeconds(2);
            return;
        }
        //log the prompt
        console.log("");
        res.prompts.forEach((prompt, i) => {
            if (parseInt(prompt.substring(0, 1)) == i + 1) console.log(chalk.green((i + 1) + ":  " + prompt.substring(2)));
            else if (parseInt(prompt.substring(0, 2)) == i + 1) console.log(chalk.green((i + 1) + ":  " + prompt.substring(3)));
            else console.log(chalk.green((i + 1) + ":  " + prompt));
        });
        // get the prompt from the user
        let promptChoice = await askMenuOption();
        // set the prompt answer
        prompt = res.prompts[Math.min(parseInt(promptChoice) - 1, res.prompts.length - 1)];
        console.log({ prompt });
    } else if (whatToRunAgainst == "file") {
        // if file, ask for file
        if (!fs.existsSync("./inputFiles")) fs.mkdirSync("./inputFiles");
        let fileList = fs.readdirSync("./inputFiles");
        fileList.forEach((file, i) => {
            fileList[i] = { name: file.substring(file.lastIndexOf("/")), value: file };
        });
        let file = await select({ message: 'Which file?', choices: fileList });
        file = "./inputFiles/" + file;
        console.log(file);
        let confirmUpload = await confirm({ message: 'Are you sure you want to upload this file?', default: "y" });
        let url = "";
        if (confirmUpload) {
            let jobInitObj = discordUploader.uploadFile(file, userConfig.channel_id);
            jobInitObj.promise.then((res) => {
                console.log("Upload complete!");
                url = res;
            }).catch((e) => {
                console.log(e);
            });
            // wait for upload to complete
            let waitCount = 0;
            while (url == "") {
                waitCount++;
                process.stdout.write(".");
                if (waitCount > 10) break; // wait for 5 seconds max
                await waitSeconds(0.5);
            }

            // if the upload failed, use a random dog image instead
            if (url == "") {
                console.log("Upload failed! Using a random dog image instead.");
                let dog = await fetch('https://dog.ceo/api/breeds/image/random');
                let dogJson = await dog.json();
                url = dogJson.message;
            }
            prompt = url + " ";
        } else {
            return;
        }
    }

    runOpts.promptAnswer = [];
    keywordListArray.forEach(keyword => {
        // add the keyword to the end of the prompt
        if (prompt.indexOf(" --") == -1) runOpts.promptAnswer.push(prompt + connectMethod + ": " + keyword);
        else runOpts.promptAnswer.push(prompt.substring(0, prompt.indexOf(" --")) + connectMethod + ": " + keyword);
        // if the prompt had a weight value in it, add one to end with a slightly higher weight
        if (prompt.indexOf("::") > -1) {
            let value = prompt.substring(prompt.lastIndexOf("::") + 2, prompt.lastIndexOf("::") + 7);
            value = value.substring(0, value.indexOf(" "));
            value = parseInt(value);
            if (value > 0) {
                runOpts.promptAnswer[runOpts.promptAnswer.length - 1] += " ::" + Math.floor(value * 1.01);
            }
        }
    });

    runOpts.generationsAnswer = runCount;
    runOpts.upscaleAnswer = callForUpscales ? "4" : "0";
    runOpts.saveUpscalesAnswer = saveUpscales;
    runOpts.saveQuadsAnswer = saveQuads;
    runOpts.variationAnswer = 0;
    runOpts.zoomAnswer = 0
    runOpts.aiUpscale = localUpscale;
    runOpts.mjX4UpscaleAnswer = callForx4Upscales;
    runOpts.runnerGo = true;
};

async function main() {
    // show script intro
    let runOpts = new RunOptions();
    let menuOption = "";

    while (menuOption != "0") {
        MJloggerEnabled = false;
        // print menu options
        printMainMenu();
        // ask for the menu option
        menuOption = await askMenuOption((value) => {
            value = parseInt(value);
            if (value >= 0 <= 11) return true;
            else return false;
        });
        switch (menuOption) {
            case "1":  // show loaded themes, prompts, and options
                await showLoadedThemesPromptsOptions();
                break;
            case "2":  // modify prompts
                await modifyPrompts(runOpts);
                break;
            case "3": // modify themes
                await modifyThemes(runOpts);
                break;
            case "4":  // modify options
                await modifyOptions(runOpts);
                break;
            case "5":  // modify keyword lists
                await modifyKeywordLists(runOpts);
                break;
            case "6":  // start thematic generation from saved theme
                await startThematicGenerationFromSavedTheme(runOpts);
                break;
            case "7": // start thematic generation from questions
                await startThematicGenerationFromQuestions(runOpts);
                break;
            case "8": // start prompt generation from saved prompt
                await startPromptGenerationFromSavedPrompt(runOpts);
                break;
            case "9": // start prompt generation from questions
                await startPromptGenerationFromQuestions(runOpts);
                break;
            case "10": // start prompt generation from last questions
                clearScreenBelowIntro();
                console.log("Start prompt generation from last questions");
                runOpts.runnerGo = true;
                break;
            case "11": // start infinite zoom
                await startInfiniteZoom(runOpts);
                break;
            case "12": // start infinite variation upscales from prompt
                await startInfiniteVariationUpscales(runOpts);
                break;
            case "13": // run commands on an image UUID
                await runCommandsOnImageUUID(runOpts);
                break;
            case "14": // start generation based on keyword list
                await startGenerationBasedOnKeywordList(runOpts);
                break;
            case "0":
                clearScreenBelowIntro();
                console.log("Exit");
                return;
            default:
                clearScreenBelowIntro();
                console.log("Invalid option");
                break;
        }
        MJloggerEnabled = true;

        if (runOpts.runnerGo) {

            let promptCount = runOpts.promptAnswer.length;
            let prompt = "";
            let ready;
            if (!runOpts.runningProcess) ready = await readyToRun();
            if (ready.READY === false) ready.subREADY = false;
            let relaxedEabledFromUserConfig = false;
            let promptSuffix = "";

            if (prompts.options != null) {
                prompts.options.forEach((option, i) => {
                    if (option.enabled) {
                        promptSuffix += " --" + option.name + " " + option.value;
                        if (option.name == "relax") relaxedEabledFromUserConfig = true;
                    }
                });
            }

            // if the relaxed setting isn't set in the prompts file, check the user config
            if (!relaxedEabledFromUserConfig && userConfig.relaxedEnabled) promptSuffix += " --relax";
            let subRunningProcess = false;
            const run = async () => {
                return new Promise(async (resolve, reject) => {
                    for (let i = 0; i < promptCount; i++) {
                        prompt = runOpts.promptAnswer[i];
                        prompt += promptSuffix;
                        if (ready.READY === true) {
                            intro();
                            console.log("Running with prompt (" + (i + 1) + " of " + promptCount + "): ", prompt);
                            // run the main function
                            await midjourney.main(prompt, runOpts.generationsAnswer, runOpts.upscaleAnswer, runOpts.variationAnswer, runOpts.zoomAnswer, i == 0, runOpts.aiUpscale, runOpts.saveUpscalesAnswer, runOpts.saveQuadsAnswer,
                                runOpts.mjX4UpscaleAnswer ?
                                    {
                                        enabled: true,
                                        max: 1,
                                        save: true,
                                        aiUpscale: true
                                    } : null);
                            if (i < promptCount - 1) {
                                printRunComplete();
                                console.log("Pausing for a bit between runs...");
                                console.log("");
                                for (let i = 0; i < (userConfig.wait_time_after_done < 5 ? 5 : userConfig.wait_time_after_done * 2); i++) {
                                    process.stdout.write(".");
                                    await waitSeconds(0.5);
                                }
                            }
                            console.log("");
                        }
                    }
                    resolve();
                });
            };
            subRunningProcess = true;
            run().then(() => { subRunningProcess = false; }).catch((e) => { console.log(e); });

            let cancelTheRunner = false;
            let cancellation = null;
            if (runOpts.runningProcess) {
                MJLogger_runner("running");
                cancellation = input({ message: 'Press enter to cancel and return to menu.' }).then(() => { cancelTheRunner = true; });
            }

            let loopCount = 1;
            while (runOpts.runningProcess || subRunningProcess) {
                // create string of dots of length loopCount
                let dots = ".".repeat(loopCount);
                MJLogger_runner("Number of running upscale jobs: " + upscaler.getNumberOfRunningJobs() + "\nNumber of waiting upscale jobs: " + upscaler.getNumberOfWaitingJobs() + "\n" + dots);
                loopCount++;
                await waitSeconds(0.5);
                if (loopCount > 10) loopCount = 1;
                if (cancelTheRunner) {
                    cancellation.cancel();
                    runOpts.runningProcess = false;
                    midjourney.killProcess();
                }
            }

            // wait for upscaler to finish
            if (upscaler.getNumberOfRunningJobs() > 0 || upscaler.getNumberOfWaitingJobs() > 0) {
                console.log("Waiting for upscaler to finish...");
                while (upscaler.getNumberOfRunningJobs() > 0 || upscaler.getNumberOfWaitingJobs() > 0) {
                    await waitSeconds(0.5);
                    let dots = ".".repeat(loopCount);
                    MJLogger_runner("Number of running upscale jobs: " + upscaler.getNumberOfRunningJobs() + "\nNumber of waiting upscale jobs: " + upscaler.getNumberOfWaitingJobs() + "\n" + dots);
                    loopCount++;
                    if (loopCount > 10) loopCount = 1;
                }
            }

            // print done message
            if (!cancelTheRunner && ready.subREADY) {
                printDone();
                await waitSeconds(3);
            }
            runOpts.runnerGo = false;
        }
        intro();
    }
}

intro(); // the entry point of the script
await setup();
await main();
await midjourney.close();
fs.writeFileSync('user.json', JSON.stringify(userConfig, null, 2));
console.log("Done. Goodbye!");
process.exit(0);
