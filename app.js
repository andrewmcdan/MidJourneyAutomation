// @TODO: 
// - add question to each mode to ask if you want to save the quad files
// - add question to each mode to ask if you want to use a custom folder and sequential naming
// - experiment with automatically upscaling with upscayl (https://github.com/upscayl/upscayl)

import { MidjourneyDiscordBridge } from "midjourney-discord-bridge";

import axios from "axios";
import sharp from 'sharp';
//import { s } from "@sapphire/shapeshift";
import fs from 'fs';
import { ChatGPTAPI } from 'chatgpt';
//import inquirer from 'inquirer';
import { select, input, confirm } from '@inquirer/prompts';
import chalk from 'chalk';
import figlet from 'figlet';
import stringifyObject from 'stringify-object';
import Discordie from "discordie";
import express from "express";



class MJ_Handler {
    constructor(config) {
        this.config = config;
        this.mj = new MidjourneyDiscordBridge(config.token, config.guild_id, config.channel_id);
    }

    registerMJLoggerCB(cb) {
        this.mj.registerLoggerCB(cb);
        this.logger = cb;
    }

    async close() {
        await this.mj.close();
    }

    runningProcess = false;
    killCalled = false;

    async killProcess() {
        this.killCalled = true;
    }

    breakout() {
        if (this.killCalled) {
            this.runningProcess = false;
            this.killCalled = false;
            //this.mj.close();
        }
    }

    async infiniteZoom(MJprompt, saveQuadFiles = true, autoNameFiles = false, folder = "") {
        this.runningProcess = true;

        let img = await this.mj.generateImage(MJprompt, (obj, progress) => {
            if (progress != null) {
                process.stdout.write(progress + "%  ");
            }
            this.breakout();
        });
        console.log("\nInitial Midjourney image generation completed\n");
        if (saveQuadFiles) this.makeFileFromIMGobj(img);
        let imgToZoom = img;
        let imgToScale = img;

        let filenameBase = folder + "/";
        // check to see if the folder exists, if not, create it
        try {
            if (!fs.existsSync("output/" + filenameBase)) {
                fs.mkdirSync("output/" + filenameBase);
            }
        } catch (err) {
            console.log(err);
        }

        let fileCount = 1;
        while (this.runningProcess) {
            // if the kill process was called, exit the loop
            this.breakout();
            let fileCountString = fileCount.toString().padStart(4, "0");
            let filename = filenameBase + fileCountString;
            // generate random number between 1 and 4
            let random1to4 = Math.floor(Math.random() * 4) + 1;
            imgToZoom = await this.mj.upscaleImage(imgToScale, random1to4, img.prompt, this.breakout);
            if (!this.runningProcess) break;
            await this.makeFileFromIMGobj(imgToZoom, autoNameFiles ? filename : "");
            imgToScale = await this.mj.zoomOut(imgToZoom, img.prompt, this.breakout);
            if (!this.runningProcess) break;
            if (saveQuadFiles) this.makeFileFromIMGobj(imgToScale, autoNameFiles ? filename : "");
            fileCount++;
        }
    }

    async infinitePromptVariationUpscales(MJprompt, saveQuadFiles = true, autoNameFiles = false, folder = "", cb = null) {
        this.runningProcess = true;
        //console.log("Starting infinite prompt variation upscales... (press q to quit)");
        //const mj = new MidjourneyDiscordBridge(userConfig.token, guild_id_from_discordie, channel_id_from_discordie);
        let img = await this.mj.generateImage(MJprompt, (obj, progress) => {
            if (progress != null) {
                process.stdout.write(progress + "%  ");
            }
            this.breakout();
        });
        console.log("\nInitial Midjourney image generation completed");
        if (saveQuadFiles) await this.makeFileFromIMGobj(img);

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

        let fileCount = 1;

        while (this.runningProcess) {
            this.breakout();
            if (!this.runningProcess) break;
            // loop through 4 times and upscale each image
            for (let i = 1; i <= 4; i++) {
                // pad the file count with 0s to make it 4 digits long (0001, 0002, etc)
                let fileCountString = fileCount.toString().padStart(4, "0");
                let filename = filenameBase + fileCountString;
                fileCount++;
                // upscale the image and save it
                let temp = await this.mj.upscaleImage(imgToUpscale, i, img.prompt, this.breakout);
                if (!this.runningProcess) break;
                await this.makeFileFromIMGobj(temp, autoNameFiles ? filename : "");
            }
            // reroll the image and save it
            imgToUpscale = await this.mj.rerollImage(imgToUpscale, img.prompt, this.breakout);
            if (!this.runningProcess) break;
            if (saveQuadFiles) {
                let fileCountString = fileCount.toString().padStart(4, "0");
                fileCount++;
                // create the filename with the base and the padded file count
                filename = filenameBase + fileCountString;
                await this.makeFileFromIMGobj(imgToUpscale, autoNameFiles ? filename : "");
            }
        }
    }

