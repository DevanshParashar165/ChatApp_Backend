import getAIResponse from "../utils/aiResponse.js";
import { ApiResponse } from "../utils/apiResponse.js";

export const handleAIAction = async (req, res) => {
  try {
    const { action, messageText, messagesList } = req.body;

    if (!action) {
      return res.status(400).json(new ApiResponse(400, {}, "Action is required"));
    }

    if (action === "summary") {
      if (!messagesList || !Array.isArray(messagesList)) {
        return res.status(400).json(new ApiResponse(400, {}, "messagesList is required for summaries"));
      }

      const conversationText = messagesList
        .slice(-20) // last 20 messages
        .map((msg) => `${msg.senderId?.fullname || "User"}: ${msg.text || "[Attachment]"}`)
        .join("\n");

      const prompt = `You are a professional assistant. Summarize this conversation transcript in 2-3 brief bullet points, listing the main topics discussed and active decisions. Keep it short and readable:\n\n${conversationText}`;
      const summary = await getAIResponse(prompt);

      return res.json(new ApiResponse(200, { result: summary }));
    }

    if (action === "replies") {
      if (!messagesList || !Array.isArray(messagesList)) {
        return res.status(400).json(new ApiResponse(400, {}, "messagesList is required for smart replies"));
      }

      const conversationText = messagesList
        .slice(-5) // last 5 messages
        .map((msg) => `${msg.senderId?.fullname || "User"}: ${msg.text || "[Attachment]"}`)
        .join("\n");

      const prompt = `Based on the following chat conversation, generate 3 natural, short (1-5 words), friendly, casual reply suggestions that the user could send next. Return ONLY a valid JSON array of 3 strings. Example: ["Awesome, thanks!", "Let's check tomorrow", "Sure thing!"]. Do not add any explanation or markdown formatting:\n\n${conversationText}`;
      const rawResponse = await getAIResponse(prompt);

      let suggestions = [];
      try {
        // Try parsing JSON. If Groq wraps in markdown, clean it.
        const cleanJSON = rawResponse.replace(/```json/g, "").replace(/```/g, "").trim();
        suggestions = JSON.parse(cleanJSON);
      } catch {
        // fallback
        suggestions = ["Okay!", "Got it, thanks!", "Talk to you later."];
      }

      return res.json(new ApiResponse(200, { result: suggestions }));
    }

    if (action === "grammar") {
      if (!messageText) {
        return res.status(400).json(new ApiResponse(400, {}, "messageText is required for grammar correction"));
      }

      const prompt = `Correct any spelling, punctuation, or grammar mistakes in the following message. Keep the tone casual, friendly, and informal as it is a chat message. Return ONLY the corrected message text, without quotes or additional commentary:\n\n${messageText}`;
      const corrected = await getAIResponse(prompt);

      return res.json(new ApiResponse(200, { result: corrected }));
    }

    if (action === "moderation") {
      if (!messageText) {
        return res.status(400).json(new ApiResponse(400, {}, "messageText is required for moderation"));
      }

      const prompt = `Check if this message contains harassment, slurs, explicit toxicity, hate speech, or dangerous spam. Return ONLY 'clean' if it's safe. Otherwise, return a single-sentence warning stating the issue (e.g. "Spam/Link-bait detected"). Do not write any other prefix:\n\n${messageText}`;
      const status = await getAIResponse(prompt);

      return res.json(new ApiResponse(200, { result: status.trim() }));
    }

    return res.status(400).json(new ApiResponse(400, {}, "Invalid AI action"));
  } catch (error) {
    console.error(error.message);
    return res.status(500).json(new ApiResponse(500, {}, error.message));
  }
};
