const express = require("express");
const app = express();
const port = process.env.PORT || 5000;

app.get("/", (req, res) => {
  res.send(`Hello World! From ${process.env.APP_NAME}`);
});

app.listen(port, () => {
  console.log(`${process.env.APP_NAME} running on port ${port}`);
});
