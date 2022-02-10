let NFCPollWrapper = require("nfc-poll-wrapper");

/**
 * NFC interface to reduce the hassle of changing between these fragile Node.js NFC libraries.
 */
class NFC {
    /**
     * Begin continuosly polling for NFC tags
     * @param {function(string):void} callback The function to run when a tag is discovered
     */
    poll = (callback) => {
        console.log("Polling...");
        let instance = NFCPollWrapper.poll();
        instance.on("device", ({ raw, UID, NFCIDversion }) => {
            callback(UID.toString("hex"));
        });
    }
}

module.exports = NFC;