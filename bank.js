import express from "express";
import cors from "cors";

const env = process.env;
const app = express();
const port = env.PORT || 3009;

const username = "sawanon";
const password = "123456";
const exprire = 599;
let payment = {};
let access_token = null;
let timer;
const auth = (authorization) => {
  try {
    const token = authorization.split(" ")[1];
    return Buffer.from(`${username}:${password}`).toString("base64") === token;
  } catch (error) {
    return false;
  }
};
const checkBearerToken = (req) => {
  try {
    const token = req.headers.authorization.split(" ")[1];
    return token === access_token;
  } catch (error) {
    return false;
  }
};

app.use(cors());
app.use(express.json());
app.use(express.urlencoded({ extended: true }));

app.get("/", (req, res) => {
  res.send("bank");
});

const countdown = () => {
  if (timer) {
    clearTimeout(timer);
  }
  timer = setTimeout(() => {
    access_token = null;
    console.log("clear access_token");
  }, exprire * 1000);
};

const middleware = (req, res) => {
  if (checkBearerToken(req)) {
    return true;
  }
  return false;
};

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
  countdown();
  res.json({
    access_token: access_token,
    token_type: "bearer",
    expires_in: exprire,
    scope: "deeplink_center_scope",
    jti: "5949efa2-ed88-44b3-9952-d5795e0cdc5a",
  });
});

app.post("/ldbpay/v1/payment/generateLink.service", (req, res) => {
  if (!middleware(req, res)) {
    res.status = 403;
    return res.json({
      message: "unAuthendication",
    });
  }
  //TODO: create id and payment data
  const {
    merchantId,
    merchantAcct,
    customerId,
    referentId,
    amount,
    remark,
    urlBack,
    urlCallBack,
    additional1,
    additional2,
    additional3,
    additional4,
  } = req.body;
  const deeplinkId = Buffer.from(`deeplink${new Date().toISOString()}`).toString("base64");
  const link = `http://127.0.0.1:5500/public/payment.html?id=${deeplinkId}`
  payment[`${deeplinkId}`] = {
    merchantId,
    merchantAcct,
    customerId,
    referentId,
    amount,
    remark,
    urlBack,
    urlCallBack,
    additional1,
    additional2,
    additional3,
    additional4,
  };
  console.log("🚀 ~ app.post ~ payment:", payment)
  res.json({
    link,
  })
});

app.get("/confirm", async (req, res) => {
  const { id } = req.query;
  console.log("🚀 ~ app.get ~ id:", id);
  // const body = req.params
  const url = `${payment[`${id}`].urlCallBack}`
  console.log("🚀 ~ app.get ~ url:", url)
  const response = await fetch(url)
  const data = await response.json()
  console.log("🚀 ~ app.get ~ data:", data)
  res.json({
    message: "ok"
  })
  // console.log("🚀 ~ app.get ~ response.status:", response.status)
  // res.json({
  //   message: "ok",
  //   urlBack: payment[`${id}`].urlBack
  // });
});

app.listen(port, () => {
  console.log(`listen on port ${port}`);
});
