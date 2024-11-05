const { Telegraf } = require("telegraf");
const userModel = require("./models/userModel");
const app = require('express')();
const connectDb = require("./db/database");
const { message } = require("telegraf/filters");
require('dotenv').config();
const eventModel = require("./models/Event");
const bot = new Telegraf(process.env.TELEGRAM_BOT_API);
try {
  connectDb();
} catch (error) {
  console.log(error);
  process.kill(process.pid, "SIGTERM");
}
const webhookPath = '/socio-bot-webhook';
const webhookURL = `https://contentcrafter-oo7i.onrender.com${webhookPath}`;
bot.telegram.setWebhook(webhookURL);

app.use(bot.webhookCallback(webhookPath));
console.log(bot.webhookCallback(webhookPath));
const stickerList = [
  "CAACAgIAAxkBAANYZyPO9wPGycumOq5CzKXGWJLUfFUAAlQAA0G1Vgxqt_jHCI0B-jYE",
  "CAACAgIAAxkBAAIGbmcm7y4vXiICWGkebEYcFw6_U49PAAJmAANEDc8X1jIHSiOy0jo2BA",
   "CAACAgIAAxkBAAIGbGcm7kBbVvGcu_k_6zvKmR-mHEKbAAKlEAACtEWgSmojWoBZzqNHNgQ"
];
const messageId = Date.now().toString();
// Store current edited text temporarily
const editedTextStore = new Map();
const awaitingTextInput = new Map();
const userHashtagsMap = new Map(); 
let hashtagsArray= new Array(); ;
let waitingstate = null;

// Function to get a random sticker
function getRandomSticker() {
  return stickerList[Math.floor(Math.random() * 3)];
}

const textStore = new Map();
function clearAllData() {
  hashtagsArray = new Array(); // Reset the array
  userHashtagsMap.clear();    // Clear the map completely
  waitingstate = null;        // Reset waiting state
  textStore.clear();  
          // Clear text store
}
const uniqueUsername = ()=>{
  return  `user${Math.floor(1000 + Math.random() * 9000)}`
}
bot.start(async (ctx) => {
  try {
   
    const user = ctx.update.message.from;
    
    if (!user || !user.id) {
      throw new Error('Invalid user data');
    }

    const userName = uniqueUsername();
   clearAllData();
   try {
    await userModel.findOneAndUpdate(
      { tgId: user.id }, // Search by tgId
      { 
        $set: {
          tgId: user.id,
          firstName: user.first_name,
          lastName: user?.last_name,
          isBot: user.is_bot,
          userName: user.username===null ? user.username : userName
        }
      },
      { 
        new: true, 
        upsert: true 
      }
    );
    
  } catch (error) {
    console.error('Error handling user creation/update:', error);
  }
  

    // Send welcome message
    await ctx.reply(
      `Hey ${user.first_name}, Welcome! I will be writing highly engaging social media posts for you 🚀 Just keep feeding me with the events throughout the day. Let's shine on social media`
    );

  } catch (error) {
    console.error('Error in start command:', error);
    await ctx.reply("Sorry, something went wrong! Please try again.");
  }
});

