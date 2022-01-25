const cheerio = require('cheerio');
const axios = require('axios');


//returns true if item in stock, false otherwise
function checkStock(itemUrl) {
    return new Promise(async function(resolve, reject) {
        try {
            //probably need to make this a promise and reject?
            const { data } = await axios({
                method: "GET",
                url: itemUrl,
            });
    
    
            const $ = cheerio.load(data);
            const elementSelector = '#qualifiedBuybox';
            let isDefined = $(elementSelector).attr('id');
            
            if(isDefined) {
                isDefined =  true;
            }
            else {
                isDefined = false;
            }
            resolve(isDefined);
        }
        catch(err) {
            console.log(err);
            reject(err);
            console.log("reach test");
        }
    })
    
}

function getName(itemUrl) {
    return new Promise(async function(resolve, reject) {
        try {
            const { data } = await axios({
                method: "GET",
                url: itemUrl,
            });
    
            const $ = cheerio.load(data);
            const nameSelector = '#productTitle';
    
            //get name
            let nameString = $(nameSelector).text().trim().replace("'", "");

            if(typeof(nameString) != undefined) {
                resolve(nameString);
            }
            else {
                reject(err);
            }
        }
    
        catch(err) {
            console.log(err);
            reject(err);
        }
    })
} 

function getPrice(itemUrl) {
    return new Promise(async function(resolve, reject) {
        try {
            const { data } = await axios({
                method: "GET",
                url: itemUrl,
            });

    
            const $ = cheerio.load(data);
            const priceSelector = '#corePrice_feature_div > div > span > span.a-offscreen';
    
            //get name
            let priceString = $(priceSelector).text().trim().replace('$','');

            

            if(typeof(priceString) != undefined) {
                resolve(priceString);
            }
            else {
                reject(err);
            }
            
        }
        
        catch(err) {
            console.log(err);
            reject(err);
        }
    })
}



module.exports = {checkStock, getName, getPrice};