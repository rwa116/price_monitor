const Discord = require('discord.js');
const cron = require("node-cron");
const { checkStock, getName, getPrice } = require("./monitor");
require("dotenv").config();

const client = new Discord.Client({ intents: [Discord.Intents.FLAGS.GUILDS, Discord.Intents.FLAGS.GUILD_MESSAGES] });
const prefix = '!';
//declare connection and Maps for holding server-specific job information
//all maps map from guild ID to job info
let connection;
let toggleNotif = new Map(); //(bool) to choose btw limited/all notifications
let runningJob = new Map(); //(string) stringified cronJob
let jobName = new Map(); //(string) item name
let jobUrl =  new Map(); //(string) item URL
let jobCaller = new Map(); //(string) discord member who called for the job to be created
let jobThresh = new Map(); //(float) price threshold for price job if applicable
let jobInterval = new Map(); //(string) cron interval for webpage checks


//gather defaults for maps from database, set rest to null
client.on('ready', () => {
    console.log('PriceMonitor is now online.');
    client.guilds.cache.forEach(guild => {
        connection.query(
            `SELECT guildNotif FROM MonitorInfo WHERE guildId = '${guild.id}'`
        ).then(result => {
            toggleNotif.set(guild.id, result[0][0].guildNotif);
        }).catch(err => console.log(err));
        connection.query(
            `SELECT guildJob FROM MonitorInfo WHERE guildId = '${guild.id}'`
        ).then(result => {
            runningJob.set(guild.id, result[0][0].guildJob);
        }).catch(err => console.log(err));
        jobName.set(guild.id, null);
        jobUrl.set(guild.id, null);
        jobCaller.set(guild.id, null);
        jobThresh.set(guild.id, null);
        jobInterval.set(guild.id, null);

    })
});

//create new 'Guilds' and 'MonitorInfo' table for new server
client.on("guildCreate", async (guild) => {
    try {
        await connection.query(
            `INSERT INTO Guilds VALUES('${guild.id}', '${guild.ownerId}')`
        );
        await connection.query(
            `INSERT INTO MonitorInfo (guildId) VALUES('${guild.id}')`
        );
    }
    catch(err) {
        console.log(err);
    }
});

