const mongoose = require("mongoose");

const messageSchema = new mongoose.Schema({
    roomId: {
        type: String,
        required: true
    },

    sender: {
        type: String,
        required: true
    },

    message: {
        type: String,
        required: true,
        maxlength: 1000
    },

    createdAt: {
        type: Date,
        default: Date.now
    }
});

module.exports = mongoose.model("Message", messageSchema);