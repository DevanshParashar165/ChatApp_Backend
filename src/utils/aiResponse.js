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
            content:
              "You are QuickChat AI, a helpful assistant like WhatsApp AI.",
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