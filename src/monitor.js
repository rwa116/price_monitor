const cheerio = require('cheerio');
const axios = require('axios');


//returns true if item in stock, false otherwise
async function checkStock(itemUrl) {
    try {
        const { data } = await axios({
            method: "GET",
            url: itemUrl,
        });


        const $ = cheerio.load(data);
        const elementSelector = '#qualifiedBuybox';
        let isDefined = $(elementSelector).attr('id');
        
        if(isDefined) {
            return true;
        }
        else {
            return false;
        }
    }
    catch(err) {
        console.error(err);
    }
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