    async main(MJprompt, maxGenerations = 100, maxUpscales = 4, maxVariations = 4, maxZooms = 4, printInfo = false) {
        maxZooms = maxZooms * 4; // zooms are 4x faster than upscales and variations
        //const mj = new MidjourneyDiscordBridge(userConfig.token, guild_id_from_discordie, channel_id_from_discordie);
        //const mj = new MidjourneyDiscordBridge(userConfig.token, userConfig.guild_id, userConfig.channel_id);
        const mj = this.mj;
        let maxGenerationsCount = 0;
        if (printInfo) {
            let info = await mj.getInfo();
            console.log("Midjourney info:\n\n", info.embeds[0].description);
        }

        while (maxGenerationsCount < maxGenerations) {
            let img = await mj.generateImage(MJprompt, (obj, progress) => {
                //process.stdout.write(progress + "%  ");
                this.logger({ runner: progress + "%  " });
            });
            //console.log("\nMidjourney image generation completed:", img.url);
            //console.log("\nInitial Midjourney image generation completed\n");
            this.logger({ runner: "Initial Midjourney image generation completed" });

            // Do something with the image
            this.makeFileFromIMGobj(img);

            let upscaleQueue = [];
            upscaleQueue.push(img);
            let variationQueue = [];
            variationQueue.push(img);
            let zoomQueue = [];
            let maxUpscalesCount = 0;
            let maxVariationsCount = 0;
            let maxZoomsCount = 0;
            let loop = [true, true, true];

            // loop as long as there are images in the queue and we haven't reached the max number of generations
            while (loop[0] || loop[1] || loop[2]) {
                loop[0] = upscaleQueue.length > 0 && maxUpscalesCount < maxUpscales;
                loop[1] = variationQueue.length > 0 && maxVariationsCount < maxVariations;
                loop[2] = zoomQueue.length > 0 && maxZoomsCount < maxZooms;
                //console.log("Processing request queues....");
                this.logger({ runner: "Processing request queues...." });
                //console.log("upscaleQueue.length:", upscaleQueue.length);
                //console.log("variationQueue.length:", variationQueue.length);
                //console.log("zoomQueue.length:", zoomQueue.length);
                while (upscaleQueue.length > 0 && maxUpscalesCount < maxUpscales) {
                    let img = upscaleQueue.shift();
                    let upscaledImg = await mj.upscaleImage(img, 1, img.prompt);
                    this.makeFileFromIMGobj(upscaledImg);
                    zoomQueue.push(upscaledImg);
                    upscaledImg = await mj.upscaleImage(img, 2, img.prompt);
                    this.makeFileFromIMGobj(upscaledImg);
                    zoomQueue.push(upscaledImg);
                    upscaledImg = await mj.upscaleImage(img, 3, img.prompt);
                    this.makeFileFromIMGobj(upscaledImg);
                    zoomQueue.push(upscaledImg);
                    upscaledImg = await mj.upscaleImage(img, 4, img.prompt);
                    this.makeFileFromIMGobj(upscaledImg);
                    zoomQueue.push(upscaledImg);
                    maxUpscalesCount++;
                }
                //console.log("upscaleQueue.length:", upscaleQueue.length);
                //console.log("variationQueue.length:", variationQueue.length);
                //console.log("zoomQueue.length:", zoomQueue.length);
                while (variationQueue.length > 0 && maxVariationsCount < maxVariations) {
                    let img = variationQueue.shift();
                    let variationImg = await mj.variation(img, 1, img.prompt);
                    this.makeFileFromIMGobj(variationImg);
                    upscaleQueue.push(variationImg);
                    variationQueue.push(variationImg);
                    variationImg = await mj.variation(img, 2, img.prompt);
                    this.makeFileFromIMGobj(variationImg);
                    upscaleQueue.push(variationImg);
                    variationQueue.push(variationImg);
                    variationImg = await mj.variation(img, 3, img.prompt);
                    this.makeFileFromIMGobj(variationImg);
                    upscaleQueue.push(variationImg);
                    variationQueue.push(variationImg);
                    variationImg = await mj.variation(img, 4, img.prompt);
                    this.makeFileFromIMGobj(variationImg);
                    upscaleQueue.push(variationImg);
                    variationQueue.push(variationImg);
                    maxVariationsCount++;
                }
                //console.log("upscaleQueue.length:", upscaleQueue.length);
                //console.log("variationQueue.length:", variationQueue.length);
                //console.log("zoomQueue.length:", zoomQueue.length);
                while (zoomQueue.length > 0 && maxZoomsCount < maxZooms) {
                    let img = zoomQueue.shift();
                    let zoomedImg = await mj.zoomOut(img, img.prompt);
                    this.makeFileFromIMGobj(zoomedImg);
                    variationQueue.push(zoomedImg);
                    upscaleQueue.push(zoomedImg);
                    maxZoomsCount++;
                }
            }
            maxGenerationsCount++;
        }
    }

