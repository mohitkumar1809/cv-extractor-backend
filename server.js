require("dotenv").config();
const express = require("express");
const mongoose = require("mongoose");
const cors = require("cors");
const multer = require("multer");
const pdfParse = require("pdf-parse");
const fs = require("fs");

const { GoogleGenerativeAI } = require("@google/generative-ai");
const cvModel = require("./models/cv-model");

const apiKey = process.env.GEMINI_API_KEY;
const genAI = new GoogleGenerativeAI(apiKey);

async function extractDataWithGemini(text) {
  const model = genAI.getGenerativeModel({ model: "gemini-2.0-flash-exp" });
  const generationConfig = {
    temperature: 0.7,
    topP: 0.95,
    topK: 40,
    maxOutputTokens: 8192,
    responseMimeType: "application/json",
  };

  const prompt = `Extract the following details from this resume:\n\n
  - Name
  - Email
  - Phone
  - Skills
  - totalExperience(years)
  - Experience (Company, Job Title, Duration)
  - Education (Degree, University, Year)
  - Projects (Title, Description)

  Resume Text: ${text}

  Return only the response in JSON format with keys in PascalCase format (e.g., "Name", "Email", "Phone", etc.).`;

  const result = await model.generateContent(
    [{ text: prompt }],
    generationConfig
  );
  const response = result.response.text();
  let jsonString = response.replace(/```json|```/g, "").trim();
  return JSON.parse(jsonString);
}

const app = express();
app.use(cors());
app.use(express.json());

mongoose
  .connect(process.env.MONGO_URI, {
    useNewUrlParser: true,
    useUnifiedTopology: true,
  })
  .then(() => console.log("MongoDB Connected"))
  .catch((err) => console.log(err));

const storage = multer.diskStorage({
  destination: (req, file, cb) => {
    cb(null, "uploads/");
  },
  filename: (req, file, cb) => {
    cb(null, Date.now() + "-" + file.originalname);
  },
});
const upload = multer({ storage });

app.post("/upload", upload.single("file"), async (req, res) => {
  try {
    if (!req.file) return res.status(400).json({ error: "No file uploaded" });

    const pdfBuffer = fs.readFileSync(req.file.path);
    const data = await pdfParse(pdfBuffer);
    const extractedText = data.text;

    const structuredData = await extractDataWithGemini(extractedText);
    structuredData.rawText = extractedText;
    fs.unlinkSync(req.file.path);
    await cvModel.create({ ...structuredData });
    res.json(structuredData);
  } catch (error) {
    console.error("Error processing file:", error);
    res.status(500).json({ error: "Error extracting data" });
  }
});

app.get("/cvs", async (req, res) => {
  try {
    const cvs = await cvModel.find();
    res.json(cvs);
  } catch (error) {
    res.status(500).json({ error: "Error fetching CVs" });
  }
});

const PORT = process.env.PORT || 5000;
app.listen(PORT, () => console.log(`Server running on port ${PORT}`));
