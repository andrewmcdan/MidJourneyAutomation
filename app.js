// @TODO: need to get info from midjourney about current available time for user, then show this on the console
//          when the app starts up.

import { MidjourneyDiscordBridge } from "midjourney-discord-bridge";

import axios from "axios";
import sharp from 'sharp';
import { s } from "@sapphire/shapeshift";
import fs from 'fs';
import { ChatGPTAPI } from 'chatgpt';
import inquirer from 'inquirer';
import chalk from 'chalk';
import figlet from 'figlet';

// get user config from file
const userConfig = JSON.parse(fs.readFileSync('user.json', 'utf8'));
// get data from prompts file
let prompts = JSON.parse(fs.readFileSync('prompts.json', 'utf8'));

async function sendChatGPTPrompt(prompt) {
    const chatgpt = new ChatGPTAPI({
        apiKey: userConfig.openai_key,
        completionParams: {
            model: 'gpt-4',
            temperature: 0.5,
            top_p: 0.8
        }
    });

    const res = await chatgpt.sendMessage(prompt);
    console.log(res.text)
    return res.text;
}

const intro = () => {
    // print a solid line the width of the console
    console.log(chalk.greenBright('='.repeat(process.stdout.columns)));
    console.log(
        chalk.green(
            figlet.textSync('Midjourney Automata', {
                font: 'roman',
                horizontalLayout: 'default',
                verticalLayout: 'default'
            })
        )
    );
    console.log(chalk.greenBright('='.repeat(process.stdout.columns)));
}

const printPromtptsFile = () => {
    if (prompts.themes == null) prompts.themes = [];
    console.log(chalk.yellowBright("Loaded themes: "));
    // parse the prompts object and print it to the console
    prompts.themes.forEach((theme, i) => {
        console.log(chalk.white((i + 1) + ":  " + JSON.stringify(theme)));
    });
    if (prompts.prompts != null) {
        console.log(chalk.yellowBright("Loaded prompts: "));
        prompts.prompts.forEach((prompt, i) => {
            console.log(chalk.white((i + 1) + ":  " + JSON.stringify(prompt)));
        });
    }
    if (prompts.options != null) {
        console.log(chalk.yellowBright("Loaded options: "));
        prompts.options.forEach((option, i) => {
            console.log(chalk.white((i + 1) + ":  " + JSON.stringify(option)));
        });
    }
}

const printMainMenu = () => {
    console.log(chalk.yellowBright("Main Menu: "));
    console.log(chalk.white("1. Modify prompts"));
    console.log(chalk.white("2. Modify themes"));
    console.log(chalk.white("3. Modify options (applies to all generations)"));
    console.log(chalk.white("4. Start thematic generation from saved theme"));
    console.log(chalk.white("5. Start thematic generation from questions"));
    console.log(chalk.white("6. Start prompt generation from saved prompt"));
    console.log(chalk.white("7. Start prompt generation from questions"));
    console.log(chalk.white("0. Exit"));
}

const askMenuOption = () => {
    const questions = [
        {
            name: 'OPTION',
            type: 'input',
            message: 'What is your choice?'
        }
    ];
    return inquirer.prompt(questions);
}

const readyToRun = () => {
    const questions = [
        {
            name: 'READY',
            type: 'input',
            message: 'Ready to run? (y/n)'
        }
    ];
    return inquirer.prompt(questions);
}

const askPromptQuestions = () => {
    const questions = [
        {
            name: 'PROMPT',
            type: 'input',
            message: 'What is your prompt?'
        },
        {
            name: 'GENERATIONS',
            type: 'input',
            message: 'How many times do you want to generate?'
        },
        {
            name: 'UPSCALE',
            type: 'input',
            message: 'How many times do you want to upscale?'
        },
        {
            name: 'VARIATION',
            type: 'input',
            message: 'How many times do you want to generate a variation?'
        },
        {
            name: 'ZOOM',
            type: 'input',
            message: 'How many times do you want to zoom out?'
        }
    ];
    return inquirer.prompt(questions);
}


// run
async function run() {
    // show script intro
    intro();
    let menuOption = { OPTION: "" };
    let prompAnswer = "a cute cat";
    let generationsAnswer = 4;
    let upscaleAnswer = 0;
    let variationAnswer = 0;
    let zoomAnswer = 0;

    while (menuOption.OPTION != "0") {
        // print the info from the prompts file
        printPromtptsFile();
        // print menu options
        printMainMenu();
        // ask for the menu option
        menuOption = await askMenuOption();
        // if option 1, modify prompts
        switch (menuOption.OPTION) {
            case "1":
                console.log("Modify prompts");
                break;
            case "2":
                console.log("Modify themes");
                break;
            case "3":
                console.log("Modify options (applies to all generations)");
                break;
            case "4":
                console.log("Start thematic generation from saved theme");
                break;
            case "5":
                console.log("Start thematic generation from questions");
                break;
            case "6":
                console.log("Start prompt generation from saved prompt");                
                break;
            case "7":
                console.log("Start prompt generation from questions");
                // ask prompt questions
                let promptQuestions = await askPromptQuestions();
                // set the answers
                prompAnswer = promptQuestions.PROMPT;
                generationsAnswer = parseInt(promptQuestions.GENERATIONS);
                upscaleAnswer = parseInt(promptQuestions.UPSCALE);
                variationAnswer = parseInt(promptQuestions.VARIATION);
                zoomAnswer = parseInt(promptQuestions.ZOOM);

                break;
            case "0":
                console.log("Exit");
                return;
                break;
            default:
                console.log("Invalid option");
                break;
        }
        // prompt the user for some info

        // save the info to the user.json file if needed
        // ask if ready to run
        let ready = await readyToRun();
        if (ready.READY == "y" || ready.READY == "Y") {
            // run the main function
            await main(prompAnswer, generationsAnswer, upscaleAnswer, variationAnswer, zoomAnswer);
        }
    }
}