    async makeFileFromIMGobj(img, filename = "") {
        try {
            if (!fs.existsSync("output/")) {
                fs.mkdirSync("output/");
            }
        } catch (err) {
            console.log(err);
        }
        if (filename == "") {
            const response = await axios.get(img.url, { responseType: 'arraybuffer' });
            const regexString = "([A-Za-z]+(_[A-Za-z]+)+).*([A-Za-z0-9]+(-[A-Za-z0-9]+)+)";
            const regex = new RegExp(regexString);
            const matches = regex.exec(img.url);
            try {
                filename = matches[0];
            } catch (e) {
                console.log("Error: Could not parse filename from url. Using default filename.");
                filename = img.url.substring(img.url.lastIndexOf("/") + 1, img.url.lastIndexOf("."));
                console.log("filename:", filename);
            }

            await sharp(response.data).toFile("output/" + filename + '.png');
        } else {
            const response = await axios.get(img.url, { responseType: 'arraybuffer' });
            await sharp(response.data).toFile("output/" + filename + '.png');
        }
    }
}

// get user config from file
const userConfig = JSON.parse(fs.readFileSync('user.json', 'utf8'));

const app = express()

const doLogin = async () => {
    console.log("Log in to Discord using browser:");
    console.log("Browser extension \"Run Javascript\" is required to get the token from the browser.");
    console.log("https://chrome.google.com/webstore/detail/run-javascript/lmilalhkkdhfieeienjbiicclobibjao");
    console.log("Paste the code below into the extension and enable it.");
    console.log("token = localStorage.getItem(\"token\")\;\ntoken = token.replaceAll(\"\\\"\", \"\")\;\ntheUrl = \"http://localhost:9999/api/token=\" + token\;\nwindow.open(theUrl,'_blank');\n");

    let notLoggedIn = true;
    let loginTimeout = setTimeout(() => {
        console.log("Login timed out. Please try again.");
        process.exit();
    }, 5 * 60 * 1000);

    let newToken = "";

    app.get("/login", (request, response) => {
        const redirect_url = `https://discord.com/oauth2/authorize?response_type=code&client_id=${userConfig.CLIENT_ID}&scope=identify&state=123456&redirect_uri=${userConfig.REDIRECT_URI}&prompt=consent`
        response.redirect(redirect_url);
    })

    app.get("/api/callback", async (request, response) => {
        const code = request.query["code"]
        const resp = await axios.post('https://discord.com/api/oauth2/token',
            new URLSearchParams({
                'client_id': userConfig.CLIENT_ID,
                'client_secret': userConfig.CLIENT_SECRET,
                'grant_type': 'authorization_code',
                'redirect_uri': userConfig.REDIRECT_URI,
                'code': code
            }),
            {
                headers:
                {
                    'Content-Type': 'application/x-www-form-urlencoded'
                }
            })
        response.send("You may close this window now.<script>window.close();</script>");
    })

    app.listen(9999, () => {
        console.log("Browse to http://localhost:9999/login");
    })

    app.get("/api/token=*", async (request, response) => {
        console.log("token request");
        console.log(request.url);
        newToken = request.url.substring(11);
        // respond with just enough javascript to close the window that opens
        response.send("<script>window.close();</script>");
        notLoggedIn = false;
        loginTimeout.unref();
    })

    while (notLoggedIn) {
        await waitSeconds(1);
    }
    return newToken;
}

