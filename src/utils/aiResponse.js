import axios from "axios";
import { get } from "mongoose";

const getAIResponse = async (prompt) => {
  try {
    const res = await axios.post("http://localhost:11434/api/generate", {
      model: "llama3",
      prompt : `Act as an chatbot for me for all upcoming chats `+prompt,
      stream: false,
    });
    console.log(res.data.response)
    return res.data.response;
  } catch (err) {
    console.log(err)
    return "AI is not available right now.";
  }
};

export default getAIResponse