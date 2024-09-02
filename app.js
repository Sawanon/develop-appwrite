import path from "path";
import { fileURLToPath } from "url";
import { Account, Client, Databases, ID, Query, Users } from "node-appwrite";
import "dotenv/config";
import express from "express";
import { router as bankRouter, currentUrl } from "./bank.js";
import cors from "cors";
import axios from "axios";
const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);
const env = process.env;
const app = express();
const port = env.PORT || 3000;
let userBlock = {};
let userOTP = {};

app.use(cors());
app.use(express.static(path.join(__dirname, "public")));
app.use(express.json());
app.use(express.urlencoded({ extended: true }));

app.use("/bank", bankRouter);
const databaseName = env.DATABASE_NAME;
const SECRET_KEY = env.SECRET_KEY;
const INVOICE_COLLECTION = `_invoice`;
const TRANSACTION_COLLECTION = `_transaction`;
const ACCUMULATE_COLLECTION = `_accumulate`;

const client = new Client()
  .setEndpoint(env.APPWRITE_URL)
  .setProject(env.PROJECT_ID)
  .setKey(env.API_KEY_NAJA);

// middle ware
const checkSession = async (userId, sessionId) => {
  const users = new Users(client);
  const sessionIdList = await users.listSessions(userId);
  return sessionIdList.sessions.find((session) => session.$id === sessionId);
};
const middleware = async (req) => {
  try {
    const authorization = req.headers.authorization.split(" ")[1];
    const decodeAuth = Buffer.from(authorization, "base64").toString();
    const [sessionId, userId] = decodeAuth.split(":");
    
    const session = await checkSession(userId, sessionId);
    console.log(sessionId, userId);
    return {
      isPass: session !== undefined,
      userId: userId,
    };
  } catch (error) {
    console.error("🚀 ~ middleware ~ error:", error);
    return {
      isPass: false,
    };
  }
};
const blockMiddleware = async (req, res, next) => {
  // TODO: block ip too many request
  const ip =
    req.headers["cf-connecting-ip"] ||
    req.headers["x-real-ip"] ||
    req.headers["x-forwarded-for"] ||
    req.socket.remoteAddress ||
    "";
  console.log("🚀 ~ blockMiddleware ~ ip:", ip);
  const phoneNumber = req.body.phoneNumber;
  if (userBlock[`${phoneNumber}`]) {
    res.status = 500;
    return res.json({ message: "please try again later" });
  }
  next();
};
// middle ware

// session app
let userTimer = {};
// session app //

const checkExistUser = async (phone) => {
  const database = new Databases(client);
  const users = await database.listDocuments(databaseName, "user", [
    Query.equal("phone", phone),
    Query.limit(1),
  ]);
  let userId;
  users.documents.forEach((value, index) => {
    userId = value["userId"];
  });

  return userId;
};

const getToken = async (userId) => {
  const users = new Users(client);
  const token = await users.createToken(userId);
  return token;
};

const createAccount = async (email, password, name) => {
  try {
    const account = new Account(client);
    const user = await account.create(ID.unique(), email, password, name);
    return user;
  } catch (error) {
    console.error(`createAccount: ${error}`);
  }
};

const verifyCloudflare = async (request, response) => {
  const body = await request.body;
  // Turnstile injects a token in "cf-turnstile-response".
  const token = body["cf-turnstile-response"];
  const ip = request.headers["CF-Connecting-IP"];
  // Validate the token by calling the "/siteverify" API.
  let formData = new FormData();
  formData.append("secret", SECRET_KEY);
  formData.append("response", token);
  formData.append("remoteip", ip);
  const result = await fetch(
    "https://challenges.cloudflare.com/turnstile/v0/siteverify",
    {
      body: formData,
      method: "POST",
    }
  );

  const outcome = await result.json();
  if (!outcome.success) {
    console.error("failed !!");

    response.status = 403;
    response.statusText = "failed";
    return response.json({
      message: `The provided Turnstile token was not valid!`,
      data: outcome,
    });
  }
  // The Turnstile token was successfuly validated. Proceed with your application logic.
  // Validate login, redirect user, etc.
  // For this demo, we just echo the "/siteverify" response:
  return response.json({
    message: `Turnstile token successfuly validated.`,
    data: outcome,
  });
  // return new Response(
  //   "Turnstile token successfuly validated. \n" + JSON.stringify(outcome)
  // );
};

app.get("/", (req, res) => {
  console.log("🚀 ~ app.get ~ req:", req.headers);
  // maybe block other x-requested-with: 'com.example.lottery_ck' - sawanon:20240808
  res.setHeader("Content-Type", "text/html");
  res.sendFile(path.join(__dirname, "public", "explicit.html"));
});

