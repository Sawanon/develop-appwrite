import express from "express";
const env = process.env;
const app = express();
const port = env.PORT || 3009;

const username = "sawanon";
const password = "123456";
const exprire = 5

let access_token = null;
let timer
const auth = (authorization) => {
  try {
    const token = authorization.split(" ")[1];
    return Buffer.from(`${username}:${password}`).toString("base64") === token;
  } catch (error) {
    return false;
  }
};

app.use(express.json());
app.use(express.urlencoded({ extended: true }));

app.get("/", (req, res) => {
  res.send("bank");
});

const countdown = () => {
    if(timer){
        clearTimeout(timer)
    }
    timer = setTimeout(() => {
        access_token = null
        console.log("clear access_token");
    }, exprire * 1000);
}

app.post("/ldbpay/v1/authService/token", (req, res) => {
  const authorization = req.headers.authorization;
  console.log(auth(authorization));
  if (!auth(authorization)) {
    res.status = 401;
    return res.json({
      message: "unAuthendication",
    });
  }
  access_token = Buffer.from(new Date().toISOString()).toString("base64");
  countdown()
  res.json({
    access_token: access_token,
    token_type: "bearer",
    expires_in: exprire,
    scope: "deeplink_center_scope",
    jti: "5949efa2-ed88-44b3-9952-d5795e0cdc5a",
  });
});

app.listen(port, () => {
  console.log(`listen on port ${port}`);
});
