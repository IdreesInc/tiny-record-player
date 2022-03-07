let fs = require('fs');
let https = require('https');
let NFC = require("./nfc");
let { exec } = require("child_process");

let config = JSON.parse(fs.readFileSync('./config.json', 'utf8'));

let connected = false;

async function init() {
    console.log("Spinning up Tiny Record Player!");
    console.log("Connecting to SubWOOFer...");
    connectToSpeaker();
    let authenticateResponse = await authenticate();
    if (authenticateResponse && authenticateResponse.access_token) {
        console.log("Authentication successful!");
    } else {
        console.error("Authentication failed!");
        console.log(authenticateResponse);
        return;
    }
    let accessToken = authenticateResponse.access_token;
    // console.log(await getConnectedDevices(accessToken));

    let nfc = new NFC();
    nfc.poll((id) => {
        console.info("NFC tag detected with ID: ", id);
        if (config.records[id]) {
            let record = config.records[id];
            console.log("Tag matched to record '" + record.name + "'");
            console.log(record);
            if (connected) {
                playFromUri(accessToken, record.uri, config.spotifyd_device);
            } else {
                playFromUri(accessToken, record.uri);
            }
        } else {
            console.log("No record found for tag " + id);
        }
    });
}

async function connectToSpeaker() {
    if (!config.bluetooth_mac_address) {
        throw new Error("Missing Bluetooth MAC address in config!");
    }
    exec("bluetoothctl connect " + config.bluetooth_mac_address, (error, stdout, stderr) => {
        if (error || stderr) {
            if (connected) {
                if (error) {
                    console.error(`error: ${error.message}`);
                }
                if (stderr) {
                    console.error(`stderr: ${stderr}`);
                }
                connected = false;
            }
            setTimeout(connectToSpeaker, 2500);
        } else {
            if (!connected) {
                console.log(stdout);
                connected = true;
            }
            setTimeout(connectToSpeaker, 60000);
        }
    });
}

async function authenticate() {
    let body = new URLSearchParams({
        "grant_type": "refresh_token",
        "refresh_token": config.refresh_token
    }).toString();
    
    let options = {
        hostname: 'accounts.spotify.com',
        path: '/api/token',
        method: 'POST',
        headers: {
            'Content-Type': 'application/x-www-form-urlencoded',
            'Content-Length': Buffer.byteLength(body),
            'Authorization': 'Basic ' + Buffer.from(config.client_id + ':' + config.client_secret).toString('base64')
        }
    };
    
    return new Promise((resolve) => {
        let req = https.request(options, res => {
            console.log(`statusCode: ${res.statusCode}`);

            let buffers = [];
            res.on('data', (chunk) => {
                buffers.push(chunk);
            }).on('end', () => {
                if (buffers.length > 0) {
                    resolve(JSON.parse(buffers));
                } else {
                    console.error("Authentication failed!");
                    resolve();
                }
            });
        
            req.on('error', error => {
                console.error(error);
                resolve();
            });
        });
        req.write(body);
        req.end();
    });
}

async function getCurrentlyPlaying(accessToken) {
    return get(accessToken, '/v1/me/player/currently-playing');
}

async function getConnectedDevices(accessToken) {
    return get(accessToken, '/v1/me/player/devices');
}

async function playFromUri(accessToken, uri, deviceId) {
    if (uri.includes("track")) {
        return playTrack(accessToken, uri, deviceId);
    } else if (uri.includes("album")) {
        return playAlbum(accessToken, uri, deviceId);
    } else {
        console.error("Unsupported URI: " + uri);
    }
}

async function playAlbum(accessToken, contextUri, deviceId) {
    return put(accessToken, '/v1/me/player/play' + (deviceId ? `?device_id=${deviceId}` : ""), { context_uri: contextUri });
}

async function playTrack(accessToken, uri, deviceId) {
    return put(accessToken, '/v1/me/player/play' + (deviceId ? `?device_id=${deviceId}` : ""), { uris: [uri] });
}

async function get(accessToken, path) {
    let options = {
        hostname: 'api.spotify.com',
        path: path,
        method: 'GET',
        headers: {
            'Content-Type': 'application/x-www-form-urlencoded',
            'Authorization': 'Bearer ' + accessToken
        }
    };
    console.log("GET: " + path);
    return new Promise((resolve) => {
        let req = https.request(options, res => {
            console.log(`statusCode: ${res.statusCode}`);

            let buffers = [];
            res.on('data', (chunk) => {
                buffers.push(chunk);
            }).on('end', () => {
                if (buffers.length > 0) {
                    resolve(JSON.parse(Buffer.concat(buffers).toString()));
                } else {
                    resolve();
                }
            });
        
            req.on('error', error => {
                console.error(error);
                resolve();
            });
        });
        req.end();
    });
}

async function put(accessToken, path, body) {
    let options = {
        hostname: 'api.spotify.com',
        path: path,
        method: 'PUT',
        headers: {
            'Content-Type': 'application/json',
            'Authorization': 'Bearer ' + accessToken
        }
    };
    console.log("PUT: " + path);
    return new Promise((resolve) => {
        let req = https.request(options, res => {
            console.log(`statusCode: ${res.statusCode}`);

            let buffers = [];
            res.on('data', (chunk) => {
                buffers.push(chunk);
            }).on('end', () => {
                if (buffers.length > 0) {
                    resolve(JSON.parse(Buffer.concat(buffers).toString()));
                } else {
                    resolve({});
                }
            });
        
            req.on('error', error => {
                console.error(error);
                resolve();
            });
        });
        req.write(JSON.stringify(body));
        req.end();
    });
}

init();