client.on("message", async (message) => {
    if(!message.content.startsWith(prefix) || message.author.bot) return;

    const args = message.content.slice(prefix.length).split(" ");
    //console.log(args); //option for showing arguments when a command is sent
    const command = args.shift().toLowerCase();



    if(command == "help") {
        message.channel.send("Welcome to PriceMonitor discord bot!\n\n"
        + "To monitor an item that is currently out of stock for a restock use: \n"
        + "**!stock <interval(s)> <item url>**\n\n"
        + "To monitor an item for a price drop below a desired threshold price use: \n"
        + "**!price <interval(s)> <threshold price> <item url>**\n\n"
        + "It is best to use an interval > 300 seconds for !stock and !price commands to reduce the chance of being softbanned from Amazon's website.\n\n"
        + "To toggle between full notifications and only pricedrop/instock notifcations use: \n"
        + "**!notif** or **!toggle**\n\n"
        + "To list all current stock/price checking jobs being run use: \n"
        + "**!list**\n\n"
        + "To cancel a running stock/price checking job use: \n"
        + "**!stop**");
    }

    else if(command == "notif" || command == "toggle") {
        try {
            let currentNotif = toggleNotif.get(message.guild.id);
            await connection.query(
                `UPDATE MonitorInfo SET guildNotif = '${!currentNotif}' WHERE guildId = '${message.guild.id}'`
            );
            toggleNotif.set(message.guild.id, !currentNotif);
            if(toggleNotif.get(message.guild.id)) {
                message.channel.send("All notifications now on.");
            }
            else {
                message.channel.send("Only instock and pricedrop notifications now on.")
            }
        }
        catch(err) {
            console.log(err);
        }
    }


    else if(command == 'stock') {
        let currentJob = runningJob.get(message.guild.id);
        let currentName;
        let itemUrlString;
        let itemUrl;

        //check for current running job
        if(currentJob != "CLEAR") {
            message.channel.send("Please stop the currently running job using !stop before starting a new one.");
            return;
        }
        //check for correct number of args left
        if(args.length != 2) {
            message.channel.send('Incorrect number of parameters, use !help for details on how to use this command.');
            return;
        }
        
        //get interval
        const interval = parseInt(args.shift().toLowerCase());
        if(!Number.isInteger(interval)) {
            message.channel.send("Please enter a valid numerical interval. Use !help for details.");
            return;
        }

        //get item url
        try {
            itemUrlString = args.shift();
            itemUrl = new URL(itemUrlString);
        }
        //catch invalid URL error
        catch(err) {
            message.channel.send('Invalid URL, please ensure this URL is copied directly from an Amazon.ca item page.');
            return;
        }

        //check for non-amazon url
        if(itemUrl.hostname != 'www.amazon.ca') {
            message.channel.send('Invalid URL, please use a valid Amazon.ca URL');
            return;
        }

        //get name for job
        await getName(itemUrlString).then((gotName) => {
            //console.log(`Got name is ${gotName}.`); //error checking option for displaying name got from web
            currentName = gotName;
        }).catch((err) => {
            console.log(err);
            return;
        });


        


        //create cronDate
        let intMinutes;
        let intSeconds;
        let cronDate;
        if(interval > 59) {
            intMinutes = Math.floor(interval / 60);
            intSeconds = (interval % 60);
            if(intSeconds != 0) {
                cronDate = `*/${intSeconds} */${intMinutes} * * * *`;
            }
            else {
                cronDate = `*/${intMinutes} * * * *`;
            }
        }
        else {
            cronDate = `*/${interval} * * * * *`;
        }

        //add all variables to database and respective maps
        await connection.query(
            `UPDATE MonitorInfo SET guildJobName = '${currentName}', guildUrl = '${itemUrlString}', guildCaller = '${message.author}', guildInterval = '${cronDate}' WHERE guildId = '${message.guild.id}'`
        );
        jobName.set(message.guild.id, currentName);
        jobUrl.set(message.guild.id, itemUrlString);
        jobCaller.set(message.guild.id, message.author);
        jobInterval.set(message.guild.id, cronDate);


        //create cronJob that monitors the specified item for stock
        let currentCronJob = cron.schedule(jobInterval.get(message.guild.id), async function() {
            let currentUrl = jobUrl.get(message.guild.id); 

            var isInStock = await checkStock(currentUrl);

                if(isInStock) {
                    message.channel.send(`${jobName.get(message.guild.id)} is in stock! ${jobCaller.get(message.guild.id)}`);
                    message.channel.send(currentUrl);
                }
                else { 
                    if(toggleNotif) {
                        message.channel.send(`${jobName.get(message.guild.id)} is NOT in stock!`);
                    }
                }
        });

        //update runningJob and database with new job
        runningJob.set(message.guild.id, currentCronJob);
        await connection.query(
            `UPDATE MonitorInfo SET guildJob = '${JSON.stringify(currentCronJob)}' WHERE guildId = '${message.guild.id}'`
        );
    }



    else if(command == 'price') {
        let currentJob = runningJob.get(message.guild.id);
        let currentName;
        let itemUrlString;
        let itemUrl;
        let currentThresh

        //check for current running job
        if(currentJob != "CLEAR") {
            message.channel.send("Please stop the currently running job using !stop before starting a new one.");
        }
        //check for correct number of args left
        if(args.length != 3) {
            message.channel.send('Incorrect number of parameters, use !help for details on how to use this command.');
            return;
        }
        
        //get interval
        const interval = parseInt(args.shift().toLowerCase());
        if(!Number.isInteger(interval)) {
            message.channel.send("Please enter a valid numerical interval. Use !help for details.");
            return;
        }
        //get threshold price
        currentThresh = parseFloat(args.shift().toLowerCase().replace('$',""));
        if(typeof(currentThresh) != 'number') {
            message.channel.send("Please enter a valid numerical threshold price. Use !help for details.");
            return;
        }
        
        
        //get item url
        try {
            itemUrlString = args.shift();
            itemUrl = new URL(itemUrlString);
        }
        //catch invalid URL error
        catch(err) {
            message.channel.send('Invalid URL, please ensure this URL is copied directly from an Amazon.ca item page.');
            return;
        }

        //check for non-amazon url
        if(itemUrl.hostname != 'www.amazon.ca') {
            message.channel.send('Invalid URL, please use a valid Amazon.ca URL');
            return;
        }


        //get name for job
        await getName(itemUrlString).then((gotName) => {
            //console.log(`Got name is ${gotName}.`); //error checking option for displaying name got from web
            currentName = gotName;
        }).catch((err) => {
            console.log(err);
            return;
        });


        let intMinutes;
        let intSeconds;
        let cronDate;
        if(interval > 59) {
            intMinutes = Math.floor(interval / 60);
            intSeconds = (interval % 60);
            if(intSeconds != 0) {
                cronDate = `*/${intSeconds} */${intMinutes} * * * *`;
            }
            else {
                cronDate = `*/${intMinutes} * * * *`;
            }
        }
        else {
            cronDate = `*/${interval} * * * * *`;
        }


        //add all variables to database and respective maps
        await connection.query(
            `UPDATE MonitorInfo SET guildJobName = '${currentName}', guildUrl = '${itemUrlString}', guildCaller = '${message.author}', guildInterval = '${cronDate}' WHERE guildId = '${message.guild.id}'`
        );
        jobName.set(message.guild.id, currentName);
        jobUrl.set(message.guild.id, itemUrlString);
        jobCaller.set(message.guild.id, message.author);
        jobInterval.set(message.guild.id, cronDate);

        //create cronJob that monitors the specified item for price drop below threshold
        let currentCronJob = cron.schedule(jobInterval.get(message.guild.id), async function() {
            let currentUrl = jobUrl.get(message.guild.id);
            let currentThresh = jobThresh.get(message.guild.id);
            try {
                await getPrice(currentUrl).then((gotPrice) => {
                    let currentPrice = parseFloat(gotPrice);
                    if(currentPrice < currentThresh) {
                        message.channel.send(`Price drop! Current price is $${currentPrice}, ${jobCaller.get(message.guild.id)}`);
                        message.channel.send(currentUrl);
                    }
                    else {
                        //only send price above threshold if toggleNotif
                        if(toggleNotif.get(message.guild.id)) {
                            message.channel.send(`Current price is $${currentPrice}`);
                            message.channel.send(currentUrl);
                        }
                    }
                }).catch(err => {
                    console.log(err);
                })
            }

            catch(err) {
                console.log(err);
            }
        });

        //update runningJob and database with new job
        runningJob.set(message.guild.id, currentCronJob);
        await connection.query(
            `UPDATE MonitorInfo SET guildJob = '${currentCronJob}' WHERE guildId = '${message.guild.id}'`
        );

    }



    else if(command == 'stop') {
        //check for correct number of args left

        if(args.length != 0) {
            message.channel.send('Incorrect number of parameters, use !help for details on how to use this command.');
            return;
        }

        let currentJob = runningJob.get(message.guild.id);
        
        //check for running job
        if(currentJob == "CLEAR") {
            message.channel.send("No job currently running!");
        }
        //stop job
        currentJob.stop();
        message.channel.send(`Job: ${jobName.get(message.guild.id)}, stopped.`);
        //reset all map fields corresponding to calling server
        runningJob.set(message.guild.id, "CLEAR");
        jobName.set(message.guild.id, null);
        jobUrl.set(message.guild.id, null);
        jobCaller.set(message.guild.id, null);
        jobInterval.set(message.guild.id, null);
        jobThresh.set(message.guild.id, null);
        currentJob = "CLEAR";
        //reset all MonitorInfo table fields corresponding to calling server
        await connection.query(
            `UPDATE MonitorInfo SET guildJob = '${currentJob}', guildJobName = '${null}', guildUrl = '${null}', guildJobName = '${null}', guildCaller = '${null}', guildInterval = '${null}', guildThresh = '${null}' WHERE guildId = '${message.guild.id}'`
        );
    }



    else if(command == 'list') {
        if(jobName.get(message.guild.id) != null) {
            message.channel.send(`Current job is: ${jobName.get(message.guild.id)}`);
        }
        else {
            message.channel.send("No job running.");
        }
    }

});



//connect to the database
(async () => {
    connection = await require('../database/db');
    await client.login(process.env.BOT_TOKEN);
})();
