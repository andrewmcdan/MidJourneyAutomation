// @TODO: need to get info from midjourney about current available time for user, then show this on the console
//          when the app starts up.

import { MidjourneyDiscordBridge } from "midjourney-discord-bridge";

import axios from "axios";
import sharp from 'sharp';
//import { s } from "@sapphire/shapeshift";
import fs from 'fs';
import { ChatGPTAPI } from 'chatgpt';
import inquirer from 'inquirer';
import chalk from 'chalk';
import figlet from 'figlet';
import stringifyObject from 'stringify-object';
import Discordie from "discordie";

var DiscordEvents = Discordie.Events;
var DiscordClient = new Discordie();
var DiscrodieReady = false;

var guild_id_from_discordie = "";
var channel_id_from_discordie = "";

// get user config from file
const userConfig = JSON.parse(fs.readFileSync('user.json', 'utf8'));
// get data from prompts file
let prompts = JSON.parse(fs.readFileSync('prompts.json', 'utf8'));

DiscordClient.connect({
    token: userConfig.token
});

DiscordClient.Dispatcher.on(DiscordEvents.GATEWAY_READY, e => {
    console.log("Connected as: " + DiscordClient.User.username);
    DiscrodieReady = true;
});

DiscordClient.Dispatcher.on(DiscordEvents.MESSAGE_CREATE, e => {
    if (e.message.content == "ping")
        e.message.channel.sendMessage("pong");
});

async function setup(){
    // wait for discordie to be ready
    console.log("Waiting for Discordie to be ready...");
    while(!DiscrodieReady){
        await waitSeconds(1);
    }
    // get list of guilds
    let guilds = await DiscordClient.Guilds.toArray();

    const guildQuestion = [
        {
            name: 'GUILD',
            type: 'list',
            message: 'What is server name?',
            choices: guilds
        }
    ];
    
    // ask for the guild
    let guildAnswer = await inquirer.prompt(guildQuestion);

    // find the guild object from the answer name
    let guild;
    guilds.forEach((g, i) => {
        if(g.name == guildAnswer.GUILD) guild = guilds[i];
    });

    // get list of channels
    let channels = await DiscordClient.Channels.textForGuild(guild);
    
    const channelQuestion = [
        {
            name: 'CHANNEL',
            type: 'list',
            message: 'What is channel name?',
            choices: channels
        }
    ];

    // ask for the channel
    let channelAnswer = await inquirer.prompt(channelQuestion);

    // find the channel object from the answer name
    let channel;
    channels.forEach((c, i) => {
        if(c.name == channelAnswer.CHANNEL) channel = channels[i];
    });

    // set the guild id and channel id
    guild_id_from_discordie = guild.id;
    channel_id_from_discordie = channel.id;
    console.log("Shutting down Discord client...");
    await DiscordClient.disconnect();
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
    let count = 0;
    const res = await chatgpt.sendMessage(prompt,
        {
            onProgress: (partialResponse) => {
                count++;
                if (count % 2 == 0) process.stdout.write(".");
            }
        });
    console.log("");
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
    chatPrompt += "Prefer succintness over verbosity. Be sure to specify the art style. The prompts you write need to be output in JSON with the following schema: {\"prompts\":[\"your first prompt here\",\"your second prompt here\"]}. Generate " + count + " prompts for this theme. Avoid words that can be construed as negative, offensive, sexual, violent, or related";
    let chatResponse = await sendChatGPTPrompt(chatPrompt);
    //console.log(chatResponse);
    return chatResponse;
}

async function waitSeconds(count) {
    await new Promise(resolve => setTimeout(resolve, count * 1000));
};

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

const printDone = () => {
    console.log(chalk.greenBright('='.repeat(process.stdout.columns)));
    console.log(
        chalk.green(
            figlet.textSync('Done', {
                font: 'doh',
                horizontalLayout: 'full',
                verticalLayout: 'full'
            })
        )
    );
    console.log(chalk.greenBright('='.repeat(process.stdout.columns)));
}