var DiscordEvents = Discordie.Events;
var DiscordClient = new Discordie();
var DiscordieReady = false;

var midjourney = null;

var guild_id_from_discordie = "";
var channel_id_from_discordie = "";

// get data from prompts file
let prompts = JSON.parse(fs.readFileSync('prompts.json', 'utf8'));

async function setup() {
    if (userConfig.token == "" || userConfig.token == null) {
        userConfig.token = await doLogin();
        fs.writeFileSync('user.json', JSON.stringify(userConfig));
    }

    DiscordClient.connect({
        token: userConfig.token
    });

    DiscordClient.Dispatcher.on(DiscordEvents.GATEWAY_READY, e => {
        console.log("Connected as: " + DiscordClient.User.username);
        DiscordieReady = true;
    });

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
    const guildAnswer = await select({message: 'What is your server name?', choices: guildsObjArray});

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
    const channelAnswer = await select({message: 'Which channel would you like to use?', choices: channelsObjArray});

    // find the channel object from the answer name
    let channel;
    channels.forEach((c, i) => {
        if (c.name == channelAnswer) channel = channels[i];
    });

    // set the guild id and channel id
    guild_id_from_discordie = guild.id;
    channel_id_from_discordie = channel.id;
    console.log("Shutting down Discordie client...");
    await DiscordClient.disconnect();
    midjourney = new MJ_Handler({
        token: userConfig.token,
        guild_id: guild_id_from_discordie,
        channel_id: channel_id_from_discordie
    });

    midjourney.registerMJLoggerCB(MJlogger);
}

async function MJlogger(msg) {
    if (msg.mj != null) {
        printToLineRelative(-1, "Midjourney log: " + msg.mj);
    }
    if (msg.runner != null) {
        printToLineRelative(-2, "Runner log: " + msg.runner);
    }
}

async function printToLineRelative(line, text) {
    process.stdout.cursorTo(0);
    process.stdout.moveCursor(0, line);
    process.stdout.clearLine();
    process.stdout.write(text);
    process.stdout.cursorTo(0);
    process.stdout.moveCursor(0, -line);
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
    let cancellation = inquirer.prompt({
        type: 'input',
        name: 'cancel',
        message: 'Press enter to cancel and return to menu.'
    }).then((answers) => {
        cancelTheGPT = true;
    });
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
                if(!cancelTheGPT) { // but only if the user hasn't pressed enter to cancel
                    if (count % 2 == 0) {
                        process.stdout.write(".");
                    }
                }
            }
        }).then((response) => {
            if(!cancelTheGPT) res = response; // set res to the response if the user hasn't pressed enter to cancel
        });
    // wait for the response or for the user to press enter to cancel
    while(res == null && !cancelTheGPT) {
        await waitSeconds(1);
    }
    console.log("cancellation: " + stringifyObject(cancellation));
    await waitSeconds(5);
    if(cancellation.cancel != null) {
        // cancel the cancellation promise
        cancellation.cancel();
        console.log("prompt cancelled");
        await waitSeconds(2);
    }
    if(cancelTheGPT) return "";
    return res.text;
}

