const mongoose = require("mongoose");

const MONGO_URI =
    "mongodb+srv://avinashponnam2004_db_user:Ponnam_9@avinashmatchaura.bfiig44.mongodb.net/avinash_match_aura?retryWrites=true&w=majority&appName=AvinashMatchAura";

mongoose.connect(MONGO_URI)
    .then(() => {
        console.log("MongoDB Atlas connected successfully!");
    })
    .catch((error) => {
        console.error("MongoDB connection failed:", error.message);
    });

module.exports = mongoose;