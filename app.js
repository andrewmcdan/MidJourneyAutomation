// @TODO: need to get info from midjourney about current available time for user, then show this on the console
//          when the app starts up.

import { MidjourneyDiscordBridge } from "midjourney-discord-bridge";

import axios from "axios";
import sharp from 'sharp';
import { s } from "@sapphire/shapeshift";
import fs from 'fs';
import { ChatGPTAPI } from 'chatgpt';

// get user config from file
const userConfig = JSON.parse(fs.readFileSync('user.json', 'utf8'));

async function testChatGPT() {
    const chatgpt = new ChatGPTAPI({
        apiKey: userConfig.openai_key,
        completionParams: {
            model: 'gpt-4',
            temperature: 0.5,
            top_p: 0.8
        }
    });

    const res = await chatgpt.sendMessage('Hello World!')
    console.log(res.text)
}

testChatGPT();

async function main() {
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

main();


async function makeFileFromIMGobj(img) {
    const response = await axios.get(img.url, { responseType: 'arraybuffer' });
    const regexString = "([A-Za-z]+(_[A-Za-z]+)+).*([A-Za-z0-9]+(-[A-Za-z0-9]+)+)";
    const regex = new RegExp(regexString);
    const matches = regex.exec(img.url);
    const filename = matches[0];
    await sharp(response.data).toFile("output/" + filename + '.png');
}