const qrcode = require("qrcode-terminal")
const fs = require('fs')
const pino = require("pino")
const { default: makeWASocket, Browsers, delay, useMultiFileAuthState, fetchLatestBaileysVersion, PHONENUMBER_MCC, jidNormalizedUser, makeCacheableSignalKeyStore } = require("@whiskeysockets/baileys")
const Pino = require("pino")
const NodeCache = require("node-cache")
const chalk = require("chalk")
const readline = require("readline")

const pairingCode = process.argv.includes("--pairing-code")
const useMobile = process.argv.includes("--mobile")

const rl = readline.createInterface({ 
    input: process.stdin, 
    output: process.stdout 
})

const question = (text) => {
    if (rl.closed) {
        console.log('Readline closed, cannot ask question')
        process.exit(1)
    }
    return new Promise((resolve) => rl.question(text, resolve))
}

async function qr() {
    try {
        let { version, isLatest } = await fetchLatestBaileysVersion()
        const { state, saveCreds } = await useMultiFileAuthState(`./sessions`)
        const msgRetryCounterCache = new NodeCache()
        
        const XeonBotInc = makeWASocket({
            logger: pino({ level: 'silent' }),
            printQRInTerminal: !pairingCode,
            browser: Browsers.windows('Firefox'),
            auth: {
                creds: state.creds,
                keys: makeCacheableSignalKeyStore(state.keys, Pino({ level: "fatal" }).child({ level: "fatal" })),
            },
            markOnlineOnConnect: true,
            generateHighQualityLinkPreview: true,
            getMessage: async (key) => {
                return ""
            },
            msgRetryCounterCache,
            defaultQueryTimeoutMs: undefined,
        })

        // Pairing code logic
        if (pairingCode && !XeonBotInc.authState.creds.registered) {
            if (useMobile) throw new Error('Cannot use pairing code with mobile api')

            let phoneNumber = await question(chalk.bgBlack(chalk.greenBright(`Please type your WhatsApp number 😍\nFor example: +254711111111 : `)))
            phoneNumber = phoneNumber.replace(/[^0-9]/g, '')

            // Validate phone number
            if (!Object.keys(PHONENUMBER_MCC).some(v => phoneNumber.startsWith(v))) {
                console.log(chalk.bgBlack(chalk.redBright("Start with country code of your WhatsApp Number, Example : +254711111111")))
                
                // Ask again with proper validation
                phoneNumber = await question(chalk.bgBlack(chalk.greenBright(`Please type your WhatsApp number 😍\nFor example: +254711111111 : `)))
                phoneNumber = phoneNumber.replace(/[^0-9]/g, '')
                
                if (!Object.keys(PHONENUMBER_MCC).some(v => phoneNumber.startsWith(v))) {
                    console.log(chalk.bgBlack(chalk.redBright("Invalid number format. Exiting...")))
                    if (rl && !rl.closed) rl.close()
                    process.exit(0)
                }
            }

            setTimeout(async () => {
                try {
                    let code = await XeonBotInc.requestPairingCode(phoneNumber)
                    code = code?.match(/.{1,4}/g)?.join("-") || code
                    console.log(chalk.black(chalk.bgGreen(`Mwtu-Md Pairing Code : `)), chalk.black(chalk.white(code)))
                } catch (error) {
                    console.log('Error getting pairing code:', error)
                }
            }, 3000)
        }

        // Connection event handler
        XeonBotInc.ev.on("connection.update", async (s) => {
            const { connection, lastDisconnect } = s
            
            if (connection === "open") {
                console.log('Connected successfully!')
                await delay(1000 * 3)
                
                await XeonBotInc.sendMessage(XeonBotInc.user.id, { text: `> *DEVICE SUCCESSFULLY LINKED*\n\n\n` })
                
                let sessionXeon = fs.readFileSync('./sessions/creds.json')
                await delay(1000 * 2)
                
                const xeonses = await XeonBotInc.sendMessage(XeonBotInc.user.id, { 
                    document: sessionXeon, 
                    mimetype: `application/json`, 
                    fileName: `creds.json` 
                })
                
                try {
                    await XeonBotInc.groupAcceptInvite("W2d")
                } catch (e) {
                    console.log('Group invite error:', e)
                }
                
                await XeonBotInc.sendMessage(XeonBotInc.user.id, { 
                    text: `> *ABOVE IS YOUR CREDS.JSON FILE.*
> *USE IT TO DEPLOY YOUR BOT.*
╔═════◇
║ 『••• 𝗩𝗶𝘀𝗶𝘁 𝗙𝗼𝗿 𝗛𝗲𝗹𝗽 •••
❒ 𝐘𝐨𝐮𝐭𝐮𝐛𝐞: youtube.com/@mwtuofficial
❒ 𝐎𝐰𝐧𝐞𝐫: t.me/mwtuofficial
❒ 𝐖𝐚𝐂𝐡𝐚𝐧𝐧𝐞𝐥: https://whatsapp.com/channel/0029VaamqHTJP212NuXUc40F
❒ 𝐆𝐢𝐭𝐡𝐮𝐛: https://github.com/mwtuofficial
❒ 𝐃𝐞𝐯𝐞𝐥𝐨𝐩𝐞𝐫: Mwtu Tech
╚═══════════════╝
 *MWTU-𝗠𝗗 𝗩2🫡🫡🫡*
___________________________
- Don't Forget To Fork and Give a Star⭐ To My Repo.
- Check Out the YouTube Channel Above for Tutorials.\n\n ` 
                }, { quoted: xeonses })
                
                await delay(1000 * 2)
                
                // Close readline properly before exit
                if (rl && !rl.closed) {
                    rl.close()
                }
                console.log('Process completed successfully')
                process.exit(0)
            }
            
            if (connection === "close" && lastDisconnect && lastDisconnect.error && lastDisconnect.error.output.statusCode != 401) {
                console.log('Connection closed, restarting...')
                setTimeout(qr, 5000)
            }
        })
        
        XeonBotInc.ev.on('creds.update', saveCreds)
        XeonBotInc.ev.on("messages.upsert", () => { })
        
    } catch (error) {
        console.log('Error in qr function:', error)
        if (rl && !rl.closed) {
            rl.close()
        }
    }
}

// Start the application
qr()

// Global error handlers
process.on('beforeExit', () => {
    if (rl && !rl.closed) {
        rl.close()
    }
})

process.on('SIGINT', () => {
    console.log('Shutting down gracefully...')
    if (rl && !rl.closed) {
        rl.close()
    }
    process.exit(0)
})

process.on('uncaughtException', function (err) {
    let e = String(err)
    const ignorableErrors = [
        "conflict", "not-authorized", "Socket connection timeout", 
        "rate-overlimit", "Connection Closed", "Timed Out", "Value not found"
    ]
    
    if (ignorableErrors.some(error => e.includes(error))) return
    
    console.log('Caught exception: ', err)
    if (rl && !rl.closed) {
        rl.close()
    }
})