async function main(MJprompt, maxGenerations = 100, maxUpscales = 4, maxVariations = 4, maxZooms = 4) {
    const mj = new MidjourneyDiscordBridge(userConfig.token, userConfig.guild_id, userConfig.channel_id);

    let img = await mj.generateImage("Vast cityscape filled with bioluminescent starships and tentacled cosmic deities, a fusion of HR Giger's biomechanics with the whimsicality of Jean Giraud(Moebius) , taking cues from Ridley Scott's Alien and H. P. Lovecraft's cosmic horror, eerie, surreal. --ar 7:5 --chaos 50");
    console.log("Midjourney image generation completed:", img.url);

    // Do something with the image
    makeFileFromIMGobj(img);
    // const response = await axios.get(img.url, { responseType: 'arraybuffer' });
    // const regexString = "([A-Za-z]+(_[A-Za-z]+)+).*([A-Za-z0-9]+(-[A-Za-z0-9]+)+)";
    // const regex = new RegExp(regexString);
    // const matches = regex.exec(img.url);
    // const filename = matches[0];
    // await sharp(response.data).toFile(filename + '.png');
    let upscaleQueue = [];
    upscaleQueue.push(img);
    let variationQueue = [];
    variationQueue.push(img);
    let zoomQueue = [];

    let zoomEnabled = true;
    let variationEnabled = false;

    let count = 0;
    while (count < 100) {
        console.log("#1#");
        console.log("upscaleQueue.length:", upscaleQueue.length);
        console.log("variationQueue.length:", variationQueue.length);
        console.log("zoomQueue.length:", zoomQueue.length);
        while (upscaleQueue.length > 0) {
            let img = upscaleQueue.shift();
            let upscaledImg = await mj.upscaleImage(img, 1, img.prompt);
            makeFileFromIMGobj(upscaledImg);
            if (zoomEnabled) zoomQueue.push(upscaledImg);
            upscaledImg = await mj.upscaleImage(img, 2, img.prompt);
            makeFileFromIMGobj(upscaledImg);
            if (zoomEnabled) zoomQueue.push(upscaledImg);
            upscaledImg = await mj.upscaleImage(img, 3, img.prompt);
            makeFileFromIMGobj(upscaledImg);
            if (zoomEnabled) zoomQueue.push(upscaledImg);
            upscaledImg = await mj.upscaleImage(img, 4, img.prompt);
            makeFileFromIMGobj(upscaledImg);
            if (zoomEnabled) zoomQueue.push(upscaledImg);
        }
        console.log("#2#");
        console.log("upscaleQueue.length:", upscaleQueue.length);
        console.log("variationQueue.length:", variationQueue.length);
        console.log("zoomQueue.length:", zoomQueue.length);
        if (variationEnabled) {
            while (variationQueue.length > 0) {
                let img = variationQueue.shift();
                let variationImg = await mj.variation(img, 1, img.prompt);
                makeFileFromIMGobj(variationImg);
                upscaleQueue.push(variationImg);
                //if(variationEnabled) variationQueue.push(variationImg);
                variationImg = await mj.variation(img, 2, img.prompt);
                makeFileFromIMGobj(variationImg);
                upscaleQueue.push(variationImg);
                //if(variationEnabled) variationQueue.push(variationImg);
                variationImg = await mj.variation(img, 3, img.prompt);
                makeFileFromIMGobj(variationImg);
                upscaleQueue.push(variationImg);
                //if(variationEnabled) variationQueue.push(variationImg);
                variationImg = await mj.variation(img, 4, img.prompt);
                makeFileFromIMGobj(variationImg);
                upscaleQueue.push(variationImg);
                //if(variationEnabled) variationQueue.push(variationImg);
            }
        }
        console.log("#3#");
        console.log("upscaleQueue.length:", upscaleQueue.length);
        console.log("variationQueue.length:", variationQueue.length);
        console.log("zoomQueue.length:", zoomQueue.length);
        if (zoomEnabled) {
            while (zoomQueue.length > 0) {
                let img = zoomQueue.shift();
                let zoomedImg = await mj.zoomOut(img, img.prompt);
                makeFileFromIMGobj(zoomedImg);
                if (variationEnabled) variationQueue.push(zoomedImg);
                upscaleQueue.push(zoomedImg);
            }
        }
        count++;
        console.log({ count });
    }
    mj.close()
}

run();

async function makeFileFromIMGobj(img) {
    const response = await axios.get(img.url, { responseType: 'arraybuffer' });
    const regexString = "([A-Za-z]+(_[A-Za-z]+)+).*([A-Za-z0-9]+(-[A-Za-z0-9]+)+)";
    const regex = new RegExp(regexString);
    const matches = regex.exec(img.url);
    const filename = matches[0];
    await sharp(response.data).toFile("output/" + filename + '.png');
}