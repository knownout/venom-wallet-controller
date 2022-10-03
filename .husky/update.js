const fs = require("fs");
const path = require("path");

const packageFilePath = path.resolve(__dirname, "..", "package", "package.json");

if (!fs.existsSync(packageFilePath)) throw new Error("Package file not found in: " + packageFilePath);

const packageFileData = JSON.parse(fs.readFileSync(packageFilePath, "utf-8"));

const packageVersionData = String(packageFileData.version).split(".").map(Number);

packageVersionData[2] = packageVersionData[2] + 1;

packageFileData.version = packageVersionData.join(".");

fs.writeFileSync(packageFilePath, JSON.stringify(packageFileData, null, 4), "utf-8");
