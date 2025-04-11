const axios = require('axios');

// Global variable to store only the fear_greed_index value
let fear_greed_index = 50;

// Async function to fetch data and schedule updates
async function updateFearGreedIndex() {
    try {
        // Fetch data from the API
        const response = await axios.get('https://api.alternative.me/fng/');
        const data = response.data;

        // Check if there's an error in the metadata
        if (data.metadata && data.metadata.error) {
            console.error('API Error:', data.metadata.error);
            return;
        }

        // Update the fear_greed_index variable with only the value
        fear_greed_index = parseInt(data.data[0].value, 10);

        console.log(`Updated Fear & Greed Index Value: ${fear_greed_index}`);

        // Get the time_until_update in seconds from the API response
        const timeUntilUpdate = parseInt(data.data[0].time_until_update, 10) * 1000; // Convert to milliseconds

        // Schedule the next update based on time_until_update
        setTimeout(() => {
            updateFearGreedIndex(); // Recursive call to update the index again
        }, timeUntilUpdate);

    } catch (error) {
        console.error('Error fetching Fear & Greed Index:', error);

        // Retry after 1 minute in case of an error
        setTimeout(() => {
            updateFearGreedIndex();
        }, 60000); // Retry after 60 seconds
    }
}

// Getter function to retrieve the updated fear_greed_index value
function getFearGreedIndex() {
    return fear_greed_index;
}

// Start updating the Fear & Greed Index
updateFearGreedIndex();

// Export the getter function and the update function
module.exports = {
    getFearGreedIndex
};
