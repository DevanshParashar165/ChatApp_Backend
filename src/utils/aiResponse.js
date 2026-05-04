import axios from "axios";

const getAIResponse = async (prompt) => {
  try {
    if (!process.env.GROQ_API_KEY) {
      throw new Error("Missing GROQ_API_KEY");
    }

    const res = await axios.post(
      "https://api.groq.com/openai/v1/chat/completions",
      {
        model: "llama-3.1-8b-instant", 
        temperature: 0.7,
        messages: [
          {
            role: "system",
            content:"You are QuickChat AI, an intelligent, friendly, and fast conversational assistant inside a messaging app Quick Chat.Your job is to :- Reply naturally like a human (not robotic)- Keep responses short and clear unless user asks for detail - Be helpful, practical, and conversational - Use simple language (like chatting on WhatsApp) - Add light personality (friendly tone, occasional emojis if appropriate) Guidelines: - If user asks a casual question → reply casually - If user asks technical question → explain clearly step-by-step - If user is confused → simplify the answer - Do NOT mention you are an AI unless asked - Do NOT give overly long paragraphs - Keep responses engaging and easy to read You are not a formal assistant — you are a smart chat companion."
          },
          {
            role: "user",
            content: String(prompt || ""),
          },
        ],
      },
      {
        headers: {
          Authorization: `Bearer ${process.env.GROQ_API_KEY}`,
          "Content-Type": "application/json",
        },
      }
    );

    return res.data?.choices?.[0]?.message?.content || "No response";
  } catch (err) {
    console.log("GROQ ERROR:", err.response?.data || err.message);
    return "AI is not available right now.";
  }
};

export default getAIResponse;