// generate a prompt from a theme object
async function generatePromptFromThemKeywords(theme, count = 10) {
    console.log("Generating prompts from theme: ", JSON.stringify(theme));
    let chatPrompt = "your role is design prompts for an AI image generator. Your theme should be based upon the following keywords but you can get creative with it: ";
    theme.keywords.forEach((themeKeyword) => {
        chatPrompt += themeKeyword + ", ";
    });
    chatPrompt += ". The selected style is: ";
    chatPrompt += theme.style;
    chatPrompt += ". An example prompt would look like this: Vast cityscape filled with bioluminescent starships and tentacled cosmic deities, a fusion of HR Giger's biomechanics with the whimsicality of Jean Giraud(Moebius) , taking cues from Ridley Scott's Alien and H. P. Lovecraft's cosmic horror, eerie, surreal. ";;
    chatPrompt += "Prefer succinctness over verbosity. Be sure to specify the art style. The prompts you write need to be output in JSON with the following schema: {\"prompts\":[\"your first prompt here\",\"your second prompt here\"]}. Do not respond with any text other than the JSON. Generate " + count + " prompts for this theme. Avoid words that can be construed as negative, offensive, sexual, violent, or related";
    let chatResponse = await sendChatGPTPrompt(chatPrompt);
    //console.log(chatResponse);
    return chatResponse;
}

