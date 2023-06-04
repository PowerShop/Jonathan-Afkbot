const axios = require('axios');

async function importCodeFromURL(url) {
    try {
        const response = await axios.get(url);
        const code = response.data;
        eval(code); // Execute the code
    } catch (error) {
        console.error('Error importing code:', error);
    }
}

// Usage
const url = 'https://raw.githubusercontent.com/PowerShop/Jonathan-Afkbot/master/bot.js';
importCodeFromURL(url);
