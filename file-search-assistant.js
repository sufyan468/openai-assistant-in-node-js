// import the required dependencies
const fs = require("fs");
const OpenAI = require("openai");
require("dotenv").config({ path: "./.env" });

const readline = require("readline").createInterface({
  input: process.stdin,
  output: process.stdout,
});

const openai = new OpenAI({
  apiKey: process.env.OPENAI_API_KEY,
});

async function prompt(question) {
  return new Promise((resolve, reject) => {
    readline.question(question, (answer) => {
      resolve(answer);
    });
  });
}

const instructions = `This assistant is designed to help you search for files. You can ask questions like "Find in the file where the policy name is 'Updated HR policy 2024'".`;

async function runAssistant() {
  try {
    // Create an assistant
    const assistant = await openai.beta.assistants.create({
      name: "File Search Assistant",
      instructions: instructions,
      model: "gpt-4-turbo",
      tools: [{ type: "file_search" }],
      response_format: "auto",
    });

    //TODO: Upload the file to the assistant from the OpenAI Dashboard. Then the assistant will be able to search from the file.

    // Create a thread
    const thread = await openai.beta.threads.create();

    if (thread.id) {
      console.log("Thread created successfully", thread.id);
    }

    // if you want to ask a question to the assistant
    let keepAsking = true;
    while (keepAsking) {
      const userQuestion = await prompt(``);

      // Pass  question into the existing thread
      await openai.beta.threads.messages.create(thread.id, {
        role: "user",
        content: userQuestion,
      });

      // Runs to wait for the assistant response and then retrieve it
      const run = await openai.beta.threads.runs.create(thread.id, {
        assistant_id: assistant.id,
      });

      console.log("Run created successfully", run.id);

      let runStatus = await openai.beta.threads.runs.retrieve(
        thread.id,
        run.id
      );

      // Polling mechanism to see  runStatus is completed
      while (runStatus.status !== "completed") {
        await new Promise((resolve) => setTimeout(resolve, 2000));
        runStatus = await openai.beta.threads.runs.retrieve(thread.id, run.id);
      }

      //last assistant message from the messages array
      const messages = await openai.beta.threads.messages.list(thread.id);
      console.log("Assistant Response: \n", JSON.stringify(messages));

      // Find the last message for the current run
      const lastMessageForRun = messages.data
        .filter(
          (message) => message.run_id === run.id && message.role === "assistant"
        )
        .pop();

      // If an assistant message is found then log it
      if (lastMessageForRun) {
        console.log("response: \n", lastMessageForRun.content[0].text.value);
        fs.writeFileSync(
          "key_phrase.txt",
          JSON.stringify(lastMessageForRun.content[0].text.value)
        );
      }

      const continueAsking = await prompt(
        "Do you want to ask another question? (yes/no) "
      );
      keepAsking = continueAsking.toLowerCase() === "yes";

      // If the keepAsking state is falsy show an ending message
      if (!keepAsking) {
        console.log("Alrighty then, I hope you learned something!\n");
      }
    }

    // close the readline
    readline.close();
  } catch (error) {
    console.error(error);
  }
}

// Call the main function
runAssistant();
