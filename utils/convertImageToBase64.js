const axios = require('axios');
const fs = require('fs');
const sharp = require('sharp');
const base64 = require('base-64');

const convertImageToBase64 = async (imageUrl) => {
  let imageData;

  try {
    if (fs.existsSync(imageUrl)) {
      imageData = fs.readFileSync(imageUrl);
    } else {
      const response = await axios.get(imageUrl, { responseType: 'arraybuffer' });
      imageData = response.data;
    }

    // Resize the image
    const resizedImageBuffer = await sharp(imageData).resize({ width: 800 }).toBuffer();
    return resizedImageBuffer.toString('base64');
  } catch (error) {
    console.error('Error fetching or processing image:', error);
    return null;
  }
};

module.exports = convertImageToBase64;
