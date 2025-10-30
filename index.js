import express from "express";

const app = express();
const port = process.env.PORT || 5000;

app.use((req, res, next) => {
  const host = req.headers.host;
  const tenant = host + " is your host, It's working!";
  req.tenant = tenant;
  next();
});

app.get("/", (req, res) => {
  res.send({
    success: true,
    message: `Hello World! From ${process.env.APP_NAME}`,
    tenant: req.tenant,
  });
});

// app.post("/add/:domain", (req, res) => {
//   const domain = req.params.domain;
//   execSync(`node /root/auto-ssl.js ${domain}`);
//   res.send(`Hello World! From ${process.env.APP_NAME}`);
// });

app.listen(port, () => {
  console.log(`${process.env.APP_NAME} running on port ${port}`);
});
