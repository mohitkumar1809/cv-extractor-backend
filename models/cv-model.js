const mongoose = require("mongoose");

const CVSchema = new mongoose.Schema(
  {
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
    rawText: String,
  },
  { timestamps: true }
);

module.exports = mongoose.model("CV", CVSchema);
