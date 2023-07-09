const express = require('express');
const app = express();
const port = 8000;
const path = require('path');
const fs = require('fs').promises;
const { authenticate } = require('@google-cloud/local-auth');
const { google } = require('googleapis');


const SCOPES = [
    'https://www.googleapis.com/auth/gmail.readonly',
    'https://www.googleapis.com/auth/gmail.send',
    'https://www.googleapis.com/auth/gmail.labels',
    'https://mail.google.com/'
];//-->11-16 const scopes

app.get('/', async (res, _req) => {

    // load client secrets from a local file.
    const credentials = await fs.readFile('credentials.json');

    // Authorize a client with credentials, then call the Gmail API
    const auth = await authenticate({
        keyfilePath: path.join(__dirname, 'credentials.json'),
        scopes: SCOPES,
    });

    console.log("This is AUTH = ", auth);

    const gmail = google.gmail({ version: "v1", auth });

    const response = await gmail.users.labels.list({
        userId: 'me',
    });//-->32-34 const res = await gmail.users.labels.list

    const LABEL_NAME = 'Vactions';

    // Load credentials from file
    async function loadCredentials(auth) {
        const filePath = path.join(process.cwd(), 'credentials.json');
        const content = await fs.readFile(filePath, { encoding: 'utf-8' });
        return JSON.parse(content);
    }//38-42--> async funtion for loadcredentials()

    // get messages that have no prior replies
    async function getUnRepliedMessages(auth) {
        const gmail = google.gmail({ version: "v1", auth });
        const res = await gmail.users.messages.list({
            userId: "me",
            q: '-in:chats -from:me -has:userlabels'
        });
        return res.data.messages || [];
    }//-->45-52 async function getUnRepliedMessages

    // send reply to the meesages
    async function sendReply(auth, message) {
        const gmail = google.gmail({ version: "v1", auth });
        const res = await google.users.messages.get({
            userId: "me",
            id: message.id,
            format: 'metadata',
            metadataHeaders: ['Subject', 'From'],
        });//-->58-63 const res = await google.users.messages.get
        const subject = res.data.payload.headers.find(
            (header) => header.name === 'Subject'
        ).value;

        const from = res.data.payload.headers.find(
            (header) => header.name === 'From'
        ).value;
        const replyTo = from.match(/<(.")>/)[1];
        const replySubject = subject.startsWith('Re:') ? subject : `Re: ${subject}`;
        const replyBody = `Hi,\n\nI'm currently on vacation and will get bacck to you soon.\n\nRegards,\nShwet Gupta`;
        const rawMessage = [
            `From me`,
            `To : ${replyTo}`,
            `Subject : ${replySubject}`,
            `in-Reply-To: ${message.id}`,
            `References: ${message.id}`,
            '',
            replyBody,
        ].join('\n');//-->85-93 const message

        const encodedMessage = Buffer.from(rawMessage).toString('base64').replace(/\+/g, '-').replace(/\//g, '_').replace(/=+$/, '');
        await gmail.users.messages.send({
            userId: "me",
            requestBody: {
                raw: encodedMessage,
            },
        });//--> 84-89 await gmail.users.messages.send
    }//-->54-90 async function sendReply

    async function createLabel(auth) {
        const gmail = google.gmail({ version: 'v1', auth });
        try {
            const res = await gmail.users.labels.create({
                userId: "me",
                requestBody: {
                    name: LABEL_NAME,
                    labeListVisibility: 'labelShow', //chane this value
                    messsageListVisibility: 'show', //change this value
                },//-->97-101 request body:
            });//--> async function createLabel(auth)
            return res.data.id;
        }
        catch (err) {
            if (err.code === 409) {
                // Label already axist
                const res = await gmail.users.list({
                    userId: "me",
                });
                const label = res.data.labels.find((label)=> label.name === LABEL_NAME);
                return label.id;

            } else {
                throw err;
            }

        }//-->106-119 catch (error)
    }//-->93-120 async function createLabel(auth)

    // Main Function
    async function main() {
        // create a label for the app
        const labelId = await createLabel(auth);
        console.log(`created label with id ${labelId}`);

        // Repeat the following steps in random intervals
        setInterval(async () => {
            //Get messages that have no prior replies
            const messages = await getUnRepliedMessages(auth);
            console.log(`Found ${messages.length} unreplied messages`);

            // for each message
            for (const message of messages) {
            // send reply to the message
            await sendReply(auth, message);
            console.log(`sent reply to the message with id ${message.id}`);

            // Add label to the message and move to the label folder
            await addLabel(auth.message, labelId);
            console.log(`Added label to message with id ${message.id}`);
        }//-->134-143 for (const message of messages) 
    }, Math.floor(Math.random() * (120 - 45 + 1) + 45) * 1000); //Random interval between 45 and 120 seconds
}//--> 123-145 function main()

main.catch(console.error);


const labels = response.data.labels;
res.send("You have successfully subscribes our service.");
})//-->16-152  app.get


app.listen(port,()=>{
    console.log(`App is listening at http://localhost:${port}`);
})



