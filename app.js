// @TODO: 
// - add question to each mode to ask if you want to save the quad files
// - add question to each mode to ask if the user wants to save any files or just run the bot
// - add question to each mode to ask if you want to use a custom folder and sequential naming
// - add feature to upload an image to Midjourney and run it with a keyword. Perhaps have a list of keywords to choose from, or run the whole list.
// - fix issue with modify theme, prompts, and options not returning to the main menu
// - add suggestions when modifying prompts, themes, and options
// - clear screen and redraw intro when the mj.main process starts

// Import necessary libraries and modules
import { MidjourneyDiscordBridge } from "midjourney-discord-bridge"; // Importing the 'MidjourneyDiscordBridge' class from a package.
import axios from "axios"; // Importing the 'axios' library for making HTTP requests.
import sharp from 'sharp'; // Importing the 'sharp' library for image processing.
import fs from 'fs'; // Importing the 'fs' library for file system operations.
import { ChatGPTAPI } from 'chatgpt'; // Importing the 'ChatGPTAPI' class from a package.
import { select, input, confirm } from '@inquirer/prompts'; // Importing functions for interactive command-line prompts.
import chalk from 'chalk'; // Importing 'chalk' for terminal text styling.
import figlet from 'figlet'; // Importing 'figlet' for creating ASCII art text.
import stringifyObject from 'stringify-object'; // Importing a module for converting objects to strings.
import Discordie from "discordie"; // Importing the 'Discordie' library for Discord bot functionality.
// import express from "express"; // Importing the 'express' library for creating a web server.
import Upscaler from 'ai-upscale-module'; // Importing the 'Upscaler' class from a package.
import EXIF from 'exiftool-js-read-write';
import puppeteer from 'puppeteer';
import * as cheerio from 'cheerio';

console.log("Starting Midjourney Discord Bot...");
let experimentalChatPromptEnabled = true;
let exifToolLoggingEnabled = false;

let doLoginEnabled = true;