app.post("/verifyCloudflare", async (req, res) => {
  verifyCloudflare(req, res);
});

app.post("/sign-up", async (req, res) => {
  const body = req.body;
  const { username, firstName, lastName, email, phone, address } = body;
  const multiplier = (
    phone.substring(phone.length, phone.length - 1) *
    phone.substring(phone.length - 2, phone.length - 3)
  ).toString();
  const lastPhone = multiplier.substring(
    multiplier.length,
    multiplier.length - 1
  );
  const password = `${phone.substring(0, 4)}${lastPhone}${phone.substring(4)}`;
  const user = await createAccount(email, password, `${firstName} ${lastName}`);
  let userDocument;
  if (user?.$id) {
    const roleUserId = "669a2cfd00141edc45ef";
    const database = new Databases(client);
    userDocument = await database.createDocument(
      databaseName,
      "user",
      ID.unique(),
      {
        username: username,
        userId: user.$id,
        firstname: firstName,
        lastname: lastName,
        email: email,
        phone: phone,
        type: "user",
        address: address,
        user_roles: roleUserId,
      }
    );
  }
  res.json({
    status: false,
    user: user,
    userDocument: userDocument,
  });
});

app.post("/sign-in", blockMiddleware, async (req, res) => {
  const body = req.body;
  const phoneNumber = body.phoneNumber;
  console.log("after middleware");
  const userId = await checkExistUser(phoneNumber);
  let token;
  if (userId) {
    token = await getToken(userId);
  }

  // userId: userId || null,
  res.json(token);
});

app.get("/test", async (req, res) => {
  const databases = new Databases(client)
  const lottery_date = await databases.listDocuments(databaseName, "lottery_date")
  console.log("🚀 ~ app.get ~ lottery_date:", lottery_date)
  res.json(lottery_date);
})

app.post("/createPasscode", async (req, res) => {
  try {
    const body = req.body;
    // const sessionId = req.headers['x-api-key']
    // console.log("🚀 ~ app.post ~ sessionId:", sessionId)
    const databases = new Databases(client);
    const { passcode, userId } = body;
    console.log("🚀 ~ app.post ~ passcode:", passcode);
    console.log("🚀 ~ app.post ~ userId:", userId);
    const result = await databases.updateDocument(
      databaseName,
      "user",
      userId,
      {
        passcode: passcode,
      }
    );
    console.log("🚀 ~ app.post ~ result:", result);

    res.send("ok");
  } catch (error) {
    console.log("🚀 ~ app.post ~ error:", error);

    res.send("error");
  }
});

app.get("/currentTime", (req, res) => {
  const now = new Date();
  // now.setHours(0, 0, 0, 0)
  res.setHeader("dateISO", now.toISOString());
  res.send(null);
});

app.get("/payment", (req, res) => {
  // TODO: invoice update to paid
  console.log("in payment !", new Date().toISOString());

  res.send({
    message: "test",
  });
});