function formatTextForTelegram(text) {
  return text
    .replace(/\n{2,}/g, "\n\n")
    .replace(/^### (.*$)/gim, "*$1*")
    .replace(/^## (.*$)/gim, "*$1*")
    .replace(/^# (.*$)/gim, "*$1*")
    .replace(/\*\*(.*?)\*\*/g, "*$1*")
    .replace(/(?:\n|^)•\s/g, "\n- ")
    .trim();
}

//generate text
const date = new Date();
const sDate = date.setHours(0, 0, 0, 0);
const newDate = new Date();
const eData = newDate.setHours(23, 59, 59, 999);
bot.command("generate", async (ctx) => {
  try {
    const user = ctx.update.message.from;
    const event = await eventModel.find({
      id: user.id,
      createdAt: {
        $gte: sDate,
        $lte: eData,
      },
    });
    if (event.length === 0) {
      await ctx.deleteMessage(waitingId);
      await ctx.reply("No events for today...");
      return;
    }
    await ctx.reply(
      `Hey ${user.first_name} kindly write your prompt to generate articles...`,
      {
        reply_markup: {
          inline_keyboard: [
            [
              { text: "prompt", callback_data: "generate_prompt" },
              //await ctx.deleteMessage(waitingId)
            ],
          ],
        },
      }
    );
  } catch (error) {
    await ctx.reply("Something wrong...");
  }
});


bot.action("generate_prompt", async (ctx) => {
  try {
    await ctx.reply(
      "Please send your prompt for article generation using the /prompt command."
    );
  } catch (error) {
    console.error("Error in generate_prompt action:", error);
    await ctx.reply("An error occurred while processing your request.");
  }
});

// Handle the prompt command
bot.command("prompt", async (ctx) => {
  try {
    const user = ctx.update.message.from;
    const promptFromUser = ctx.message.text.replace("/prompt ", "").trim();
    // Validate the prompt
    if (!promptFromUser) {
      await ctx.reply("Please provide a prompt after the /prompt command.");
      return;
    }

    // Perform chat completion
    const response = await fetch("https://api.cohere.ai/v2/chat", {
      method: "POST",
      headers: {
        Authorization: `Bearer ${process.env.OPENAI_API}`,
        "Content-Type": "application/json",
      },
      body: JSON.stringify({
        model: process.env.MODEL,
        messages: [{ role: "user", content: promptFromUser }],
        max_tokens: 400,
      }),
    });

    const result = await response.json();
    if (result && result.message && result.message.content) {
      const text = formatTextForTelegram(result.message.content[0].text);
    
     
      textStore.set(messageId, {
        original: text,
        current: text,
        format: "normal",
      });
      // Update user token usage
      await userModel.findOneAndUpdate(
        { tgId: ctx.from.id },
        {
          $inc: {
            promtToken: result.usage.tokens.input_tokens,
            completionToken: result.usage.tokens.output_tokens,
          },
        }
      );
      await eventModel.create({
        id: user.id,
        prompt: promptFromUser,
      });
      const { message_id: waitingId } = await ctx.reply(
        `Hey ${user.first_name} kindly write your prompt to generate articles...`
      );
      await ctx.reply(text, {
        parse_mode: "HTML",
      });
      await ctx.deleteMessage(waitingId);
      // Optional: Send a hint message
    } else {
      await ctx.reply("Failed to generate a proper response.");
    }
  } catch (error) {
    console.error("Error in prompt command:", error);
    await ctx.reply("An error occurred while generating the article.");
  }
});

    //help
bot.command("help", async (ctx) => {
  await ctx.reply(
    "Choose command which you want to use: /start /generate /post "
  );
});

  //post
bot.command("post", async (ctx) => {
  try {
    await ctx.reply("Choose where you'd like to post. I'll check back in a few minutes.\n", {
      reply_markup: {
        inline_keyboard: [
          [
            { text: "LinkedIn", url: "https://www.linkedin.com" },
            { text: "X (Twitter)", url: "https://x.com/home" },
            { text: "Instagram", url: "https://www.instagram.com" },
          ],
        ],
      },
      parse_mode: "HTML",
    });
    setTimeout(() => {
      ctx.reply("posted done 👍");

    }, 100000);
    
  } catch (error) {
    await ctx.reply("An error occurred. Please try again.");
  }
});

  
 
bot.action(/save_(.+)/, async (ctx) => {
  
  const messageId = ctx.match[1];
 
  const editedText = editedTextStore.get(messageId);
  const text = textStore.get(messageId);
  const textdata = text ? text.current : "";
  const editedTextCurrent = editedText? editedText.current:""
  if (editedText) {messageId
    finalText = editedText.current;
      textStore.set(messageId, editedText); // Save the edited text
    
      editedTextStore.delete(messageId); // Clear temporary storage
      await ctx.editMessageText(`✅ Text saved! \n\n <code>${editedTextCurrent} </code>`, { parse_mode: 'HTML' });
  }
  else if(textStore){
    await ctx.editMessageText(`✅ Text saved! (Press and hold to copy on mobile, or right-click to copy on desktop)\n\n<code>${textdata}</code>`, {
      parse_mode: 'HTML'
  });
  }
  else {
      await ctx.reply('Error: Nothing to save.');
  }
    
});

// Handle Cancel action
bot.action(/cancel_(.+)/, async (ctx) => {
  const messageId = ctx.match[1];
  const originalText = textStore.get(messageId);
  await ctx.editMessageText(`The message is deleted...`, { parse_mode: 'HTML' });
  editedTextStore.delete(messageId);
});

//edit
// Command to start editing
bot.command('edit', async (ctx) => {
  const { message_id: editTextId } = await ctx.reply('Let\'s edit your prompt...');
  const textData = textStore.get(messageId);
  const text = textData? textData.current : "";
 
  try {
      await ctx.reply(text, {
          parse_mode: 'HTML',
          reply_markup: {
              inline_keyboard: [
                [
                  { text: '➕ Add Text', callback_data: `add_text_${messageId}` },
                  
              ],
              [
                { text: '✨ Bold', callback_data: `style_bold_${messageId}` },
                { text: '✨ Italic', callback_data: `style_italic_${messageId}` },
                { text: '✨ Underline', callback_data: `style_underline_${messageId}` },
            ],
            [
                { text: '🖋️ Strikethrough', callback_data: `style_strikethrough_${messageId}` },
                { text: '🔲 Code', callback_data: `style_code_${messageId}` },
                { text: '♻️ Reset', callback_data: `style_reset_${messageId}` },
                { text: '➕ Add Hashtags', callback_data: `add_hashtags_${messageId}` },
            ],
        
                  [
                      { text: '✅ Save', callback_data: `save_${messageId}` },
                      { text: '❌ Cancel', callback_data: `cancel_${messageId}` }
                  ]
              ]
          }
      });
      await ctx.deleteMessage(editTextId);
  } catch (error) {
      console.error('Error:', error);
  }
});


bot.action(/add_text_(.+)/, async (ctx) => {
  const messages_id = ctx.match[1];
  awaitingTextInput.set(ctx.from.id, messages_id); // Track user awaiting text input
  await ctx.reply('Please type the text you want to add:');
});
 
bot.action(/style_([^_]+)_(.+)/, async (ctx) => {
  try {
    const [, style, messageId] = ctx.match;
    const textData = textStore.get(messageId);

    if (!textData) {
      await ctx.answerCbQuery('Text not found');
      return;
    }

    let newFormat;
    let formattedText;

    // Only update if the format is different
    if (textData.format !== style) {
      switch (style) {
        case 'bold':
          formattedText = `<b>${textData.original}</b>`;
          newFormat = 'bold';
          break;
        case 'italic':
          formattedText = `<i>${textData.original}</i>`;
          newFormat = 'italic';
          break;
        case 'code':
          formattedText = `<code>${textData.original}</code>`;
          newFormat = 'code';
          break;
        case 'reset':
          formattedText = textData.original;
          newFormat = 'normal';
          break;
            case 'strikethrough' :
              formattedText = `<s> ${textData.original} </s>`
              newFormat = 'strikethrough'
              break;
        default:
          formattedText = textData.original;
          newFormat = 'normal';
      }

      // Only update if the text actually changed
      if (formattedText !== textData.current) {
        await ctx.editMessageText(formattedText, {
          parse_mode: 'HTML',
          reply_markup: ctx.update.callback_query.message.reply_markup
        });

        // Update stored text data
        textStore.set(messageId, {
          ...textData,
          current: formattedText,
          format: newFormat
        });

        await ctx.answerCbQuery(`Style updated to ${style}`);
      } else {
        await ctx.answerCbQuery('Already in this format');
      }
    } else {
      await ctx.answerCbQuery('Already in this format');
    }
  } catch (error) {
    if (error.description && error.description.includes('message is not modified')) {
      await ctx.answerCbQuery('Text is already in this format');
    } else {
      console.error('Style action error:', error);
      await ctx.answerCbQuery('Failed to update style');
    }
  }
});
    

bot.on('callback_query', async (ctx) => {
  const callBackdata = ctx.callbackQuery.data;
    if (callBackdata.startsWith('add_hashtags_')) {
         waitingstate = 'hashtag';
        await ctx.answerCbQuery(); 
        await ctx.reply('Please enter the hashtags you want to add (use # for hashtags, separated by spaces):');

    }

   
});


bot.on(message('text'), async(ctx)=>{
 if(waitingstate==='hashtag' && messageId){
  const userId = ctx.update.message.from.id;
  const callBackdata = ctx.update.message.text;
  const textData = textStore.get(messageId);
  const text = textData? textData.current : ""; 
hashtagsArray.push(callBackdata)
  const hashtags = hashtagsArray.join(" ");
  
  if (hashtagsArray.length > 0) {
      userHashtagsMap.set(userId,hashtags ); 
      console.log(userHashtagsMap)
      const tags = userHashtagsMap.get(userId);
      const newText = `${text}\n ${tags}`; // Append user's text
      editedTextStore.set(messageId, { ...textData, current: newText });
     const {message_id:ids} = await ctx.reply(`pls wait for sometime...`);
      await ctx.reply(newText, { 
        parse_mode: 'HTML',
        reply_markup: {
            inline_keyboard: [
                [
                    { text: '➕ Add Text', callback_data: `add_text_${messageId}` },
                    
                ],
                [
                  { text: '✨ Bold', callback_data: `style_bold_${messageId}` },
                  { text: '✨ Italic', callback_data: `style_italic_${messageId}` },
                  { text: '✨ Underline', callback_data: `style_underline_${messageId}` },
              ],
              [
                  { text: '🖋️ Strikethrough', callback_data: `style_strikethrough_${messageId}` },
                  { text: '🔲 Code', callback_data: `style_code_${messageId}` },
                  { text: '♻️ Reset', callback_data: `style_reset_${messageId}` },
                  { text: '➕ Add Hashtags', callback_data: `add_hashtags_${messageId}` },

              ],
                [
                    { text: '✅ Save', callback_data: `save_${messageId}` },
                    { text: '❌ Cancel', callback_data: `cancel_${messageId}` }
                ]
            ]
        }
    });
    await ctx.deleteMessage(ids);
  
  } else {
      await msgCtx.reply('No valid hashtags detected. Please try again.');
  }

  waitingstate = null;
 }
 //add text
    else if (messageId) {   
          const textData = textStore.get(messageId);
          const text = textData? textData.current : "";    
         const newText = `${text} ${ctx.message.text}`;
          editedTextStore.set(messageId, { ...textData, current: newText });
        
        // Display the updated text
        await ctx.reply(newText, {
            parse_mode: 'HTML',
            reply_markup: {
                inline_keyboard: [
                    [
                        { text: '➕ Add Text', callback_data: `add_text_${messageId}` },
                        
                    ],
                    [
                      { text: '✨ Bold', callback_data: `style_bold_${messageId}` },
                      { text: '✨ Italic', callback_data: `style_italic_${messageId}` },
                      { text: '✨ Underline', callback_data: `style_underline_${messageId}` },
                  ],
                  [
                      { text: '🖋️ Strikethrough', callback_data: `style_strikethrough_${messageId}` },
                      { text: '🔲 Code', callback_data: `style_code_${messageId}` },
                      { text: '♻️ Reset', callback_data: `style_reset_${messageId}` },
                      { text: '➕ Add Hashtags', callback_data: `add_hashtags_${messageId}` },

                  ],
                    [
                        { text: '✅ Save', callback_data: `save_${messageId}` },
                        { text: '❌ Cancel', callback_data: `cancel_${messageId}` }
                    ]
                ]
            }
        });

        awaitingTextInput.delete(ctx.from.id); // Clear user from awaiting input
    }
   
})


  


//sticker
bot.on(message("sticker"), async (ctx) => {
  const random = getRandomSticker();
  await ctx.sendSticker(random);
});
bot.launch();
//stop bot
process.once("SIGINT", () => bot.stop("SIGINT"));
process.once("SIGTERM", () => bot.stop("SIGTERM"));
