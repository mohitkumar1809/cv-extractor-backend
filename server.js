require("dotenv").config();
const express = require("express");
const mongoose = require("mongoose");
const cors = require("cors");
const multer = require("multer");
const pdfParse = require("pdf-parse");
const fs = require("fs");

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

// Model Schema for MongoDB
const CVSchema = new mongoose.Schema({
  name: String,
  email: String,
  phone: String,
  skills: [String],
  experience: String,
  rawText: String,
});
const CV = mongoose.model("CV", CVSchema);

// Upload & Extract CV API
app.post("/upload", upload.single("file"), async (req, res) => {
  try {
    if (!req.file) return res.status(400).json({ error: "No file uploaded" });

    // Read and parse the PDF
    const pdfBuffer = fs.readFileSync(req.file.path);
    const data = await pdfParse(pdfBuffer);
    const extractedText = data.text;

    // Extract structured data
    const nameMatch = extractedText.match(/(Name|Full Name):?\s*(.+)/i);
    const emailMatch = extractedText.match(/[\w._%+-]+@[\w.-]+\.[a-zA-Z]{2,}/);
    const phoneMatch = extractedText.match(/(\+\d{1,3}[-.\s]?)?\d{10}/);
    const skillsMatch = extractedText.match(
      /(Skills|Technologies|Expertise):?\s*(.+)/i
    );
    const experienceMatch = extractedText.match(
      /(Experience|Work History):?\s*(.+)/i
    );

    const extractedData = {
      name: nameMatch ? nameMatch[2] : "N/A",
      email: emailMatch ? emailMatch[0] : "N/A",
      phone: phoneMatch ? phoneMatch[0] : "N/A",
      skills: skillsMatch ? skillsMatch[2].split(",").map((s) => s.trim()) : [],
      experience: experienceMatch ? experienceMatch[2] : "N/A",
      rawText: extractedText,
    };

    // Save data to MongoDB
    const savedCV = await CV.create(extractedData);

    res.json(savedCV);
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