app.post("/createTransaction", async (req, res) => {
  try {
    const result = await middleware(req);
    if (!result.isPass) {
      res.status = 401;
      throw Error("unAuthen");
    }
    // res.json({
    //   message: "create transaction success",
    // })
    // return
    const body = req.body;
    const { lotteryDateStr, bankId, totalAmount, transactions } = body;
    const database = new Databases(client);
    const invoiceDocument = await database.createDocument(
      databaseName,
      `${lotteryDateStr}${INVOICE_COLLECTION}`,
      ID.unique(),
      {
        bankId: bankId,
        totalAmount: totalAmount,
        userId: result.userId,
      }
    );
    const transactionIdList = [];
    for (let i = 0; i < transactions.length; i++) {
      const transaction = transactions[i];
      transaction.bankId = bankId;
      transaction.userId = result.userId;
      transaction.invoiceId = invoiceDocument.$id;
      const transactionDocument = await database.createDocument(
        databaseName,
        `${lotteryDateStr}${TRANSACTION_COLLECTION}`,
        ID.unique(),
        transaction
      );
      console.log("🚀 ~ app.post ~ transactionDocument:", transactionDocument);
      transactionIdList.push(transactionDocument.$id);

      // search accumulate - sawanon:20240823
      const accumulate = await database.listDocuments(
        databaseName,
        `${lotteryDateStr}${ACCUMULATE_COLLECTION}`,
        [Query.equal(`lottery`, transaction.lottery)]
      );
      if (accumulate.total === 0) {
        // create accumulate
        console.log("🚀 ~ app.post ~ accumulate: create");
        await database.createDocument(
          databaseName,
          `${lotteryDateStr}${ACCUMULATE_COLLECTION}`,
          ID.unique(),
          {
            lottery: transaction.lottery,
            amount: transaction.amount,
            lotteryType: transaction.lotteryType,
            lastFiveTransactions: [transactionDocument.$id],
          }
        );
      } else {
        // update accumulate
        console.log("🚀 ~ app.post ~ accumulate: update");
        const accumulateDocument = accumulate.documents[0];
        const lastFiveTransactions = accumulateDocument.lastFiveTransactions;
        lastFiveTransactions.push(transactionDocument.$id);
        await database.updateDocument(
          databaseName,
          `${lotteryDateStr}${ACCUMULATE_COLLECTION}`,
          accumulateDocument.$id,
          {
            amount: transactionDocument.amount + accumulateDocument.amount,
            lastFiveTransactions: lastFiveTransactions,
          }
        );
      }
      console.log("🚀 ~ app.post ~ accumulate:", accumulate);
    }
    const invoiceDocumentUpdate = await database.updateDocument(
      databaseName,
      `${lotteryDateStr}${INVOICE_COLLECTION}`,
      invoiceDocument.$id,
      {
        transactionId: transactionIdList,
      }
    );
    console.log("🚀 ~ app.post ~ invoiceDocument:", invoiceDocument);
    console.log(
      "🚀 ~ app.post ~ invoiceDocumentUpdate:",
      invoiceDocumentUpdate
    );

    const authorization = Buffer.from(`sawanon:123456`).toString("base64");
    const token = await axios({
      url: `http://127.0.0.1:3000/bank/ldbpay/v1/authService/token`,
      method: "POST",
      headers: {
        Authorization: `Bearer ${authorization}`,
        "Content-Type": "application/json",
      },
    });
    const data = {
      merchantId: "LDB0302000002",
      merchantAcct: "4404FE0FDEA841C04BB68A35B0392F68",
      customerId: "123",
      referentId: invoiceDocument.$id,
      amount: `${totalAmount}`,
      remark: "ldbpay",
      urlBack: `https://lottobkk.net/payment?invoiceId=${invoiceDocument.$id}`,
      urlCallBack: `${currentUrl}/payment`,
      additional1: "EWRWR",
      additional2: "33432",
      additional3: "ASAA",
      additional4: "QQQQQQQ",
    };
    const deeplink = await axios({
      url: `http://127.0.0.1:3000/bank/ldbpay/v1/payment/generateLink.service`,
      method: "POST",
      data: data,
      headers: {
        Authorization: `Bearer ${token.data.access_token}`,
        "Content-Type": "application/json",
      },
    });

    res.json({
      message: "ok",
      deeplink: deeplink.data,
      invoice: invoiceDocumentUpdate,
    });
  } catch (error) {
    console.error(error);
    res.json({
      message: error.message,
    });
  }
});

app.post(
  "/otp/requestOTP",
  (req, res, next) => {
    const { phoneNumber } = req.body;
    if (userOTP[`${phoneNumber}`]) {
      
    }
  },
  async (req, res) => {
    const { phoneNumber } = req.body;
    const otp = Math.floor(100000 + Math.random() * 900000); // Generate a 6-digit OTP
    if (userOTP[`${phoneNumber}`]) {
      userOTP[`${phoneNumber}`].request += 1;
      console.log(
        "🚀 ~ app.post ~ userOTP[`${phoneNumber}`] update:",
        userOTP[`${phoneNumber}`]
      );
    } else {
      userOTP[`${phoneNumber}`] = {
        otp: otp,
        request: 1,
        resent: 0,
        lastRequestTime: new Date(),
      };
      console.log(
        "🚀 ~ app.post ~ userOTP[`${phoneNumber}`] new:",
        userOTP[`${phoneNumber}`]
      );
      setTimeout(() => {
        delete userOTP[`${phoneNumber}`];
        console.log("delete object !");
      }, 1000 * 15); // 15 second
    }
    res.json({
      message: "ok",
      otp: otp,
      phoneNumber: phoneNumber,
    });
  }
);

app.post("/listLotteryCollections", async (req, res) => {
  try {
    const result = await middleware(req);
    if (!result.isPass) {
      res.status = 401;
      throw Error("unAuthen");
    }
    const { lotteryMonth } = req.body
    const database = new Databases(client);
    const collectionList = await database.listCollections(databaseName, [
      Query.contains("name", lotteryMonth),
      Query.contains("name", "invoice"),
      Query.orderDesc("name"),
    ])
    res.json({
      message: "ok",
      collectionList: collectionList.collections.map(collection => collection.name)
    })
  } catch (error) {
    console.error(error);
    res.json({
      message: error.message,
    });
  }
})

app.listen(port, () => {
  console.log(`listen on port ${port}`);
});
