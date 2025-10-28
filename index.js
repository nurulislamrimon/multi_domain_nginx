import express from "express";
import { execSync } from "child_process";

const app = express();
const port = process.env.PORT || 5000;

app.get("/", (req, res) => {
  res.send(`Hello World! From ${process.env.APP_NAME}`);
});

app.post("/add/:domain", (req, res) => {
  const domain = req.params.domain;
  execSync(`node /root/auto-ssl.js ${domain}`);
  res.send(`Hello World! From ${process.env.APP_NAME}`);
});

app.listen(port, () => {
  console.log(`${process.env.APP_NAME} running on port ${port}`);
});
