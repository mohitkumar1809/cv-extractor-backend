require("dotenv").config();
const express = require("express");
const mongoose = require("mongoose");
const cors = require("cors");
const multer = require("multer");
const pdfParse = require("pdf-parse");
const fs = require("fs");

const { GoogleGenerativeAI } = require("@google/generative-ai");
require("dotenv").config();

const genAI = new GoogleGenerativeAI(process.env.GEMINI_API_KEY);

async function extractDataWithGemini(text) {
  const model = genAI.getGenerativeModel({ model: "gemini-pro" });

  const prompt = `Extract the following details from this resume:\n
  - Name
  - Email
  - Phone
  - Skills
  - totalExperience(years)
  - Experience (Company, Job Title, Duration)
  - Education (Degree, University, Year)
  - Projects (Title, Description)

  Resume Text: ${text}

  Return only the response in JSON format no other text.`;

  const result = await model.generateContent(prompt);
  const response = result.response.text();
  let jsonString = response.replace(/```json|```/g, "").trim(); // Remove markdown formatting
  const jsonObject = JSON.parse(jsonString);
  return jsonObject
}


const app = express();
app.use(cors());
app.use(express.json());

// MongoDB Connection
mongoose
  .connect(process.env.MONGO_URI, {
    useNewUrlParser: true,
    useUnifiedTopology: true,
  })
  .then(() => console.log("MongoDB Connected"))
  .catch((err) => console.log(err));

// Multer Configuration (File Upload)
const storage = multer.diskStorage({
  destination: (req, file, cb) => {
    cb(null, "uploads/"); // Save files in "uploads" folder
  },
  filename: (req, file, cb) => {
    cb(null, Date.now() + "-" + file.originalname);
  },
});
const upload = multer({ storage });

const CVSchema = new mongoose.Schema({
  Name: String,
  Email: String,
  Phone: String,
  Skills: [String],
  totalExperience: String,
  Experience: [
    {
      Company: String,
      JobTitle: String,
      Duration: String,
    },
  ],
  Education: [
    {
      Degree: String,
      University: String,
      Year: String,
    },
  ],
  Projects: [
    {
      Title: String,
      Description: String,
    },
  ],
  rawText: String, // Store extracted raw text
}, { timestamps: true });

// Model Schema for MongoDB
const CV = mongoose.model("CV", CVSchema);

app.post("/upload", upload.single("file"), async (req, res) => {
  try {
    if (!req.file) return res.status(400).json({ error: "No file uploaded" });

    const pdfBuffer = fs.readFileSync(req.file.path);
    const data = await pdfParse(pdfBuffer);
    const extractedText = data.text;

    const structuredData = await extractDataWithGemini(extractedText);
    structuredData.rawText = extractedText;
    fs.unlinkSync(req.file.path); // Remove file after processing
     await CV.create({ ...structuredData });
    res.json(structuredData);
  } catch (error) {
    console.error("Error processing file:", error);
    res.status(500).json({ error: "Error processing file" });
  }
});

// Get all extracted CVs API
app.get("/cvs", async (req, res) => {
  try {
    const cvs = await CV.find();
    res.json(cvs);
  } catch (error) {
    res.status(500).json({ error: "Error fetching CVs" });
  }
});

// Server Listening
const PORT = process.env.PORT || 5000;
app.listen(PORT, () => console.log(`Server running on port ${PORT}`));