async function waitSeconds(count, cancelable = false) {
    let confirmation = null;
    return await new Promise((resolve) => {
        if (cancelable) {
            confirmation = inquirer.prompt({
                type: 'confirm',
                name: 'wait',
                message: 'Waiting ' + count + ' seconds. Enter to cancel and return to menu.'
            }).then((answers) => {
                resolve(true);
            });
        }
        setTimeout(() => {
            resolve(false);
            if(confirmation != null) confirmation.cancel();
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


const askMenuOption = async (validate = null) => {
    if(validate == null) return await input({message: 'What is your choice?'});
    else {
        let valid = false;
        let answer = "";
        while (!valid) {
            answer = await input({message: 'What is your choice?'});
            valid = validate(answer);
        }
        return answer;
    }
}

const askInfiniteQuestions = async () => {
    let res = {};
    res.SENDTOCHATGPT = await confirm({message: 'Do you want to send your prompt to ChatGPT? The response will be sent as is to MJ.'});
    res.SAVEQUADS = await confirm({message: 'Do you want to save the quad files?'});
    res.CUSTOMFILENAME = await confirm({message: 'Use custom folder and sequential naming?'});
    res.PROMPT = await input({message: 'What is your prompt?'});
    return res;
}

const pressEnterToReturnToMenu = () => {
    const questions = [
        {
            name: 'ENTER',
            type: 'input',
            message: 'Press enter to return to the main menu.'
        }
    ];
    return inquirer.prompt(questions);
}

const customFolderQuestion = () => {
    const questions = [
        {
            name: 'FOLDER',
            type: 'input',
            message: 'What is your folder name?'
        }
    ];
    return inquirer.prompt(questions);
}

const readyToRun = () => {
    const questions = [
        {
            name: 'READY',
            type: 'confirm',
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
            message: 'How many runs per prompt do you want to run?'
        },
        {
            name: 'UPSCALE',
            type: 'input',
            message: 'How many generations of upscaling do you want to allow?'
        },
        {
            name: 'VARIATION',
            type: 'input',
            message: 'How many generations of variations do you want to allow?'
        },
        {
            name: 'ZOOM',
            type: 'input',
            message: 'How many generations of zoom out do you want to allow?'
        }
    ];
    return inquirer.prompt(questions);
}

const askPromptQuestionShort = () => {
    const questions = [
        {
            name: 'PROMPT',
            type: 'input',
            message: 'What is your prompt?'
        }
    ];
    return inquirer.prompt(questions);
}

const askThemeQuestionsShort = () => {
    const questions = [
        {
            name: 'THEME',
            type: 'input',
            message: 'What are your theme keywords? (comma separated)'
        },
        {
            name: 'STYLE',
            type: 'input',
            message: 'What is your style?'
        }
    ];
    return inquirer.prompt(questions);
}

const askThemeQuestions = () => {
    const questions = [
        {
            name: 'THEME',
            type: 'input',
            message: 'What are your theme keywords? (comma separated)'
        },
        {
            name: 'STYLE',
            type: 'input',
            message: 'What is your style?'
        },
        {
            name: 'CHATGPTGENERATIONS',
            type: 'input',
            message: 'How many prompts do you want to generate with chatgpt? (max ' + userConfig.max_ChatGPT_Responses + ')'
        },
        {
            name: 'GENERATIONS',
            type: 'input',
            message: 'How many runs per prompt do you want to run?'
        },
        {
            name: 'UPSCALE',
            type: 'input',
            message: 'How many generations of upscaling do you want to allow?'
        },
        {
            name: 'VARIATION',
            type: 'input',
            message: 'How many generations of variations do you want to allow?'
        },
        {
            name: 'ZOOM',
            type: 'input',
            message: 'How many generations of zoom out do you want to allow?'
        }
    ];
    return inquirer.prompt(questions);
}

const askImageGenQuestions = () => {
    const questions = [
        {
            name: 'CHATGPTGENERATIONS',
            type: 'input',
            message: 'How many prompts do you want to generate with chatgpt? (max ' + userConfig.max_ChatGPT_Responses + ')'
        },
        {
            name: 'GENERATIONS',
            type: 'input',
            message: 'How many runs per prompt do you want to run?'
        },
        {
            name: 'UPSCALE',
            type: 'input',
            message: 'How many generations of upscaling do you want to allow?'
        },
        {
            name: 'VARIATION',
            type: 'input',
            message: 'How many generations of variations do you want to allow?'
        },
        {
            name: 'ZOOM',
            type: 'input',
            message: 'How many generations of zoom out do you want to allow?'
        }
    ];
    return inquirer.prompt(questions);
}

const askOptionQuestions = () => {
    const questions = [
        {
            name: 'NAME',
            type: 'input',
            message: 'What is the option name?'
        },
        {
            name: 'VALUE',
            type: 'input',
            message: 'What is the option value?'
        },
        {
            name: 'ENABLED',
            type: 'input',
            message: 'Is the option enabled? (y/n)'
        }
    ];
    return inquirer.prompt(questions);
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
    let promptChoice;
    let addOption;
    let option;
    let removeTheme;
    let runningProcess = false;

    let runAsk = false;

    while (menuOption != "0") {
        // print menu options
        printMainMenu();
        // ask for the menu option
        menuOption = await askMenuOption((value)=>{
            value = parseInt(value);
            if(value >= 0 <= 11) return true; 
            else return false;
        });
        // if option 1, modify prompts
        switch (menuOption) {
            case "1":
                clearScreenBelowIntro();
                console.log("Show loaded themes, prompts, and options");
                // print the info from the prompts file
                printPromptsFile();
                // wait for enter to be pressed
                await pressEnterToReturnToMenu();
                break;
            case "2":
                clearScreenBelowIntro();
                console.log("Modify prompts");
                let modifyPromptsMenuOption = "";
                while (modifyPromptsMenuOption != "0") {
                    printPromptsFile("prompts");
                    // print the modify prompts menu
                    printModifyPromptsMenu();
                    // ask for the menu option
                    modifyPromptsMenuOption = await askMenuOption((value)=>{
                        value = parseInt(value);
                        if(value >= 0 <= 3) return true; 
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
                            fs.writeFileSync('prompts.json', JSON.stringify(prompts));
                            break;
                        case "2":
                            console.log("Remove prompt");
                            // ask for the prompt number
                            let removePrompt = await askMenuOption((value)=>{
                                value = parseInt(value);
                                if(value >= 0 <= prompts.prompts.length) return true; 
                                else return false;
                            });
                            // remove the prompt from the prompts object
                            if (prompts.prompts == null) prompts.prompts = [];
                            prompts.prompts.splice(parseInt(removePrompt) - 1, 1);
                            // save the prompts object to the prompts.json file
                            fs.writeFileSync('prompts.json', JSON.stringify(prompts));
                            break;
                        case "3":
                            console.log("Modify prompt");
                            // ask for the prompt number
                            let modifyPrompt = await askMenuOption((value)=>{
                                value = parseInt(value);
                                if(value >= 0 <= prompts.prompts.length) return true; 
                                else return false;
                            });
                            // ask for the prompt
                            let modifyPromptQuestions = await askPromptQuestionShort();
                            // modify the prompt in the prompts object
                            if (prompts.prompts == null) prompts.prompts = [];
                            prompts.prompts[parseInt(modifyPrompt) - 1] = modifyPromptQuestions.PROMPT;
                            // save the prompts object to the prompts.json file
                            fs.writeFileSync('prompts.json', JSON.stringify(prompts));
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
            case "3":
                clearScreenBelowIntro();
                console.log("Modify themes");
                let modifyThemesMenuOption = { OPTION: "" };
                while (modifyThemesMenuOption.OPTION != "0") {
                    printPromptsFile("themes");
                    // print the modify themes menu
                    printModifyThemesMenu();
                    // ask for the menu option
                    modifyThemesMenuOption = await askMenuOption((value)=>{
                        value = parseInt(value);
                        if(value >= 0 <= 3) return true; 
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
                            fs.writeFileSync('prompts.json', JSON.stringify(prompts));
                            break;
                        case "2":
                            console.log("Remove theme");
                            // ask for the theme number
                            removeTheme = await askMenuOption((value)=>{
                                value = parseInt(value);
                                if(value >= 0 <= prompts.themes.length) return true; 
                                else return false;
                            });
                            // remove the theme from the prompts object
                            if (prompts.themes == null) prompts.themes = [];
                            prompts.themes.splice(parseInt(removeTheme) - 1, 1);
                            // save the prompts object to the prompts.json file
                            fs.writeFileSync('prompts.json', JSON.stringify(prompts));
                            break;
                        case "3":
                            console.log("Modify theme");
                            //console.log("Which theme do you want to modify?");
                            // ask for the theme number
                            let modifyTheme = await askMenuOption((value)=>{
                                value = parseInt(value);
                                if(value >= 0 <= prompts.themes.length) return true; 
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
                            fs.writeFileSync('prompts.json', JSON.stringify(prompts));
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
            case "4":
                clearScreenBelowIntro();
                console.log("Modify options (applies to all generations)");
                let modifyOptionsMenuOption = "";
                while (modifyOptionsMenuOption != "0") {
                    printPromptsFile("options");
                    // print the modify options menu
                    printModifyOptionsMenu();
                    // ask for the menu option
                    modifyOptionsMenuOption = await askMenuOption((value)=>{
                        value = parseInt(value);
                        if(value >= 0 <= 3) return true; 
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
                            fs.writeFileSync('prompts.json', JSON.stringify(prompts));
                            break;
                        case "2":
                            console.log("Remove option");
                            // ask for the option number
                            let removeOption = await askMenuOption((value)=>{
                                value = parseInt(value);
                                if(value >= 0 <= prompts.options.length) return true; 
                                else return false;
                            });
                            // remove the option from the prompts object
                            if (prompts.options == null) prompts.options = [];
                            prompts.options.splice(parseInt(removeOption) - 1, 1);
                            // save the prompts object to the prompts.json file
                            fs.writeFileSync('prompts.json', JSON.stringify(prompts));
                            break;
                        case "3":
                            console.log("Modify option");
                            // ask for the option number
                            let modifyOption = await askMenuOption((value)=>{
                                value = parseInt(value);
                                if(value >= 0 <= prompts.options.length) return true; 
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
                            fs.writeFileSync('prompts.json', JSON.stringify(prompts));
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
            case "5":
                clearScreenBelowIntro();
                console.log("Start thematic generation from saved theme");
                // print the themes
                printPromptsFile("themes");
                // ask for the theme number
                themeChoice = await askMenuOption((value)=>{
                    value = parseInt(value);
                    if(value >= 0 <= prompts.themes.length) return true; 
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
                if (basicAnswers.CHATGPTGENERATIONS > userConfig.max_ChatGPT_Responses) basicAnswers.CHATGPTGENERATIONS = userConfig.max_ChatGPT_Responses;
                // generate the prompt from the theme
                res = await generatePromptFromThemKeywords(theme, basicAnswers.CHATGPTGENERATIONS);
                // find and replace all "-" in res with " " (space)
                res = res.replaceAll("-", " ");
                if (res.indexOf("{") == -1) {
                    console.log("Error: ChatGPT returned a badly formatted string. Please try again.");
                    await waitSeconds(2);
                    break;
                }
                res = JSON.parse(res.substring(res.indexOf("{"), res.indexOf("}") + 1));
                //log the prompt
                res.prompts.forEach((prompt, i) => {
                    if (parseInt(prompt.substring(0, 1)) == i + 1) console.log(chalk.green((i + 1) + ":  " + prompt.substring(2)));
                    else if (parseInt(prompt.substring(0, 2)) == i + 1) console.log(chalk.green((i + 1) + ":  " + prompt.substring(3)));
                    else console.log(chalk.green((i + 1) + ":  " + prompt));
                });
                // get the prompt from the user
                //promptChoice = await askMenuOption();
                // set the prompt answer
                //promptAnswer = res.prompts[ Math.min(parseInt(promptChoice.OPTION) - 1, res.prompts.length - 1)];
                promptAnswer = [];
                res.prompts.forEach((prompt, i) => {
                    promptAnswer.push(prompt);
                });
                // set the answers
                generationsAnswer = parseInt(basicAnswers.GENERATIONS);
                upscaleAnswer = parseInt(basicAnswers.UPSCALE);
                variationAnswer = parseInt(basicAnswers.VARIATION);
                zoomAnswer = parseInt(basicAnswers.ZOOM);
                runAsk = true;
                break;
            case "6":
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
                res = await generatePromptFromThemKeywords(theme, themeQuestions.CHATGPTGENERATIONS);
                // find and replace all "-" in res with " " (space)
                res = res.replaceAll("-", " ");
                if (res.indexOf("{") == -1) {
                    console.log("Error: ChatGPT returned a badly formatted string. Please try again.");
                    break;
                }
                res = JSON.parse(res.substring(res.indexOf("{"), res.indexOf("}") + 1));
                //log the prompt
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
                runAsk = true;
                break;
            case "7":
                clearScreenBelowIntro();
                console.log("Start prompt generation from saved prompt");
                // print the prompts
                printPromptsFile("prompts");
                // ask for the prompt number
                let promptChoice2 = await askMenuOption((value)=>{
                    value = parseInt(value);
                    if(value >= 0 <= prompts.prompts.length) return true; 
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
                runAsk = true;
                break;
            case "8":
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
                runAsk = true;
                break;
            case "9":
                clearScreenBelowIntro();
                console.log("Start prompt generation from last questions");
                runAsk = true;
                break;
            case "10":
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
                    midjourney.infiniteZoom(res, infiniteZoomQuestions.SAVEQUADS, infiniteZoomQuestions.CUSTOMFILENAME, folder2);
                    runningProcess = true;
                } else {
                    midjourney.infiniteZoom(infiniteZoomQuestions.PROMPT, infiniteZoomQuestions.SAVEQUADS, infiniteZoomQuestions.CUSTOMFILENAME, folder2);
                    runningProcess = true;
                }
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
                    midjourney.infinitePromptVariationUpscales(res, infinitePromptQuestions.SAVEQUADS, infinitePromptQuestions.CUSTOMFILENAME, folder);
                    runningProcess = true;
                } else {
                    midjourney.infinitePromptVariationUpscales(infinitePromptQuestions.PROMPT, infinitePromptQuestions.SAVEQUADS, infinitePromptQuestions.CUSTOMFILENAME, folder);
                    runningProcess = true;
                }
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

        if (runningProcess) {
            MJlogger({ runner: "running" });
        }

        let loopCount = 1;
        while (runningProcess) {
            // create string of dots of length loopCount
            let dots = ".".repeat(loopCount);
            MJlogger({ runner: dots });
            loopCount++;
            let end = await waitSeconds(1);
            if (loopCount > 5) loopCount = 1;
        }

        if (runAsk) {
            let promptCount = promptAnswer.length;
            let prompt = "";
            let ready = await readyToRun();
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

            for (let i = 0; i < promptCount; i++) {
                prompt = promptAnswer[i];
                prompt += promptSuffix;
                if (ready.READY === true) {
                    console.log("Running with prompt (" + (i + 1) + " of " + promptCount + "): ", prompt);
                    // run the main function
                    await midjourney.main(prompt, generationsAnswer, upscaleAnswer, variationAnswer, zoomAnswer, i == 0);
                    if(i < promptCount - 1) {
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
            // print done message
            printDone();
            await waitSeconds(3);
            runAsk = false;
        }
        intro();
    }
}

intro();
await setup();
await run();
await midjourney.close();
console.log("Done. Goodbye!");
process.exit(0);
