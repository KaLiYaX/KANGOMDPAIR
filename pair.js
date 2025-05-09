const { malvinid } = require('./id');
const express = require('express');
const fs = require('fs');
const router = express.Router();
const pino = require("pino");
const { Storage } = require("megajs");

const {
    default: Malvin_Tech,
    useMultiFileAuthState,
    delay,
    makeCacheableSignalKeyStore,
    Browsers
} = require("@whiskeysockets/baileys");

// Generate random ID for file naming
function randomMegaId(length = 6, numberLength = 4) {
    const chars = 'ABCDEFGHIJKLMNOPQRSTUVWXYZabcdefghijklmnopqrstuvwxyz0123456789';
    let result = '';
    for (let i = 0; i < length; i++) {
        result += chars.charAt(Math.floor(Math.random() * chars.length));
    }
    const number = Math.floor(Math.random() * Math.pow(10, numberLength));
    return `${result}${number}`;
}

// Upload to Mega and return shareable link
async function uploadCredsToMega(filePath) {
    const storage = await new Storage({
        email: 'jessicajerssy009@gmail.com',
        password: 'Jessica@@1234'
    }).ready;

    if (!fs.existsSync(filePath)) throw new Error(`Missing file: ${filePath}`);

    const uploadResult = await storage.upload({
        name: `${randomMegaId()}.json`,
        size: fs.statSync(filePath).size
    }, fs.createReadStream(filePath)).complete;

    const fileNode = storage.files[uploadResult.nodeId];
    return await fileNode.link();
}

// Remove directory safely
function removeFile(path) {
    if (fs.existsSync(path)) {
        fs.rmSync(path, { recursive: true, force: true });
    }
}

// Handle GET route
router.get('/', async (req, res) => {
    const id = malvinid();
    let num = req.query.number;

    async function MALVIN_PAIR_CODE() {
        const sessionPath = `./temp/${id}`;
        const { state, saveCreds } = await useMultiFileAuthState(sessionPath);

        try {
            const Malvin = Malvin_Tech({
                auth: {
                    creds: state.creds,
                    keys: makeCacheableSignalKeyStore(state.keys, pino({ level: "fatal" })),
                },
                printQRInTerminal: false,
                logger: pino({ level: "fatal" }),
                browser: Browsers.macOS("Safari")
            });

            if (!Malvin.authState.creds.registered) {
                await delay(1500);
                num = num.replace(/\D/g, '');
                const code = await Malvin.requestPairingCode(num);
                console.log("Pairing code sent:", code);
                if (!res.headersSent) res.send({ code });
            }

            Malvin.ev.on('creds.update', saveCreds);

            Malvin.ev.on("connection.update", async ({ connection, lastDisconnect }) => {
                if (connection === "open") {
                    await delay(5000);
                    const filePath = `${sessionPath}/creds.json`;
                    if (!fs.existsSync(filePath)) {
                        console.error("Missing creds file.");
                        return;
                    }

                    const megaUrl = await uploadCredsToMega(filePath);
                    const sessionID = 'CIPHER-MD*' + megaUrl.split('/file/')[1];  // Correct way to extract

                    console.log("Session ID:", sessionID);
                    const sent = await Malvin.sendMessage(Malvin.user.id, { text: sessionID });

                    const MALVIN_TEXT = `*[ CIPHER MD CONNECTED ]*\n\n┏━━━━━━━━━━━━━━━━━━\n┃ *CIPHER* - 𝗠𝗗 𝗖𝗢𝗡𝗡𝗘𝗖𝗧𝗘𝗗\n┃𝗦𝗨𝗖𝗘𝗦𝗦𝗙𝗨𝗟𝗟𝗬 💀😑\n┃ 𝘁𝘆𝗽𝗲 .menu 𝘁𝗼 𝘀𝗲𝗲 𝗮𝗹𝗹 𝗰𝗼𝗺𝗺𝗮𝗻𝗱𝘀\n┗━━━━━━━━━━━━━━━━━━\n┏━━━━━━━━━━━━━━━━━━\n┃𝐃𝐞𝐯 : HACKERPRO\n┃𝐂𝐨𝐧𝐭𝐚𝐜𝐭 : t.me/HACK_ERPRO\n┗━━━━━━━━━━━━━━━━━━\n> WhatsApp Channel:\n> https://whatsapp.com/channel/0029VbAUgm5Fi8xfcJspqi3f`;

                    await Malvin.sendMessage(Malvin.user.id, { text: MALVIN_TEXT }, { quoted: sent });

                    await delay(100);
                    await Malvin.ws.close();
                    return removeFile(sessionPath);
                }

                if (connection === "close" && lastDisconnect?.error?.output?.statusCode !== 401) {
                    console.warn("Disconnected, retrying...");
                    await delay(10000);
                    MALVIN_PAIR_CODE();
                }
            });

        } catch (err) {
            console.error("Pairing error:", err);
            removeFile(sessionPath);
            if (!res.headersSent) res.send({ code: "Service is Currently Unavailable" });
        }
    }

    await MALVIN_PAIR_CODE();
});

module.exports = router;