require('dotenv').config();
const express = require('express');
const multer = require('multer');
const { GoogleGenerativeAI } = require('@google/generative-ai');
const path = require('path');
const cors = require('cors');

const app = express();
const port = process.env.PORT || 3000;

app.use(cors());
app.use(express.static(__dirname));
app.use(express.json());

const upload = multer({ storage: multer.memoryStorage() });

app.post('/api/analyze', upload.single('image'), async (req, res) => {
    try {
        if (!req.file) {
            return res.status(400).json({ error: 'No image uploaded' });
        }

        const apiKey = req.body.apiKey;
        if (!apiKey) {
            return res.status(400).json({ error: 'No API Key provided' });
        }

        const genAI = new GoogleGenerativeAI(apiKey);

        const prompt = `
You are a professional graphic design critic for a SaaS app called "DesignCheck". 
Analyze this design image and provide the feedback in Urdu (except for color hex codes, font names, and english terms which can be in English). 
Return ONLY a JSON object with this exact structure, no markdown formatting or backticks around the JSON:
{
  "goodPoints": ["point 1 in urdu", "point 2 in urdu"],
  "badPoints": ["point 1 in urdu", "point 2 in urdu"],
  "accessibilityScore": 85,
  "spaceTip": "A specific, actionable tip in Urdu on how to improve the layout or negative space.",
  "fontTip": "A specific, actionable tip in Urdu on how to improve the typography or font choices.",
  "colorTip": "A specific, actionable tip in Urdu on how to improve the color palette or contrast.",
  "reportSummary": {
    "strengths": ["urdu point 1", "urdu point 2"],
    "weaknesses": ["urdu point 1", "urdu point 2"],
    "advice": ["urdu point 1", "urdu point 2"]
  },
  "extractedColors": ["#FF0000", "#00FF00", "#0000FF", "#111111"],
  "suggestedFonts": "Font Name 1, Font Name 2"
}

For the accessibilityScore, provide a number between 0 and 100 representing how accessible and legible the design is.
For goodPoints and badPoints, focus mainly on the layout composition.
For the three "Tip" fields (spaceTip, fontTip, colorTip), provide one concise sentence (translating to ~15-20 words in Urdu) giving an actionable, professional 'AI Tip' for that specific area.
For reportSummary, provide a professional summary with strengths, weaknesses, and advice.
For extractedColors, find the 4 to 6 most prominent colors in the image and return their hex codes.
For suggestedFonts, guess or suggest 2 fonts that match the style of the image.
`;

        const model = genAI.getGenerativeModel({ model: "gemini-2.5-flash" });
        const result = await model.generateContent([
            prompt,
            {
                inlineData: {
                    data: req.file.buffer.toString("base64"),
                    mimeType: req.file.mimetype
                }
            }
        ]);

        const textResponse = result.response.text().trim();
        
        let jsonStr = textResponse;
        if (jsonStr.startsWith('```json')) jsonStr = jsonStr.substring(7);
        if (jsonStr.startsWith('```')) jsonStr = jsonStr.substring(3);
        if (jsonStr.endsWith('```')) jsonStr = jsonStr.substring(0, jsonStr.length - 3);

        try {
            let parsed = JSON.parse(jsonStr.trim());
            res.json(parsed);
        } catch (e) {
            console.error("Failed to parse JSON:", jsonStr);
            res.status(500).json({ error: 'Failed to parse AI response as JSON', raw: jsonStr });
        }
    } catch (error) {
        console.error('Error calling Gemini:', error);
        res.status(500).json({ error: 'An error occurred during analysis.', details: error.message });
    }
});

app.listen(port, () => {
    console.log(`Server is running on http://localhost:${port}`);
});