// Define a set of question messages for prompts
const questionMessages = {
    SENDTOCHATGPT: "Do you want to send your prompt to ChatGPT? The response will be sent as is to MJ.",
    SAVEQUADS: "Do you want to save the quad files?",
    CUSTOMFILENAME: "Use custom folder and sequential naming?",
    PROMPT: "What is your prompt?",
    GENERATIONS: "How many runs per prompt do you want to run?",
    UPSCALE: "How many generations of upscaling do you want to allow? (Initial run + # of variation runs + # of zoom runs)",
    VARIATION: "How many generations of variations do you want to allow? (Started from the initial run)",
    ZOOM: "How many generations of zoom out do you want to allow? (Cumulative of all MJ upscales)",
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
        this.mj = new MidjourneyDiscordBridge(config.token, config.guild_id, config.channel_id);
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

    // run an infinite zoom 
    // MJprompt: the prompt to send to Midjourney
    // saveQuadFiles: whether to save the quad files
    // autoNameFiles: whether to automatically name using a counter or to use the name from the prompt / url
    // folder: the folder name to save the files to. defaults to output
    // aiUpscale: whether to run an additional AI upscale on the images
    async infiniteZoom(MJprompt, saveQuadFiles = true, autoNameFiles = false, folder = "", aiUpscale = false) {
        return new Promise(async (resolve, reject) => {
            // set the running process flag to true
            this.runningProcess = true;

            let parentUUID = "";
            // send the prompt to Midjourney and wait for the response. img is an object holding the response
            let img = await this.mj.generateImage(MJprompt, (obj, progress) => {
                // if the progress is not null, print it to the console
                if (progress != null) {
                    // process.stdout.write(progress + "%  ");
                    this.logger(progress + "%  ");
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
                // save the upscaled image and then AI upscale it again if aiUpscale is true
                this.makeFileFromIMGobj(imgToZoom, autoNameFiles ? filename : "", aiUpscale);
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
    infinitePromptVariationUpscales(MJprompt, saveQuadFiles = true, autoNameFiles = false, folder = "", cb = null, aiUpscale = false) {
        return new Promise(async (resolve, reject) => {
            // set the running process flag to true
            this.runningProcess = true;
            // send the prompt to Midjourney and wait for the response. img is an object holding the response
            let img = await this.mj.generateImage(MJprompt, (obj, progress) => {
                // if the progress is not null, print it to the console
                if (progress != null) {
                    // process.stdout.write(progress + "%  ");
                    this.logger(progress + "%  ");
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
                    this.makeFileFromIMGobj(temp, autoNameFiles ? filename : "", aiUpscale);
                }
                // reroll the image and save it
                imgToUpscale = await this.mj.rerollImage(imgToUpscale, img.prompt, this.breakout);
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

    // the main function runner
    // MJprompt: the prompt to send to Midjourney
    // maxGenerations: the max number of times to run the outer loop
    // maxUpscales: the max number of times to run the upscale loop
    // maxVariations: the max number of times to run the variation loop
    // maxZooms: the max number of times to run the zoom loop
    // printInfo: whether to print the Midjourney info to the console
    // aiUpscale: whether to run an additional AI upscale on the images
    main(MJprompt, maxGenerations = 100, maxUpscales = 4, maxVariations = 4, maxZooms = 4, printInfo = false, aiUpscale = false) {
        return new Promise(async (resolve, reject) => {
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
                this.logger("Midjourney info:\n\n" + info.embeds[0].description);
            }
            // loop while the max generations count is less than the max generations
            while (maxGenerationsCount < maxGenerations) {
                if (!this.breakout()) {
                    resolve();
                    break;
                }
                // send the prompt to Midjourney and wait for the response. img is an object holding the response
                let img = await mj.generateImage(MJprompt, (obj, progress) => {
                    //process.stdout.write(progress + "%  ");
                    this.logger(progress + "%  ");
                });
                if (img == null) break;
                if (!this.breakout()) {
                    resolve();
                    break;
                }
                let MJ_imgInfoObj = new MJ_imgInfo(img.uuid.value);

                this.logger("Initial Midjourney image generation completed");

                // save the quad files
                this.makeFileFromIMGobj(img).then(async (res) => {
                    this.writeEXIFdataToPNG(res, MJ_imgInfoObj);
                });
                // set up the queues
                let upscaleQueue = [];
                upscaleQueue.push(img);
                let variationQueue = [];
                variationQueue.push(img);
                let zoomQueue = [];
                // init the max counts
                let maxUpscalesCount = 0;
                let maxVariationsCount = 0;
                let maxZoomsCount = 0;
                let loop = [true, true, true];

                // loop as long as there are images in the queue and we haven't reached the max number of generations
                while (loop[0] || loop[1] || loop[2]) {
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
                            // Save the upscaled image, add it to the zoom queue, and AI upscale it if aiUpscale is true
                            this.makeFileFromIMGobj(upscaledImg, "", aiUpscale).then(async (res) => {
                                this.writeEXIFdataToPNG(res, MJ_imgInfoObj);
                            });
                            if (!this.breakout()) {
                                resolve();
                                break; // Exit the loop if breakout() returns false
                            }
                            zoomQueue.push(upscaledImg);
                        }
                        // increment the max upscales count
                        maxUpscalesCount++;
                    }
                    // loop through the queues and run the appropriate function
                    while (variationQueue.length > 0 && maxVariationsCount < maxVariations) {
                        // get the image from the queue
                        let img = variationQueue.shift();
                        for (let i = 1; i <= 4; i++) {
                            // Run the variation function on the image based on the loop counter 'i'
                            let variationImg = await mj.variation(img, i, img.prompt);
                            if (variationImg == null) break;
                            let MJ_imgInfoObj = new MJ_imgInfo(variationImg.uuid.value);
                            // Save the variation image
                            this.makeFileFromIMGobj(variationImg).then(async (res) => {
                                this.writeEXIFdataToPNG(res, MJ_imgInfoObj);
                            });
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
                    // loop through the queues and run the appropriate function
                    while (zoomQueue.length > 0 && maxZoomsCount < maxZooms) {
                        // get the image from the queue
                        let img = zoomQueue.shift();
                        // run the zoom out function on the image and save it
                        let zoomedImg = await mj.zoomOut(img, img.prompt);
                        if (zoomedImg == null) break;
                        let MJ_imgInfoObj = new MJ_imgInfo(zoomedImg.uuid.value);
                        // save the image but don't AI upscale it
                        this.makeFileFromIMGobj(zoomedImg).then(async (res) => {
                            this.writeEXIFdataToPNG(res, MJ_imgInfoObj);
                        });
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
                    // check if we should continue looping
                    loop[0] = upscaleQueue.length > 0 && maxUpscalesCount < maxUpscales;
                    loop[1] = variationQueue.length > 0 && maxVariationsCount < maxVariations;
                    loop[2] = zoomQueue.length > 0 && maxZoomsCount < maxZooms;
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
if (userConfig.CLIENT_ID == null || userConfig.CLIENT_ID == undefined || userConfig.CLIENT_SECRET == null || userConfig.CLIENT_SECRET == undefined) {
    doLoginEnabled = false;
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

    // Navigate the page to a URL
    await page.goto('https://discord.com/login', { waitUntil: 'networkidle2', timeout: 60000 });

    // Set screen size
    await page.setViewport({ width: 1080, height: 1024 });
    let email = await input({ message: 'What is your email?' }); // andrewmcan@gmail.com
    let password = await input({ message: 'What is your password?', type: 'password' }); // uFwUaN5pgVWwBqV
    email = "andrewmcdan@gmail.com";
    password = "uFwUaN5pgVWwBqV";


    for (let i = 0; i < email.length; i++) {
        await page.type('input[name="email"]', email.charAt(i));
        // wait a random amount fo time between 0.5 and 1 seconds
        await waitSeconds(Math.random() * (0.1) + 0.5);
    }
    //await page.type('input[name="email"]', "andrewmcan@gmail.com");
    await page.keyboard.press('Tab');
    for (let i = 0; i < password.length; i++) {
        await page.type('input[name="password"]', password.charAt(i));
        // wait a random amount fo time between 0.5 and 1 seconds
        await waitSeconds(Math.random() * (0.1) + 0.5);
    }
    //await page.type('input[name="password"]', "uFwUaN5pgVWwBqV");

    await Promise.all([
        page.click('button[type="submit"]'),
        waitSeconds(10)
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
    // return the token
    return newToken;
}

// set up discordie
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

    // get list of guilds
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
    console.log("Shutting down Discordie client...");
    await DiscordClient.disconnect();
    // start the Midjourney instance
    midjourney = new MJ_Handler({
        token: userConfig.token,
        guild_id: userConfig.guild_id,
        channel_id: userConfig.channel_id,
    });

    // register the MJ logger callback
    midjourney.registerMJLoggerCB(MJlogger_MJbridge);
}

// Logging function designed to print to the console in a specific location so that it doesn't interfere with the prompts
async function MJlogger(msg) {
    if (MJloggerEnabled) {
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
}

// print a message to the console in a location relative to the current cursor position
function printToLineRelative(line, text) {

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

// send a prompt to chatgpt and return the response
async function sendChatGPTPrompt(prompt) {
    const chatgpt = new ChatGPTAPI({
        apiKey: userConfig.openai_key,
        completionParams: {
            model: 'gpt-4',
            temperature: 0.5,
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
                    if (count % 2 == 0) {
                        process.stdout.write(".");
                    }
                }
            }
        }).then((response) => {
            if (!cancelTheGPT) res = response; // set res to the response if the user hasn't pressed enter to cancel
        }).catch((err) => {
            console.log("ChatGPT error statusCode: ", err.statusCode);
        });
    // wait for the response or for the user to press enter to cancel
    while (res == null && !cancelTheGPT) {
        await waitSeconds(1);
    }
    if (cancellation.cancel != null) {
        // cancel the cancellation promise
        cancellation.cancel();
    }
    if (cancelTheGPT) {
        console.log("Prompt cancelled");
        await waitSeconds(1);
        return null;
    }
    return res.text;
}

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
    chatPrompt += ". An example prompt would look like this: \"Vast cityscape filled with bioluminescent starships and tentacled cosmic deities, a fusion of HR Giger's biomechanics with the whimsicality of Jean Giraud (Moebius), taking cues from Ridley Scott's Alien and H. P. Lovecraft's cosmic horror, eerie, surreal.\" ";
    chatPrompt += "Prefer succinctness over verbosity. Be sure to specify the art style at the end of the prompt. The prompts you write need to be output in JSON with the following schema: {\"prompts\":[\"your first prompt here\",\"your second prompt here\"]}. Do not respond with any text other than the JSON. Generate " + count + " prompts for this theme. Avoid words that can be construed as offensive, sexual, overly violent, or related.";
    let chatResponse = await sendChatGPTPrompt(chatPrompt);
    //console.log(chatResponse);
    // if "chatRequest.txt" doesn't exist, create it
    if (!fs.existsSync("chatRequest.txt")) {
        fs.writeFileSync("chatRequest.txt", "");
    }
    fs.writeFileSync("chatRequest.txt", chatPrompt);
    // if "chatResponse.txt" doesn't exist, create it
    if (!fs.existsSync("chatResponse.txt")) {
        fs.writeFileSync("chatResponse.txt", "");
    }
    fs.writeFileSync("chatResponse.txt", chatResponse);
    return chatResponse;
}

async function generatePromptFromThemKeywordsBatch(theme, count = 10) {
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
        console.log({ chatResponse });
        if (chatResponse != null) {
            try {
                JSON.parse(chatResponse).prompts.forEach((p) => {
                    prompts.push(p);
                });
            } catch (e) {
                console.log("Error parsing prompts: ", e);
            }
        }
        if (i < batchJobCount - 1 && chatResponse != null) {
            console.log();
            console.log("Waiting 2 seconds between OpenAI requests...");
            await waitSeconds(2);
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
            confirmation = confirm({ message: 'Waiting ' + count + ' seconds. Enter to cancel and return to menu.' }).then(() => {
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
    let screenWidth = process.stdout.columns;
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
    // print a solid line the width of the console
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

const printPromptsFile = (choice = "all") => {
    if (choice == "themes" || choice == "all") {
        if (prompts.themes == null) prompts.themes = [];
        console.log(chalk.yellowBright("Loaded themes: "));
        // parse the prompts object and print it to the console
        prompts.themes.forEach((theme, i) => {
            console.log(chalk.white((i + 1) + ":  " + JSON.stringify(theme)));
        });
    }
    if (choice == "prompts" || choice == "all") {
        if (prompts.prompts != null) {
            console.log(chalk.yellowBright("Loaded prompts: "));
            prompts.prompts.forEach((prompt, i) => {
                console.log(chalk.white((i + 1) + ":  " + JSON.stringify(prompt)));
            });
        }
    }
    if (choice == "options" || choice == "all") {
        if (prompts.options != null) {
            console.log(chalk.yellowBright("Loaded options: "));
            prompts.options.forEach((option, i) => {
                console.log(chalk.white((i + 1) + ":  " + JSON.stringify(option)));
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
    console.log(chalk.white("5. Start thematic generation from saved theme"));
    console.log(chalk.white("6. Start thematic generation from questions"));
    console.log(chalk.white("7. Start prompt generation from saved prompt"));
    console.log(chalk.white("8. Start prompt generation from questions"));
    console.log(chalk.white("9. Start prompt generation from last questions"));
    console.log(chalk.white("10. Start infinite zoom"));
    console.log(chalk.white("11. Start infinite variation upscales from prompt"));
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

const askThemeQuestionsShort = async () => {
    let res = {};
    res.THEME = await input({ message: questionMessages.THEME });
    res.STYLE = await input({ message: 'What is your style?' });
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

const printModifyPromptsMenu = () => {
    console.log(chalk.yellowBright("Modify Prompts Menu: "));
    console.log(chalk.white("1. Add prompt"));
    console.log(chalk.white("2. Remove prompt"));
    console.log(chalk.white("3. Modify prompt"));
    console.log(chalk.white("0. Back"));
}

const printModifyThemesMenu = () => {
    console.log(chalk.yellowBright("Modify Themes Menu: "));
    console.log(chalk.white("1. Add theme"));
    console.log(chalk.white("2. Remove theme"));
    console.log(chalk.white("3. Modify theme"));
    console.log(chalk.white("0. Back"));
}

const printModifyOptionsMenu = () => {
    console.log(chalk.yellowBright("Modify Options Menu: "));
    console.log(chalk.white("1. Add option"));
    console.log(chalk.white("2. Remove option"));
    console.log(chalk.white("3. Modify option"));
    console.log(chalk.white("0. Back"));
}

// run
async function run() {
    // show script intro
    let menuOption = { OPTION: "" };
    let promptAnswer = [];
    promptAnswer.push("a cute cat");
    let generationsAnswer = 4;
    let upscaleAnswer = 0;
    let variationAnswer = 0;
    let zoomAnswer = 0;

    let themeKeywords;
    let themeChoice;
    let basicAnswers;
    let theme;
    let res;
    let aiUpscale = false;
    let promptChoice;
    let addOption;
    let option;
    let removeTheme;
    let runningProcess = false;

    let runnerGo = false;

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
        // if option 1, modify prompts
        switch (menuOption) {
            case "1":  // show loaded themes, prompts, and options
                clearScreenBelowIntro();
                console.log("Show loaded themes, prompts, and options");
                // print the info from the prompts file
                printPromptsFile();
                // wait for enter to be pressed
                await pressEnterToReturnToMenu();
                break;
            case "2":  // modify prompts
                clearScreenBelowIntro();
                console.log("Modify prompts");
                let modifyPromptsMenuOption = "";
                while (modifyPromptsMenuOption != "0") {
                    printPromptsFile("prompts");
                    // print the modify prompts menu
                    printModifyPromptsMenu();
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
                break;
            case "3": // modify themes
                clearScreenBelowIntro();
                console.log("Modify themes");
                let modifyThemesMenuOption = { OPTION: "" };
                while (modifyThemesMenuOption.OPTION != "0") {
                    printPromptsFile("themes");
                    // print the modify themes menu
                    printModifyThemesMenu();
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
                            removeTheme = await askMenuOption((value) => {
                                value = parseInt(value);
                                if (value >= 0 <= prompts.themes.length) return true;
                                else return false;
                            });
                            // remove the theme from the prompts object
                            if (prompts.themes == null) prompts.themes = [];
                            prompts.themes.splice(parseInt(removeTheme) - 1, 1);
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
                            let modifyThemeQuestions = await askThemeQuestionsShort();
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
                break;
            case "4":  // modify options
                clearScreenBelowIntro();
                console.log("Modify options (applies to all generations)");
                let modifyOptionsMenuOption = "";
                while (modifyOptionsMenuOption != "0") {
                    printPromptsFile("options");
                    // print the modify options menu
                    printModifyOptionsMenu();
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
                            addOption = await askOptionQuestions();
                            // add the option to the prompts object
                            if (prompts.options == null) prompts.options = [];
                            // create the option object
                            option = {
                                name: addOption.NAME,
                                value: addOption.VALUE,
                                enabled: addOption.ENABLED == "y" || addOption.ENABLED == "Y" ? true : false
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
                break;
            case "5":  // start thematic generation from saved theme
                clearScreenBelowIntro();
                console.log("Start thematic generation from saved theme");
                // print the themes
                printPromptsFile("themes");
                // ask for the theme number
                themeChoice = await askMenuOption((value) => {
                    value = parseInt(value);
                    if (value >= 0 <= prompts.themes.length) return true;
                    else return false;
                });
                basicAnswers = await askImageGenQuestions();
                //split the theme keywords into an array
                themeKeywords = prompts.themes[parseInt(themeChoice) - 1].keywords;
                // create the theme object
                theme = {
                    keywords: themeKeywords,
                    style: prompts.themes[parseInt(themeChoice) - 1].style
                };
                basicAnswers.CHATGPTGENERATIONS = parseInt(basicAnswers.CHATGPTGENERATIONS);
                if (basicAnswers.CHATGPTGENERATIONS > userConfig.max_ChatGPT_Responses) basicAnswers.CHATGPTGENERATIONS = userConfig.max_ChatGPT_Responses;
                // generate the prompt from the theme
                res = await generatePromptFromThemKeywordsBatch(theme, basicAnswers.CHATGPTGENERATIONS);
                if (res == null) break;
                // find and replace all "-" in res with " " (space)
                res = res.replaceAll("-", " ");
                if (res.indexOf("{") == -1) {
                    console.log("Error: ChatGPT returned a badly formatted string. Please try again.");
                    await waitSeconds(2);
                    break;
                }
                try {
                    res = JSON.parse(res.substring(res.indexOf("{"), res.indexOf("}") + 1));
                }
                catch (e) {
                    console.log("Error: ChatGPT returned a badly formatted string. Please try again.");
                    await waitSeconds(2);
                    break;
                }
                console.log("");
                //log the prompt
                res.prompts.forEach((prompt, i) => {
                    if (parseInt(prompt.substring(0, 1)) == i + 1) console.log(chalk.green((i + 1) + ":  " + prompt.substring(2)));
                    else if (parseInt(prompt.substring(0, 2)) == i + 1) console.log(chalk.green((i + 1) + ":  " + prompt.substring(3)));
                    else console.log(chalk.green((i + 1) + ":  " + prompt));
                });
                promptAnswer = [];
                res.prompts.forEach((prompt, i) => {
                    promptAnswer.push(prompt);
                });
                // set the answers
                generationsAnswer = parseInt(basicAnswers.GENERATIONS);
                upscaleAnswer = parseInt(basicAnswers.UPSCALE);
                variationAnswer = parseInt(basicAnswers.VARIATION);
                zoomAnswer = parseInt(basicAnswers.ZOOM);
                aiUpscale = basicAnswers.AIUPSCALE;
                runnerGo = true;
                break;
            case "6": // start thematic generation from questions
                clearScreenBelowIntro();
                console.log("Start thematic generation from questions");
                // ask theme questions
                let themeQuestions = await askThemeQuestions();

                //split the theme keywords into an array
                themeKeywords = themeQuestions.THEME.split(",");
                // create the theme object
                theme = {
                    keywords: themeKeywords,
                    style: themeQuestions.STYLE
                };
                // generate the prompt from the theme
                if (themeQuestions.CHATGPTGENERATIONS > userConfig.max_ChatGPT_Responses) themeQuestions.CHATGPTGENERATIONS = userConfig.max_ChatGPT_Responses;
                res = await generatePromptFromThemKeywordsBatch(theme, themeQuestions.CHATGPTGENERATIONS);
                if (res == null) break;
                // find and replace all "-" in res with " " (space)
                res = res.replaceAll("-", " ");
                if (res.indexOf("{") == -1) {
                    console.log("Error: ChatGPT returned a badly formatted string. Please try again.");
                    break;
                }
                try {
                    res = JSON.parse(res.substring(res.indexOf("{"), res.indexOf("}") + 1));
                }
                catch (e) {
                    console.log("Error: ChatGPT returned a badly formatted string. Please try again.");
                    await waitSeconds(2);
                    break;
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
                promptAnswer = [];
                res.prompts.forEach((prompt, i) => {
                    promptAnswer.push(prompt);
                });
                // set the answers
                generationsAnswer = parseInt(themeQuestions.GENERATIONS);
                upscaleAnswer = parseInt(themeQuestions.UPSCALE);
                variationAnswer = parseInt(themeQuestions.VARIATION);
                zoomAnswer = parseInt(themeQuestions.ZOOM);
                aiUpscale = themeQuestions.AIUPSCALE;
                runnerGo = true;
                break;
            case "7": // start prompt generation from saved prompt
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
                promptAnswer[0] = prompts.prompts[parseInt(promptChoice2) - 1];
                // ask basic questions
                basicAnswers = await askImageGenQuestions();
                // set the answers
                generationsAnswer = parseInt(basicAnswers.GENERATIONS);
                upscaleAnswer = parseInt(basicAnswers.UPSCALE);
                variationAnswer = parseInt(basicAnswers.VARIATION);
                zoomAnswer = parseInt(basicAnswers.ZOOM);
                aiUpscale = basicAnswers.AIUPSCALE;
                runnerGo = true;
                break;
            case "8": // start prompt generation from questions
                clearScreenBelowIntro();
                console.log("Start prompt generation from questions");
                // ask prompt questions
                let promptQuestions = await askPromptQuestions();
                // set the answers
                promptAnswer[0] = promptQuestions.PROMPT;
                generationsAnswer = parseInt(promptQuestions.GENERATIONS);
                upscaleAnswer = parseInt(promptQuestions.UPSCALE);
                variationAnswer = parseInt(promptQuestions.VARIATION);
                zoomAnswer = parseInt(promptQuestions.ZOOM);
                aiUpscale = promptQuestions.AIUPSCALE;
                runnerGo = true;
                break;
            case "9": // start prompt generation from last questions
                clearScreenBelowIntro();
                console.log("Start prompt generation from last questions");
                runnerGo = true;
                break;
            case "10": // start infinite zoom
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
                    runningProcess = true;
                } else {
                    midjourney.infiniteZoom(infiniteZoomQuestions.PROMPT, infiniteZoomQuestions.SAVEQUADS, infiniteZoomQuestions.CUSTOMFILENAME, folder2, infiniteZoomQuestions.AIUPSCALE);
                    runningProcess = true;
                }
                promptAnswer.length = 0;
                runnerGo = true;
                break;
            case "11":
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
                    runningProcess = true;
                } else {
                    midjourney.infinitePromptVariationUpscales(infinitePromptQuestions.PROMPT, infinitePromptQuestions.SAVEQUADS, infinitePromptQuestions.CUSTOMFILENAME, folder, null, infinitePromptQuestions.AIUPSCALE);
                    runningProcess = true;
                }
                promptAnswer.length = 0;
                runnerGo = true;
                break;
            case "0":
                clearScreenBelowIntro();
                console.log("Exit");
                return;
                break;
            default:
                clearScreenBelowIntro();
                console.log("Invalid option");
                break;
        }
        MJloggerEnabled = true;

        if (runnerGo) {

            let promptCount = promptAnswer.length;
            let prompt = "";
            let ready;
            if (!runningProcess) ready = await readyToRun();
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
                        prompt = promptAnswer[i];
                        prompt += promptSuffix;
                        if (ready.READY === true) {
                            console.log("Running with prompt (" + (i + 1) + " of " + promptCount + "): ", prompt);
                            // run the main function
                            await midjourney.main(prompt, generationsAnswer, upscaleAnswer, variationAnswer, zoomAnswer, i == 0, aiUpscale);
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
            if (runningProcess) {
                MJLogger_runner("running");
                cancellation = input({ message: 'Press enter to cancel and return to menu.' }).then(() => { cancelTheRunner = true; });
            }

            let loopCount = 1;
            while (runningProcess || subRunningProcess) {
                // create string of dots of length loopCount
                let dots = ".".repeat(loopCount);
                MJLogger_runner("Number of running upscale jobs: " + upscaler.getNumberOfRunningJobs() + "\nNumber of waiting upscale jobs: " + upscaler.getNumberOfWaitingJobs() + "\n" + dots);
                loopCount++;
                await waitSeconds(0.5);
                if (loopCount > 10) loopCount = 1;
                if (cancelTheRunner) {
                    cancellation.cancel();
                    runningProcess = false;
                    midjourney.killProcess();
                }
            }

            // print done message
            if (!cancelTheRunner && ready.subREADY) {
                printDone();
                await waitSeconds(3);
            }
            runnerGo = false;
        }

        intro();
    }
}

intro();
await setup();
await run();
await midjourney.close();
fs.writeFileSync('user.json', JSON.stringify(userConfig, null, 2));
console.log("Done. Goodbye!");
process.exit(0);