const printPromtptsFile = (choice = "all") => {
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

const askInfinteZoomQuestions = () => {
    const questions = [
        {
            name: 'SENDTOCHATGPT',
            type: 'confirm',
            message: 'Do you want to send your prompt to ChatGPT? The response will be sent as is to MJ. (y/n)'
        },
        {
            name: 'SAVEQUADS',
            type: 'confirm',
            message: 'Do you want to save the quad files? (y/n)'
        },
        {
            name: 'CUSTOMFILENAME',
            type: 'confirm',
            message: 'Use infinizoom folder and sequential naming? (y/n)'
        },
        {
            name: 'PROMPT',
            type: 'input',
            message: 'What is your prompt?'
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

    let runAsk = false;

    while (menuOption.OPTION != "0") {
        // print menu options
        printMainMenu();
        // ask for the menu option
        menuOption = await askMenuOption();
        // if option 1, modify prompts
        switch (menuOption.OPTION) {
            case "1":
                console.log("Show loaded themes, prompts, and options");
                // print the info from the prompts file
                printPromtptsFile();
                break;
            case "2":
                console.log("Modify prompts");
                let modifyPromptsMenuOption = { OPTION: "" };
                while (modifyPromptsMenuOption.OPTION != "0") {
                    printPromtptsFile("prompts");
                    // print the modify prompts menu
                    printModifyPromptsMenu();
                    // ask for the menu option
                    modifyPromptsMenuOption = await askMenuOption();
                    switch (modifyPromptsMenuOption.OPTION) {
                        case "1":
                            console.log("Add prompt");
                            // ask for the prompt
                            let addPrompt = await askPromptQuestionShort();
                            // add the prompt to the prompts object
                            if (prompts.prompts == null) prompts.prompts = [];
                            prompts.prompts.push(addPrompt.PROMPT);
                            // save the prompts object to the prompts.json file
                            fs.writeFileSync('prompts.json', JSON.stringify(prompts));
                            break;
                        case "2":
                            console.log("Remove prompt");
                            // ask for the prompt number
                            let removePrompt = await askMenuOption();
                            // remove the prompt from the prompts object
                            if (prompts.prompts == null) prompts.prompts = [];
                            prompts.prompts.splice(parseInt(removePrompt.OPTION) - 1, 1);
                            // save the prompts object to the prompts.json file
                            fs.writeFileSync('prompts.json', JSON.stringify(prompts));
                            break;
                        case "3":
                            console.log("Modify prompt");
                            // ask for the prompt number
                            let modifyPrompt = await askMenuOption();
                            // ask for the prompt
                            let modifyPromptQuestions = await askPromptQuestionShort();
                            // modify the prompt in the prompts object
                            if (prompts.prompts == null) prompts.prompts = [];
                            prompts.prompts[parseInt(modifyPrompt.OPTION) - 1] = modifyPromptQuestions.PROMPT;
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
                console.log("Modify themes");
                let modifyThemesMenuOption = { OPTION: "" };
                while (modifyThemesMenuOption.OPTION != "0") {
                    printPromtptsFile("themes");
                    // print the modify themes menu
                    printModifyThemesMenu();
                    // ask for the menu option
                    modifyThemesMenuOption = await askMenuOption();
                    switch (modifyThemesMenuOption.OPTION) {
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
                            removeTheme = await askMenuOption();
                            // remove the theme from the prompts object
                            if (prompts.themes == null) prompts.themes = [];
                            prompts.themes.splice(parseInt(removeTheme.OPTION) - 1, 1);
                            // save the prompts object to the prompts.json file
                            fs.writeFileSync('prompts.json', JSON.stringify(prompts));
                            break;
                        case "3":
                            console.log("Modify theme");
                            //console.log("Which theme do you want to modify?");
                            // ask for the theme number
                            let modifyTheme = await askMenuOption();
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
                            prompts.themes[parseInt(modifyTheme.OPTION) - 1] = modifyThemeObject;
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
                console.log("Modify options (applies to all generations)");
                let modifyOptionsMenuOption = { OPTION: "" };
                while (modifyOptionsMenuOption.OPTION != "0") {
                    printPromtptsFile("options");
                    // print the modify options menu
                    printModifyOptionsMenu();
                    // ask for the menu option
                    modifyOptionsMenuOption = await askMenuOption();
                    switch (modifyOptionsMenuOption.OPTION) {
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
                            let removeOption = await askMenuOption();
                            // remove the option from the prompts object
                            if (prompts.options == null) prompts.options = [];
                            prompts.options.splice(parseInt(removeOption.OPTION) - 1, 1);
                            // save the prompts object to the prompts.json file
                            fs.writeFileSync('prompts.json', JSON.stringify(prompts));
                            break;
                        case "3":
                            console.log("Modify option");
                            // ask for the option number
                            let modifyOption = await askMenuOption();
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
                            prompts.options[parseInt(modifyOption.OPTION) - 1] = modifyOptionObject;
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
                console.log("Start thematic generation from saved theme");
                // print the themes
                printPromtptsFile("themes");
                // ask for the theme number
                themeChoice = await askMenuOption();
                basicAnswers = await askImageGenQuestions();
                //split the theme keywords into an array
                themeKeywords = prompts.themes[parseInt(themeChoice.OPTION) - 1].keywords;
                // create the theme object
                theme = {
                    keywords: themeKeywords,
                    style: prompts.themes[parseInt(themeChoice.OPTION) - 1].style
                };
                if (basicAnswers.CHATGPTGENERATIONS > userConfig.max_ChatGPT_Responses) basicAnswers.CHATGPTGENERATIONS = userConfig.max_ChatGPT_Responses;
                // generate the prompt from the theme
                res = await generatePromptFromThemKeywords(theme, basicAnswers.CHATGPTGENERATIONS);
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
                console.log("Start prompt generation from saved prompt");
                // print the prompts
                printPromtptsFile("prompts");
                // ask for the prompt number
                let promptChoice2 = await askMenuOption();
                // set the prompt answer
                promptAnswer[0] = prompts.prompts[parseInt(promptChoice2.OPTION) - 1];
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
                console.log("Start prompt generation from last questions");
                runAsk = true;
                break;
            case "10":
                console.log("Start infinite zoom");
                let infiniteZoomQuestions = await askInfinteZoomQuestions();
                if (infiniteZoomQuestions.SENDTOCHATGPT) {
                    let res = await sendChatGPTPrompt(infiniteZoomQuestions.PROMPT);
                    res = res.replaceAll("\"", "");
                    await infiniteZoom(res, infiniteZoomQuestions.SAVEQUADS, infiniteZoomQuestions.CUSTOMFILENAME);
                } else {
                    await infiniteZoom(infiniteZoomQuestions.PROMPT, infiniteZoomQuestions.SAVEQUADS, infiniteZoomQuestions.CUSTOMFILENAME);
                }
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
                    await main(prompt, generationsAnswer, upscaleAnswer, variationAnswer, zoomAnswer, i == 0);
                    // print done message
                    printDone();
                    console.log("");
                    for (let i = 0; i < (userConfig.wait_time_after_done < 5 ? 5 : userConfig.wait_time_after_done * 2); i++) {
                        process.stdout.write(".");
                        await waitSeconds(0.5);
                    }
                    console.log("");
                }
            }
            runAsk = false;
        }
    }
}

async function infiniteZoom(MJprompt, saveQuadFiles = true, autoNameFiles = false) {
    const mj = new MidjourneyDiscordBridge(userConfig.token, userConfig.guild_id, userConfig.channel_id);
    let img = await mj.generateImage(MJprompt, (obj, progress) => {
        process.stdout.write(progress + "%   ");
    });
    console.log("\nInitial Midjourney image generation completed\n");
    if (saveQuadFiles) makeFileFromIMGobj(img);
    let imgToZoom = img;
    let imgToScale = img;
    let filenameBase = "infinizoom/";
    let fileCount = 1;

    while (true) {
        let fileCountString = fileCount.toString().padStart(4, "0");
        let filename = filenameBase + fileCountString;
        // generate random number between 1 and 4
        let random1to4 = Math.floor(Math.random() * 4) + 1;
        imgToZoom = await mj.upscaleImage(imgToScale, random1to4, img.prompt);
        makeFileFromIMGobj(imgToZoom, autoNameFiles ? filename : "");
        imgToScale = await mj.zoomOut(imgToZoom, img.prompt);
        if (saveQuadFiles) makeFileFromIMGobj(imgToScale, autoNameFiles ? filename : "");
        fileCount++;
    }
}

async function main(MJprompt, maxGenerations = 100, maxUpscales = 4, maxVariations = 4, maxZooms = 4, printInfo = false) {
    maxZooms = maxZooms * 4; // zooms are 4x faster than upscales and variations
    const mj = new MidjourneyDiscordBridge(userConfig.token, guild_id_from_discordie, channel_id_from_discordie);
    //const mj = new MidjourneyDiscordBridge(userConfig.token, userConfig.guild_id, userConfig.channel_id);
    let maxGenerationsCount = 0;
    if (printInfo) {
        let info = await mj.getInfo();
        console.log("Midjourney info:\n\n", info.embeds[0].description);
    }

    while (maxGenerationsCount < maxGenerations) {
        let img = await mj.generateImage(MJprompt, (obj, progress) => {
            process.stdout.write(progress + "%   ");
        });
        //console.log("\nMidjourney image generation completed:", img.url);
        console.log("\nInitial Midjourney image generation completed\n");

        // Do something with the image
        makeFileFromIMGobj(img);

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
            console.log("Processing request queues....");
            //console.log("upscaleQueue.length:", upscaleQueue.length);
            //console.log("variationQueue.length:", variationQueue.length);
            //console.log("zoomQueue.length:", zoomQueue.length);
            while (upscaleQueue.length > 0 && maxUpscalesCount < maxUpscales) {
                let img = upscaleQueue.shift();
                let upscaledImg = await mj.upscaleImage(img, 1, img.prompt);
                makeFileFromIMGobj(upscaledImg);
                zoomQueue.push(upscaledImg);
                upscaledImg = await mj.upscaleImage(img, 2, img.prompt);
                makeFileFromIMGobj(upscaledImg);
                zoomQueue.push(upscaledImg);
                upscaledImg = await mj.upscaleImage(img, 3, img.prompt);
                makeFileFromIMGobj(upscaledImg);
                zoomQueue.push(upscaledImg);
                upscaledImg = await mj.upscaleImage(img, 4, img.prompt);
                makeFileFromIMGobj(upscaledImg);
                zoomQueue.push(upscaledImg);
                maxUpscalesCount++;
            }
            //console.log("upscaleQueue.length:", upscaleQueue.length);
            //console.log("variationQueue.length:", variationQueue.length);
            //console.log("zoomQueue.length:", zoomQueue.length);
            while (variationQueue.length > 0 && maxVariationsCount < maxVariations) {
                let img = variationQueue.shift();
                let variationImg = await mj.variation(img, 1, img.prompt);
                makeFileFromIMGobj(variationImg);
                upscaleQueue.push(variationImg);
                variationQueue.push(variationImg);
                variationImg = await mj.variation(img, 2, img.prompt);
                makeFileFromIMGobj(variationImg);
                upscaleQueue.push(variationImg);
                variationQueue.push(variationImg);
                variationImg = await mj.variation(img, 3, img.prompt);
                makeFileFromIMGobj(variationImg);
                upscaleQueue.push(variationImg);
                variationQueue.push(variationImg);
                variationImg = await mj.variation(img, 4, img.prompt);
                makeFileFromIMGobj(variationImg);
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
                makeFileFromIMGobj(zoomedImg);
                variationQueue.push(zoomedImg);
                upscaleQueue.push(zoomedImg);
                maxZoomsCount++;
            }
        }
        maxGenerationsCount++;
    }
    mj.close()
}

intro();
await setup();
await run();
console.log("Done. Goodbye!");

async function makeFileFromIMGobj(img, filename = "") {
    if (filename == "") {
        const response = await axios.get(img.url, { responseType: 'arraybuffer' });
        const regexString = "([A-Za-z]+(_[A-Za-z]+)+).*([A-Za-z0-9]+(-[A-Za-z0-9]+)+)";
        const regex = new RegExp(regexString);
        const matches = regex.exec(img.url);
        filename = matches[0];
        await sharp(response.data).toFile("output/" + filename + '.png');
    } else {
        const response = await axios.get(img.url, { responseType: 'arraybuffer' });
        await sharp(response.data).toFile("output/" + filename + '.png');
    }

}