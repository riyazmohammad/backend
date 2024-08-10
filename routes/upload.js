const express = require('express');
const multer = require('multer');
const path = require('path');
const fs = require('fs');
const uuid = require('uuid');
const OpenAI = require('openai');
const convertImageToBase64 = require('../utils/convertImageToBase64');

const router = express.Router();
const UPLOAD_FOLDER = 'uploads';

// OpenAI configuration
const openai = new OpenAI({
  apiKey: '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',
});

// Ensure the upload folder exists
if (!fs.existsSync(UPLOAD_FOLDER)) {
  fs.mkdirSync(UPLOAD_FOLDER);
}

const storage = multer.diskStorage({
  destination: (req, file, cb) => {
    cb(null, UPLOAD_FOLDER);
  },
  filename: (req, file, cb) => {
    cb(null, uuid.v4() + path.extname(file.originalname));
  },
});
const upload = multer({ storage });

// Process image and extract information
router.post('/process_image', upload.single('image'), async (req, res) => {
  if (!req.file) {
    return res.status(400).json({ error: 'No image part' });
  }

  const imageUrl = req.file.path;

  try {
    const base64ImageString = await convertImageToBase64(imageUrl);
    if (!base64ImageString) {
      return res.status(500).json({ error: 'Failed to fetch or encode the image' });
    }

    const response = await openai.chat.completions.create({
      model: 'gpt-4o-mini',
      messages: [
        {
          role: 'user',
          content: JSON.stringify([
            {
              type: 'image_url',
              image_url: {
                url: `data:image/jpeg;base64,${base64ImageString}`,
              },
            },
            {
              type: 'text',
              text: 'order ID, order date (Using ISO 8601 format), customer name, customer Phone Number, order item list with item name, quantity and price, subtotal amount, delivery fees, discount, total, I need these values in JSON format',
            },
          ]),
        },
      ],
      temperature: 1,
      max_tokens: 256,
      top_p: 1,
      frequency_penalty: 0,
      presence_penalty: 0,
      response_format: {
        type: 'text',
      },
    });

    const content = response.choices[0].message.content;
    const jsonMatch = content.match(/```json\n([\s\S]*?)\n```/);

    if (jsonMatch) {
      const jsonContent = JSON.parse(jsonMatch[1]);
      res.json(jsonContent);
    } else {
      res.status(500).json({ error: 'Failed to extract JSON from response' });
    }
  } catch (error) {
    console.error('Error processing image:', error);
    res.status(500).json({ error: 'Error processing image' });
  }
});

module.exports = router;
